# Plan: Naming canónico bloqueado por `projectName` del usuario

## Diagnóstico

El sistema ya separa `client_company_name`, `founder_or_decision_maker` y `proposed_product_name` en `brief-normalizer.ts`, pero:

1. La cabecera del brief limpio dice `CONFIDENCIAL — Alejandro Gordo` o `— AFLU` porque toma `client_company_name` y este puede acabar mal extraído.
2. No existe el campo `detected_aliases[]` ni `canonical_source`, así que las variantes (`AFLU`, `AFLUS`, `AFFLU`, `Aflu`) se cuelan en lugar de quedar etiquetadas como aliases.
3. `proposed_product_name` se sobreescribe SOLO si `ctx.productName` existe; si no, cae a `projectName`. Pero el LLM puede meter ahí `Alejandro Gordo` en pasos posteriores y nada lo bloquea.
4. La cabecera del brief limpio NO usa `projectName` como ancla principal.
5. `f6-prd-builder` y `f7-proposal-builder` reciben `projectName/clientName` desde `index.ts`, pero hay que confirmar que el `clientName` que reciben es `client_company_name` ya saneado y NO una variante OCR.

## Regla de oro

> Lo que el usuario escribe en la ficha del proyecto (`projectName`) es la fuente de verdad para Producto/Proyecto/Título. La transcripción solo aporta `detected_aliases[]`.

---

## Cambios

### 1. `supabase/functions/project-wizard-step/brief-normalizer.ts`

**a) Forzar `proposed_product_name = ctx.projectName` SIEMPRE.**
Hoy solo se aplica si `ctx.productName` existe o si está vacío. Cambiar la lógica para que `projectName` (cuando se pasa) sobrescriba cualquier valor del LLM y se registre el cambio en `_normalization_log`. `ctx.productName` solo se usa si el usuario lo pasa explícitamente distinto.

**b) Generar `detected_aliases[]`.**
Antes de sobrescribir, comparar `cnc.proposed_product_name` actual con `ctx.projectName` (case-insensitive, normalización Unicode). Si difiere y parece variante (Levenshtein ≤ 2 o substring/superstring), guardar el valor anterior en `cnc.detected_aliases`. También escanear `client_company_name` extraído inicialmente y los `_source_chunks` de la extracción cruda en busca de tokens parecidos a `projectName` que NO coincidan exactamente; dedupe + cap a 8.

**c) Añadir `canonical_source: "user_project_input"`** cuando `projectName` se aplica como producto.

**d) Bloqueo de promoción persona→cliente.**
Si tras pasar todas las reglas `client_company_name` sigue siendo igual a `founder_or_decision_maker` o sigue pareciendo persona y NO hay `companyNameOverride`, fijar `client_company_name = projectName` y registrar el cambio (la regla 2 del usuario: `Cliente / empresa: AFFLUX` cuando no hay otra cosa).

**e) Nunca permitir `proposed_product_name = null` si `projectName` existe.**

### 2. `supabase/functions/project-wizard-step/clean-brief-builder.ts`

**a) Cabecera nueva** (líneas 153-159), tomando `projectName` como ancla:

```
# Brief Limpio — {projectName}

> **CONFIDENCIAL — {projectName}**

**Proyecto / Producto:** {projectName}
**Cliente / empresa:** {client_company_name || projectName}
**Decisor:** {founder_or_decision_maker || "n/d"}
{si detected_aliases.length} **Aliases detectados:** AFLU, AFLUS, AFFLU…
```

**b) Eliminar la frase** `_Generado automáticamente desde la extracción cruda…_` (ya estaba pendiente del mensaje anterior; cerramos aquí).

**c) Añadir `projectName` como prop obligatorio** y pasarlo siempre desde `index.ts` (ya se hace en líneas 237 y 433 de `index.ts`).

### 3. `supabase/functions/project-wizard-step/f6-prd-builder.ts` y `f7-proposal-builder.ts`

**Asegurar que reciben y usan `projectName` saneado**:

- En `index.ts`, donde se llama a `buildTechnicalPrd` y `buildClientProposal`, pasar:
  - `projectName`: SIEMPRE el valor de la fila `business_projects.name` (no del briefing).
  - `clientCompany`: tomar de `cnc.client_company_name` ya saneado por el normalizer; si tras saneo sigue pareciendo persona o es vacío, usar `projectName`.
  - (Opcional) `decisionMaker`: `cnc.founder_or_decision_maker`.

