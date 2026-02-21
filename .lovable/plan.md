
# Crear proyecto desde audio de reunion Plaud

## Que se quiere

Al crear un nuevo proyecto, ademas del formulario manual, poder subir un archivo de audio (.m4a, .mp3, .webm, etc.) de una reunion Plaud. El sistema:

1. Transcribe el audio (via `speech-to-text` edge function existente)
2. Extrae entidades del proyecto con IA (nombre, empresa, contacto, necesidad, valor estimado)
3. Pre-rellena el formulario con los datos extraidos
4. El usuario revisa, ajusta y confirma

## Flujo de usuario

1. Abre el dialogo "Nuevo proyecto"
2. Ve un boton "Cargar audio de reunion" junto al formulario
3. Selecciona un archivo de audio (.m4a, .mp3, .webm, .wav)
4. Se muestra un spinner "Transcribiendo..." (5-15s)
5. Luego "Extrayendo datos..." (3-5s)  
6. Los campos del formulario se rellenan automaticamente
7. El usuario ajusta lo que quiera y pulsa "Crear proyecto"

## Cambios tecnicos

### 1. Modificar `CreateProjectDialog` en `src/pages/Projects.tsx`

- Agregar estado para `audioFile`, `extracting` (boolean), y `transcription` (string)
- Agregar un input file oculto + boton visible "Cargar audio de reunion" con icono Mic
- Al seleccionar archivo:
  - Paso 1: Enviar a `speech-to-text` edge function (ya existe, usa Groq Whisper)
  - Paso 2: Enviar la transcripcion a una nueva edge function `extract-project-from-audio` que devuelve los campos estructurados
  - Paso 3: Rellenar `setName()`, `setCompany()`, `setValue()`, `setNeed()`, y auto-seleccionar contacto si lo encuentra

### 2. Nueva edge function `supabase/functions/extract-project-from-audio/index.ts`

Recibe `{ transcription: string, contacts: [{id, name}] }` y usa Gemini para extraer:

```text
{
  project_name: string,      // Nombre descriptivo del proyecto
  company: string | null,    // Empresa mencionada
  estimated_value: number | null, // Valor si se menciona
  need_summary: string,      // Resumen de la necesidad
  need_why: string | null,   // Por que lo necesitan
  need_deadline: string | null, // Plazo mencionado
  need_budget: string | null,  // Presupuesto mencionado
  primary_contact_name: string | null, // Nombre del contacto principal
  matched_contact_id: string | null,   // ID si coincide con contacts[]
  sector: string | null,
  timeline_events: [{title, description}] // Eventos iniciales para el timeline
}
```

El prompt le dice a Gemini que analice la transcripcion como una reunion comercial y extraiga los datos relevantes para crear una oportunidad de negocio.

### 3. Auto-match de contactos

La edge function recibe la lista de contactos existentes del usuario. Si detecta un nombre en la transcripcion que coincide con un contacto existente, devuelve su ID para pre-seleccionar el `primary_contact_id`.

### 4. Timeline automatico

Si la extraccion detecta eventos o hitos mencionados en la reunion, se agregan automaticamente al timeline del proyecto despues de crearlo.

## Detalles de implementacion

| Archivo | Cambio |
|---------|--------|
| `src/pages/Projects.tsx` | Agregar upload de audio + extraction al `CreateProjectDialog` |
| `supabase/functions/extract-project-from-audio/index.ts` | Nueva edge function con prompt Gemini para extraer datos de proyecto |
| `supabase/config.toml` | Registrar nueva funcion con `verify_jwt = false` |

## UX del dialogo

El formulario actual se mantiene identico. Se agrega encima:

- Un area con borde punteado y icono de microfono
- Texto "Sube un audio de la reunion para rellenar automaticamente"
- Al arrastrar o seleccionar archivo: barra de progreso con estados ("Transcribiendo...", "Extrayendo datos...")
- Si ya se extrajo: badge verde "Datos extraidos del audio" con opcion de limpiar
- Los campos se rellenan pero son editables

## Dependencias

- `speech-to-text` edge function (ya existe - Groq Whisper)
- `GEMINI_API_KEY` o `GOOGLE_AI_API_KEY` (ya configuradas)
- No requiere nuevas tablas ni migraciones
