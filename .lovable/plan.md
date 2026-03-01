

## Plan: Cuestionario Web Público para Clientes

### Concepto
Crear una URL pública (`/audit/:auditId/questionnaire?token=XXX`) que el cliente pueda abrir en su navegador y rellenar el cuestionario directamente. Las respuestas se guardan en tiempo real en `bl_questionnaire_responses` via una edge function pública, sin necesidad de autenticación del cliente.

### Cambios

**1. Migración SQL — Añadir token público a `bl_audits`**
- Añadir columna `public_token UUID DEFAULT gen_random_uuid()` a `bl_audits`
- Añadir columna `public_questionnaire_enabled BOOLEAN DEFAULT false`
- Añadir columna `client_name TEXT` y `client_email TEXT` (opcionales, para que el cliente se identifique)

**2. Nueva página pública `src/pages/PublicQuestionnaire.tsx`**
- Ruta: `/audit/:auditId/questionnaire?token=XXX`
- Sin autenticación requerida (no usa `ProtectedPage`)
- Carga cuestionario y respuestas existentes vía edge function pública
- Reutiliza la misma UI de preguntas (cards con botones, sliders, textareas)
- Auto-guarda cada respuesta al cambiar (debounce)
- Al completar todas, muestra mensaje de "gracias" y marca `completed_at`
- Diseño limpio con branding mínimo

**3. Edge function `ai-business-leverage` — Añadir acciones públicas**
- `public_load_questionnaire`: valida `audit_id` + `token`, devuelve preguntas y respuestas existentes (sin datos internos)
- `public_save_response`: valida token, guarda respuesta individual en `bl_questionnaire_responses`
- Estas acciones NO requieren JWT, solo validación del token

**4. Botón "Compartir cuestionario" en `QuestionnaireTab.tsx`**
- Nuevo botón junto a "Exportar MD" que genera/muestra la URL pública
- Toggle para activar/desactivar el acceso público
- Botón copiar enlace al portapapeles
- Preview de la URL generada

**5. Ruta en `App.tsx`**
- Añadir `<Route path="/audit/:auditId/questionnaire" element={<PublicQuestionnaire />} />` (sin ProtectedPage)

### Flujo
1. Consultor genera cuestionario → pulsa "Compartir con cliente"
2. Se activa `public_questionnaire_enabled` y se copia la URL pública
3. Cliente abre la URL en su navegador, ve el cuestionario
4. Cliente responde pregunta a pregunta, cada respuesta se guarda automáticamente
5. Al terminar, consultor ve las respuestas en su panel y puede generar la radiografía

### Seguridad
- Token UUID aleatorio por auditoría, difícil de adivinar
- Solo se exponen preguntas y respuestas, nunca datos internos (priority, internal_reason)
- El consultor puede desactivar el acceso público en cualquier momento
- RLS bypass via edge function con service role para las acciones públicas