- `f7-proposal-builder.ts` línea 450 ya hace `CONFIDENCIAL — ${p.client_company}`. Verificamos que `client_company` recibido NO es una variante OCR. Si `client_company === projectName` o vacío, mostrar solo `CONFIDENCIAL — {projectName}`.

- En la portada de la propuesta (líneas ~452), añadir línea `**Proyecto / Producto:** {projectName}` antes de `Cliente / empresa`.

### 4. `index.ts` — invocaciones

En las dos rutas que llaman al normalizer (extract y re-extract, líneas 229 y 419) ya se pasa `projectName, productName`. Confirmar que `productName` NO se setea desde la extracción si el usuario no lo escribió manualmente — debe llegar `undefined` por defecto, no un valor inferido.

En las llamadas a `buildTechnicalPrd` / `buildClientProposal` (donde se generen Steps 29/30), pasar el `projectName` desde la fila `business_projects` directamente, NO desde el briefing.

### 5. Tests

Añadir a `brief-normalizer` un test deno (`brief-normalizer_test.ts` si no existe; si existe, ampliar):

- `ctx.projectName="AFFLUX"`, briefing dice `proposed_product_name="AFLUS"` → output `proposed_product_name="AFFLUX"` y `detected_aliases` incluye `"AFLUS"`.
- `client_company_name="Alejandro Gordo"`, sin company override → se mueve a `founder_or_decision_maker`, `client_company_name` cae a `projectName`.
- `proposed_product_name=null`, `ctx.projectName="AFFLUX"` → output `="AFFLUX"`, `canonical_source="user_project_input"`.
- Detección de aliases por similitud (Levenshtein ≤ 2): `AFFLU`, `Aflu`, `AFLU` se capturan.

Ampliar `f7-proposal-builder_test.ts`:
- Si `clientCompany` viene vacío o == `projectName`, la cabecera muestra solo el projectName y la portada incluye `Proyecto / Producto`.

### 6. Criterio de aceptación AFFLUX

Tras re-ejecutar la limpieza editorial sobre el Step 2 de AFFLUX, en el brief limpio v12 debe leerse:

```
> CONFIDENCIAL — AFFLUX

Proyecto / Producto: AFFLUX
Cliente / empresa: AFLU            (o "AFLU / AFFLUX" si seguimos sin saber)
Decisor: Alejandro Gordo
Aliases detectados: AFLUS, AFFLU, Aflu
```

Y NO debe aparecer `Producto: null`, `Cliente: Alejandro Gordo`, ni `Proyecto: AFLUS`.

---

## Archivos a editar

- `supabase/functions/project-wizard-step/brief-normalizer.ts` — aliases, bloqueo de projectName, canonical_source.
- `supabase/functions/project-wizard-step/clean-brief-builder.ts` — cabecera nueva con projectName y aliases.
- `supabase/functions/project-wizard-step/f7-proposal-builder.ts` — portada con `Proyecto / Producto`, fallback a projectName si client_company vacío.
- `supabase/functions/project-wizard-step/f6-prd-builder.ts` — verificar que el título usa `project_name` recibido.
- `supabase/functions/project-wizard-step/index.ts` — propagar `projectName` desde la fila `business_projects` a builders F6/F7; no inferir `productName` desde la extracción.
- Tests: `brief-normalizer_test.ts` (nuevo o ampliar), `f7-proposal-builder_test.ts` (ampliar).

## Lo que NO se toca

- Extracción chunked.
- F2/F3/F4/F5 (Step 25–28).
- Lógica de scope, PRD técnico ni propuesta más allá de los campos de cabecera/título.
- Llamadas LLM (todo es determinista).

## Pregunta

Una sola decisión que afecta a la regeneración del brief AFFLUX:

¿La micro-limpieza editorial pendiente (cambio de cabecera + traducciones residuales + Gobernanza + alerta señal 71) la metemos **dentro de este mismo deploy** y la aplicamos automáticamente al Step 2 de AFFLUX al guardar (creando v12), o lo haces tú con el botón **"Aprobar Brief"** una vez deployado?
