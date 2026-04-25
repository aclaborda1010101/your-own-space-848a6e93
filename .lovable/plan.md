# Plan — Fix re-extracción Step 1 + transparencia del sampler

## Diagnóstico

Dos problemas distintos que el usuario percibe como uno:

**A) "Guardar y re-extraer" parece no hacer nada (race condition real).**
- `handleSaveAndReExtract` llama `await onUpdateContent(draft)` y luego `onReExtract()`.
- `updateInputContent` hace `UPDATE` en DB y `setProject(prev => { ...prev, inputContent })` (asíncrono en React).
- `onReExtract` hace `setTimeout(() => runExtraction(), 300)`.
- `runExtraction` lee `project.inputContent` del **closure del hook**, que en muchos casos todavía es el viejo. Resultado: la Edge Function recibe el material antiguo, devuelve un briefing prácticamente idéntico, y al usuario le parece que no ha pasado nada (encima tarda 2s porque el LLM ya tiene cache parcial o devuelve un resultado muy similar).

**B) "Input was sampled before LLM extraction to avoid Edge Function timeout" no es un bug.**
- Es la alerta legítima del `input-sampler.ts` (Subir > 90.000 caracteres dispara muestreo a ~42k).
- Pero es opaca: no dice cuántos caracteres tenía el input ni cuántos se mandaron, ni cuáles ventanas se preservaron. El usuario no sabe si perdió señal importante de su PDF nuevo.
- No existe opción para forzar reextracción **sin** samplear cuando el usuario sabe que su input es prioritario.

## Cambios

### 1. Fix race condition (núcleo del problema)

**`src/hooks/useProjectWizard.ts`**
- `runExtraction` acepta un parámetro opcional `overrideInput?: string`. Si se pasa, se usa ese contenido literal en lugar de `project.inputContent`. Garantiza que el contenido recién guardado se manda al backend sin depender del re-render de React.
- `updateInputContent` devuelve el `newContent` que ha guardado (para que el llamador pueda encadenar).
- Añadir toast `loading` al iniciar `runExtraction` con `toast.loading("Re-extrayendo briefing…")` y `toast.dismiss` al terminar — así el usuario ve feedback inmediato.

```ts
const updateInputContent = async (newContent: string): Promise<string | null> => {
  if (!projectId || !user) return null;
  await supabase.from("business_projects")
    .update({ input_content: newContent } as any).eq("id", projectId);
  setProject(prev => prev ? { ...prev, inputContent: newContent } : prev);
  return newContent;
};

const runExtraction = async (overrideInput?: string) => {
  if (!project || !projectId) return;
  const inputContent = overrideInput ?? project.inputContent;
  // ... resto igual, pero usando `inputContent` local en stepData
};
```

**`src/components/projects/wizard/ProjectWizardStep1Edit.tsx`**
- Cambiar la firma de los props para que `onReExtract` acepte el contenido fresco:

```ts
interface Props {
  // ...
  onUpdateContent: (content: string) => Promise<string | null>;
  onReExtract: (freshContent?: string) => void;
}

const handleSaveAndReExtract = async () => {
  setSaving(true);
  const fresh = await onUpdateContent(draft);
  setSaving(false);
  setEditing(false);
  onReExtract(fresh ?? draft);  // pasamos explícitamente el contenido nuevo
};
```

**`src/pages/ProjectWizard.tsx`**
- Eliminar el `setTimeout(300)` (parche frágil que sólo enmascaraba el race condition).
- Pasar el contenido fresco a `runExtraction`:

```tsx
onReExtract={(freshContent) => {
  navigateToStep(2);
  runExtraction(freshContent);
}}
```

### 2. Transparencia del sampler (alerta legible)

**`supabase/functions/project-wizard-step/index.ts`** (líneas ~677-685)
- Mejorar el mensaje del warning para que muestre las cifras reales:

