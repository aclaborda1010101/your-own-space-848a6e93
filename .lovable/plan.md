

# Plan: Fix draft generation to use full profile context (third-party attribution)

## Root cause

In `generate-response-draft/index.ts`, line 150-151:
```typescript
const profileSummary = profile
  ? `Personalidad: ${profile.tipo_personalidad}, Comunicación: ${profile.estilo_comunicacion}, Alertas: ${JSON.stringify(profile.alertas)}`
  : "Sin perfil disponible";
```

Only 3 generic fields are passed. The observation ("hermana del contacto Raquel, medicación cardiológica"), `salud_terceros`, `red_contactos_mencionados`, and `bienestar` fields are **never sent** to the draft AI. So it hallucinates "tu madre" or "tu padre" instead of "tu hermana Raquel".

## Fix (single file)

**File**: `supabase/functions/generate-response-draft/index.ts`

### 1. Extract rich profile context (replace lines 150-152)

Build a comprehensive `profileSummary` that includes:
- `observacion` (the key field with the real situation summary)
- `salud_terceros` (third-party health tracking)
- `red_contactos_mencionados` (mentioned people with relationships)
- `alertas` (existing)
- `bienestar` / `coordinacion` for familiar contacts
- `desarrollo_bosco` if present

```typescript
const profileSummary = buildProfileSummary(profile, contact.category);
```

New helper function:
```typescript
function buildProfileSummary(profile: any, category: string): string {
  if (!profile) return "Sin perfil disponible";
  
  const parts: string[] = [];
  
  if (profile.observacion) parts.push(`OBSERVACIÓN: ${profile.observacion}`);
  if (profile.salud_terceros) parts.push(`SALUD DE TERCEROS: ${JSON.stringify(profile.salud_terceros)}`);
  
  // Extract mentioned contacts network
  if (profile.red_contactos_mencionados?.length) {
    const people = profile.red_contactos_mencionados
      .map((p: any) => `${p.nombre} (${p.relacion}): ${p.contexto || ''}`)
      .join("; ");
    parts.push(`PERSONAS MENCIONADAS: ${people}`);
  }
  
  if (profile.alertas?.length) parts.push(`Alertas: ${JSON.stringify(profile.alertas)}`);
  if (profile.bienestar) parts.push(`Bienestar: ${JSON.stringify(profile.bienestar)}`);
  if (profile.tipo_personalidad) parts.push(`Personalidad: ${profile.tipo_personalidad}`);
  
  return parts.join("\n") || "Sin perfil disponible";
}
```

### 2. Strengthen rule #8 in system prompt (line 164)

Replace the generic third-party rule with one that references the actual profile data:

```
8. CONTEXTO DE TERCEROS — LEE EL PERFIL:
   El PERFIL del contacto contiene información sobre QUIÉN es cada persona mencionada
   (hermana, madre, hijo, etc.) y QUÉ situación tiene cada uno.
   ANTES de generar, identifica en el perfil:
   - ¿Quién tiene el problema de salud? (puede ser hermana, madre, padre — NO el contacto)
   - ¿Quién tiene la medicación? ¿Quién fue al médico?
   Si el perfil dice "hermana Raquel - medicación cardiológica", pregunta "qué tal Raquel con la medicación"
   NUNCA digas "tu madre" o "tu padre" si el perfil indica que es "tu hermana".
   USA EL NOMBRE PROPIO de la persona afectada cuando esté disponible.
```

### 3. Move profileSummary BEFORE the conversation history in the prompt

Currently the profile is buried after many other sections. Move it right after the contact info so the AI processes it with higher priority.

## Result

The draft AI will now see:
```
OBSERVACIÓN: Inestabilidad en la salud de la hermana del contacto (Raquel), requiriendo ajustes de medicación cardiológica...
PERSONAS MENCIONADAS: Raquel (hermana): medicación cardiológica, ajustes de dosis
```

And will generate "qué tal Raquel con la medicación del corazón" instead of "tu madre" or "tu padre".

