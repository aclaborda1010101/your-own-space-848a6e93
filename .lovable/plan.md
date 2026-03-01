

## Plan: Hacer que las auditorías independientes sean completamente compartibles

### Problema
Hay 3 puntos que bloquean a los usuarios compartidos:

1. **Edge function `ai-business-leverage`** (línea 191): filtra por `.eq("user_id", userId)`, así que usuarios compartidos reciben 404 al intentar generar cuestionario/diagnóstico/etc.
2. **Función `user_owns_audit`**: solo verifica propiedad directa, no acceso compartido. Las tablas hijas (diagnostics, recommendations, roadmaps, questionnaire_responses) usan esta función en sus políticas INSERT/DELETE.
3. **Políticas INSERT/DELETE de tablas hijas**: no incluyen `has_shared_edit_access` para `bl_audit`, impidiendo que editores compartidos generen contenido.

### Cambios

**1. Edge function `supabase/functions/ai-business-leverage/index.ts`**
- Líneas 186-196: Quitar `.eq("user_id", userId)` y en su lugar hacer la query sin filtro de owner (RLS ya permite acceso a usuarios compartidos vía la política SELECT actualizada).

**2. SQL Migration — Actualizar `user_owns_audit` y políticas de tablas hijas**

Actualizar la función `user_owns_audit` para incluir acceso compartido:
```sql
CREATE OR REPLACE FUNCTION public.user_owns_audit(p_audit_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.bl_audits
    WHERE id = p_audit_id 
      AND (user_id = auth.uid() 
           OR has_shared_access(auth.uid(), 'bl_audit', p_audit_id))
  );
$$;
```

Actualizar las políticas INSERT y DELETE de las 4 tablas hijas para añadir `has_shared_edit_access(auth.uid(), 'bl_audit', audit_id)`:
- `bl_questionnaire_responses` INSERT/DELETE
- `bl_diagnostics` INSERT/DELETE  
- `bl_recommendations` INSERT/DELETE
- `bl_roadmaps` INSERT/DELETE

