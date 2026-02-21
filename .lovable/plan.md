

# Fix: Cuestionario generado se pierde al salir

## Problema raiz

La tabla `bl_questionnaire_templates` tiene RLS activado con solo una politica SELECT ("Anyone can read"). No hay politica INSERT, asi que cuando la Edge Function intenta guardar el template usando el token del usuario, el insert falla silenciosamente. El `template_id` queda como `null` en `bl_questionnaire_responses`, y al volver a cargar con `loadExisting`, no puede recuperar las preguntas.

Evidencia en la base de datos:
- `bl_questionnaire_templates`: 0 registros (nunca se guardaron)
- `bl_questionnaire_responses`: registros con `template_id: null`

## Solucion

Dos cambios:

### 1. Anadir politica INSERT a `bl_questionnaire_templates`

Permitir que usuarios autenticados puedan insertar templates. Esta tabla no tiene `user_id`, asi que la politica sera para cualquier usuario autenticado (el acceso al cuestionario ya esta controlado via `bl_questionnaire_responses` que si filtra por `project_id` y la Edge Function verifica ownership del proyecto).

**SQL a ejecutar:**
```sql
CREATE POLICY "Authenticated users can insert templates"
ON bl_questionnaire_templates FOR INSERT
TO authenticated
WITH CHECK (true);
```

### 2. Fallback: guardar las preguntas directamente en `bl_questionnaire_responses`

Como medida adicional de robustez, modificar la Edge Function para que tambien guarde las preguntas directamente en el registro de `bl_questionnaire_responses`. Y modificar `loadExisting` en el hook para que pueda cargar las preguntas desde ahi si `template_id` es null.

**Cambios en `supabase/functions/ai-business-leverage/index.ts`:**
- En la accion `generate_questionnaire`, anadir el campo `questions` al insert de `bl_questionnaire_responses` (como campo JSON dentro de responses o como campo dedicado)

Mejor opcion: guardar las preguntas dentro del JSON `responses` con una key especial `_questions`, asi no necesitamos alterar la tabla:

```js
const { data: response } = await supabase.from("bl_questionnaire_responses").insert({
  project_id,
  template_id: template?.id || null,
  responses: { _questions: questionnaire.questionnaire },
}).select().single();
```

**Cambios en `src/hooks/useBusinessLeverage.tsx` (`loadExisting`):**
- Si `template_id` es null, buscar las preguntas en `responses._questions`
- Si tampoco estan ahi, el cuestionario queda null (estado inicial)

### 3. Limpiar registros huerfanos

Los 2 registros existentes con `template_id: null` y `responses: {}` no tienen preguntas guardadas. No hay nada que recuperar de ellos.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Supabase (SQL) | Politica INSERT en `bl_questionnaire_templates` |
| `supabase/functions/ai-business-leverage/index.ts` | Guardar `_questions` en responses como fallback |
| `src/hooks/useBusinessLeverage.tsx` | `loadExisting`: cargar preguntas desde `_questions` si no hay template |

## Sin cambios de esquema de base de datos

Solo se anade una politica RLS. No se crean tablas ni columnas nuevas.

