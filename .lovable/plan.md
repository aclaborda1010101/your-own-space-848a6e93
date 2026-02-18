

# Auto-deteccion de "Yo" y purga de contactos

## Resumen

El sistema ya tiene `my_identifiers` en el perfil del usuario (con `whatsapp_names`, `whatsapp_numbers`, `plaud_speaker_labels`), pero la edge function `process-transcription` **no lo usa** para filtrar al propio usuario al crear contactos. Esto provoca que "Agustin", "Agus", etc. aparezcan como contactos en `people_contacts`.

El plan tiene dos partes: (1) purgar los 349 contactos existentes, y (2) hacer que el sistema se auto-excluya al procesar transcripciones y chats.

## Parte 1: Purga de contactos existentes

Ejecutar una migracion SQL que elimine todos los registros de `people_contacts` del usuario. Los contactos se re-crearan organicamente a medida que se importen audios y chats.

```text
DELETE FROM people_contacts WHERE user_id = '<user_id>';
```

## Parte 2: Filtro "Soy yo" en process-transcription

**Archivo: `supabase/functions/process-transcription/index.ts`**

En la seccion de "Save/update people contacts" (lineas 391-427), antes de iterar sobre `extracted.people`, cargar `my_identifiers` del perfil del usuario y filtrar:

1. Consultar `user_profile` para obtener `my_identifiers`
2. Construir una lista normalizada de nombres propios: `whatsapp_names` + `plaud_speaker_labels` + el campo `name` del perfil
3. Antes de insertar/actualizar cada persona, comparar (case-insensitive) si el nombre coincide con alguno de mis identificadores
4. Si coincide, saltar esa persona (no crear contacto para mi mismo)

Logica adicional de deteccion contextual:
- Si el titulo de la transcripcion contiene patrones como "llamada con X", "reunion con X", "cafe con X", el sistema puede inferir que X es el otro interlocutor y todos los demas speakers son "yo"
- Agregar al prompt de extraccion una instruccion explicita: "El usuario se llama Agustin (tambien Agus). NO lo incluyas en la lista de people ni speakers externos."

### Cambios especificos

**En el prompt EXTRACTION_PROMPT** (linea 53+), agregar dinamicamente el nombre del usuario:

```text
CONTEXTO DEL USUARIO: El usuario se llama [nombre]. Sus identificadores son: [lista].
REGLA: NUNCA incluyas al propio usuario en el array "people". Solo incluye a las OTRAS personas.
```

Para esto, el prompt dejara de ser una constante global y se construira dinamicamente con los datos del usuario.

**En la logica de guardado** (lineas 391-427), agregar un filtro de seguridad como segunda linea de defensa:

```text
// Cargar my_identifiers del perfil
const { data: userProfile } = await supabase
  .from('user_profile')
  .select('name, my_identifiers')
  .eq('id', userId)
  .single();

const myNames = new Set<string>();
if (userProfile?.name) myNames.add(userProfile.name.toLowerCase());
const ids = userProfile?.my_identifiers || {};
for (const n of ids.whatsapp_names || []) myNames.add(n.toLowerCase());
for (const n of ids.plaud_speaker_labels || []) myNames.add(n.toLowerCase());

// Filtrar antes de guardar
const filteredPeople = extracted.people.filter(p => 
  !myNames.has(p.name.toLowerCase())
);
```

**En la importacion de WhatsApp** (DataImport.tsx), la funcion `parseWhatsAppSpeakers` ya usa `my_identifiers` para identificar al usuario. No necesita cambios.

## Parte 3: Ampliar my_identifiers desde la UI

**Archivo: `src/components/settings/ProfileSettingsCard.tsx`**

Agregar un campo editable para `plaud_speaker_labels` (ya existe en los defaults pero no en la UI de settings). Asi el usuario puede agregar etiquetas como "Speaker 1", "Agustin", etc.

## Archivos a modificar

1. `supabase/functions/process-transcription/index.ts` - Filtro de auto-exclusion + prompt dinamico
2. `src/components/settings/ProfileSettingsCard.tsx` - Campo para plaud_speaker_labels
3. Migracion SQL para purgar contactos existentes

