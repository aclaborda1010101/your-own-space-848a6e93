

## Plan: Rebranding de "Agustito" a "ManIAS Lab."

Reemplazar todas las referencias a "Agustito" por "ManIAS Lab." en los prompts y textos del sistema. Los nombres de variables/secrets técnicos (`AGUSTITO_RAG_URL`, etc.) se mantienen ya que son identificadores internos de infraestructura.

### Archivos a modificar

| Archivo | Cambio |
|---|---|
| `src/config/projectPipelinePrompts.ts` | Reemplazar ~6 ocurrencias de "Agustito" en textos descriptivos por "ManIAS Lab." (empresa ejecutora, contexto de agencia, etc.). Mantener los nombres de secrets/variables técnicos como `AGUSTITO_RAG_URL` sin cambiar |
| `supabase/functions/project-wizard-step/index.ts` | Reemplazar ~4 ocurrencias de "Agustito" en textos descriptivos de prompts por "ManIAS Lab." (empresa ejecutora, "Configurado por"). Mantener nombres de secrets técnicos |

### Detalle de reemplazos textuales

Textos que cambian:
- `"Empresa ejecutora: Agustito (consultora tecnológica y marketing digital)"` → `"Empresa ejecutora: ManIAS Lab. (consultora tecnológica, IA y marketing digital)"`
- `"Nombre: Agustito"` → `"Nombre: ManIAS Lab."`
- `"Configurado por AGUSTITO en deploy"` → `"Configurado por ManIAS Lab. en deploy"`
- `"AGUSTITO (en deploy)"` (en tablas de secrets) → `"ManIAS Lab. (en deploy)"`

### Lo que NO cambia

Los nombres de variables de entorno (`AGUSTITO_RAG_URL`, `AGUSTITO_RAG_KEY`, etc.) se mantienen porque son identificadores técnicos de infraestructura ya configurados.

