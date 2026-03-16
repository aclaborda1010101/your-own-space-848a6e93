

## Plan: Completar integración JARVIS-Expert Forge

### Tres cambios solicitados

**1. Añadir verificación post-importación al `PublishToForgeDialog`**

Tras recibir respuesta exitosa del gateway, hacer dos llamadas adicionales automáticas via `publish-to-forge` para confirmar la creación:
- `list_rags` con `project_id`
- `list_specialists` con `project_id`

Mostrar los resultados en el panel de resultado (nombres de RAGs, especialistas, router). Esto requiere:
- Añadir un nuevo action `verify` en `publish-to-forge/index.ts` que haga proxy de `list_rags` + `list_specialists` al gateway en una sola llamada
- Actualizar `PublishToForgeDialog.tsx` para llamar a `verify` tras éxito y mostrar datos reales

**2. Mejorar visualización de resultados con datos del `provisioned_report`**

El gateway devuelve un `provisioned_report` con arrays detallados (`rags_created`, `specialists_created`, `links_created`, `components_classification`). Actualizar el panel de resultados para:
- Mostrar listas de RAGs creados/reutilizados
- Mostrar listas de especialistas creados con su clasificación (ai_specialist vs deterministic_engine)
- Mostrar links creados y skipped
- Flag `truncated` con advertencia si el PRD fue cortado

**3. Soporte para re-arquitecturar proyecto existente**

Actualmente el botón "Arquitecturar" ya existe pero siempre envía `create_and_architect`. Para re-arquitecturar un proyecto que ya existe en Expert Forge, el flujo es idéntico (el gateway reutiliza por similitud >80%). No se necesitan cambios en la edge function -- solo mejorar el label del botón para indicar "Re-arquitecturar" si el proyecto ya fue publicado antes.

Añadir un estado `wasPublished` que se detecte buscando en `result` previo o con una llamada `verify` al abrir.

### Archivos a modificar

- `supabase/functions/publish-to-forge/index.ts` -- añadir action `verify` (proxy de `list_rags` + `list_specialists`)
- `src/components/projects/wizard/PublishToForgeDialog.tsx` -- visualización mejorada de `provisioned_report`, llamada verify post-éxito, flag truncated

### Detalle de la action `verify`

```text
POST publish-to-forge
{ "action": "verify", "project_id": "uuid", "project_name": "X" }

→ Llama al gateway con list_rags + list_specialists
→ Devuelve { rags: [...], specialists: [...] }
```

Se necesita `document_text` como campo requerido actualmente -- se relajará la validación para que `verify` no lo exija.

