

## Plan: Dar a JARVIS acceso a documentos y datos de proyectos

### Problema actual
JARVIS solo recibe metadatos básicos de proyectos (nombre, estado, empresa, valor). No tiene acceso a:
- **Documentos del proyecto** (`project_documents`: PRDs, scope, auditorías)
- **Timeline de actividad** (`business_project_timeline`: notas, llamadas, feedback)
- **Resumen vivo** (`business_project_live_summary`)
- **Pasos del wizard** (`project_wizard_steps`: datos de cada fase)

Por eso no puede responder preguntas como "¿cuántos vehículos tiene la flota de JotPro?"

### Solución: Búsqueda contextual bajo demanda

No podemos inyectar todos los documentos en cada llamada (serían demasiados tokens). En su lugar:

**1. Nueva herramienta `search_project_data` en JARVIS** (`supabase/functions/jarvis-agent/index.ts`)

Añadir un tool de function-calling que el LLM pueda invocar cuando necesite datos específicos de un proyecto:

```
search_project_data(query: string, project_name?: string)
```

Esta herramienta internamente:
- Busca en `business_projects` por nombre/empresa (fuzzy match con `ilike`)
- Recupera los `project_documents` del proyecto encontrado (PRD, scope, etc.)
- Recupera el `business_project_live_summary`
- Recupera las últimas entradas de `business_project_timeline`
- Devuelve un resumen concatenado (truncado a ~8000 chars) al LLM

**2. Ejecutor de la herramienta** (`executeSearchProjectData`)

```typescript
async function executeSearchProjectData(args: any, userId: string): Promise<string> {
  // 1. Find project by name/company (ilike fuzzy)
  // 2. Fetch project_documents (content, title, document_type)
  // 3. Fetch business_project_live_summary
  // 4. Fetch last 10 timeline entries
  // 5. Concatenate and truncate to ~8000 chars
  // 6. Return formatted context
}
```

**3. Actualizar el SYSTEM_PROMPT**

Añadir instrucción: "Cuando te pregunten datos específicos de un proyecto o cliente, usa la herramienta `search_project_data` para buscar en los documentos del proyecto antes de decir que no tienes la información."

**4. Enriquecer el contexto base de proyectos**

En `buildContext`, para cada proyecto activo, incluir también si tiene documentos disponibles (count) para que JARVIS sepa que puede buscar más info:
```
- JotPro Elevación (F&G) — active — €150,000 — 📄 3 documentos disponibles
```

### Resultado
- JARVIS podrá responder preguntas sobre datos contenidos en PRDs, scopes, auditorías y notas del timeline
- El LLM decide cuándo necesita buscar (no se cargan todos los docs siempre)
- Funciona para cualquier proyecto del usuario