```ts
appendExtractionWarning(briefing, {
  type: "long_input_sampled",
  message: `Material muy largo (${prepared.originalChars.toLocaleString()} caracteres). ` +
    `Se enviaron al LLM ${prepared.sampledChars.toLocaleString()} caracteres preservando ` +
    `cabeza, cola y ${prepared.preservedWindows.length} ventanas alrededor de palabras clave. ` +
    `Si el PDF que acabas de añadir es prioritario, considera dividir el material o ` +
    `reextraer con la opción "forzar contenido completo".`,
  original_chars: prepared.originalChars,
  sampled_chars: prepared.sampledChars,
  strategy: prepared.strategy,
  preserved_keywords: prepared.preservedWindows.map((w) => w.keyword),
});
```

**Componente de alertas del briefing** (donde se renderiza `extraction_warnings`)
- Localizar el componente que muestra "Alertas de Integridad" (probablemente `ProjectWizardStep2.tsx` o similar) y mostrar `original_chars` / `sampled_chars` / `preserved_keywords` en lugar del texto plano.

### 3. Botón "Forzar contenido completo" (opcional, solo si el sampler se activó)

**`src/hooks/useProjectWizard.ts`**
- Añadir un parámetro `{ skipSampler?: boolean }` a `runExtraction`. Cuando es `true`, pasar `skipSampler: true` en el `body.stepData` al invocar la Edge Function.

**`supabase/functions/project-wizard-step/index.ts`**
- Si recibe `skipSampler === true`, saltar `prepareLongInputForExtract` y mandar el `inputContent` íntegro al LLM (asumiendo el riesgo de timeout — el budget de F0/F1 ya se topa internamente a 120k chars).

**`src/components/projects/wizard/ProjectWizardStep2.tsx`** (donde se ve la alerta)
- Si la alerta `long_input_sampled` está presente, mostrar un botón secundario "Re-extraer con contenido completo" que llama a `runExtraction(undefined, { skipSampler: true })`.

### 4. Loading state visible durante la extracción

- Asegurar que mientras `generating === true`, el panel del briefing muestra un overlay/skeleton claro ("Re-extrayendo briefing… esto puede tardar 1–2 minutos") en lugar del briefing viejo. Si ya existe, verificar que se activa con la nueva ruta.

## Lo que NO se toca

- La lógica interna del sampler (umbrales, keywords, estrategia de ventanas).
- F0 / F1 / F2 / extracción del briefing.
- PRD / presupuesto / propuesta cliente (ya cerrados en la iteración previa).
- Schema de DB.

## Tests

- Test manual end-to-end:
  1. Abrir AFFLUX → Step 1 → "Editar material".
  2. Adjuntar el PDF nuevo, verificar que se añade al draft.
  3. Pulsar "Guardar y re-extraer".
  4. Confirmar:
     - Aparece toast "Re-extrayendo briefing…".
     - Navega a Step 2.
     - Briefing se regenera con el contenido nuevo (verificable porque debe contener señales del PDF añadido).
     - La alerta "Material muy largo" muestra cifras reales (no el mensaje genérico).
     - Aparece botón "Re-extraer con contenido completo" si el sampler se disparó.
- Verificar en logs de la Edge Function que el `inputContent` recibido tiene los caracteres del PDF añadido.

## Riesgos

- **Bajo**: el cambio de firma de `runExtraction` es compatible (parámetro opcional).
- **Medio**: el botón "forzar contenido completo" puede provocar timeouts reales con inputs >150k chars. Mitigación: dejar el cap interno de F0 a 120k y mostrar warning si se trunca.

## Rollback

- Revertir los 3 archivos del frontend si algo se rompe (cambios localizados).
- El cambio del mensaje en index.ts es cosmético, sin riesgo.

## Criterios de aceptación

1. Tras "Guardar y re-extraer", el briefing **siempre** se regenera con el contenido recién guardado (sin race).
2. La alerta de muestreo muestra cifras concretas (original / muestreado / nº ventanas).
3. Si el sampler se disparó, hay botón visible para forzar reextracción completa.
4. El usuario ve un loading state inequívoco durante la reextracción.
5. No se toca nada del pipeline F0–F5, PRD, presupuesto ni propuesta.
