

## Plan: Arreglos para MVP Funcional

### Estado actual
La prueba end-to-end muestra que el sistema funciona en un 90%. El gateway responde correctamente, la DB esta bien, las edge functions estan desplegadas. Hay un issue no bloqueante con los RAG files y un warning menor en el frontend.

### Cambio 1: Fix RAG path resolution en jarvis-gateway

**Problema**: `buildAgentPrompt` usa `import.meta.url` relativo a `_shared/rag-loader.ts`, pero cuando se llama desde `jarvis-gateway`, el path no se resuelve correctamente en el runtime de Deno. El error es "path not found" para todos los RAGs.

**Solucion**: En `jarvis-gateway/index.ts`, hacer un try/catch directo y construir el prompt manualmente sin depender del rag-loader cuando falla, o bien importar el RAG directamente como texto.

Alternativa mas robusta: modificar `rag-loader.ts` para usar `new URL(path, import.meta.url)` correctamente (ya lo hace) pero el problema es que el gateway esta en un directorio diferente. La solucion es pasar el `import.meta.url` del caller o usar una ruta absoluta desde la raiz de funciones.

**Archivo**: `supabase/functions/_shared/rag-loader.ts`
- Cambiar la resolucion de paths para que funcione desde cualquier edge function, no solo desde `_shared/`

### Cambio 2: Fix warning Badge en DailyPlanCard

**Problema**: `Badge` se usa con una ref pero no tiene `forwardRef`.

**Archivo**: `src/components/dashboard/DailyPlanCard.tsx`
- Envolver el Badge en un `span` o eliminar la ref innecesaria

### Cambio 3: Verificar que la UI de Settings compila con IntegrationsSettingsCard

Ya esta integrado y compila sin errores. No requiere cambios.

### Cambio 4: Test de integracion del flujo completo

Ejecutar test end-to-end:
1. Llamar gateway con plataforma web -> verificar respuesta + guardado en DB
2. Llamar gateway con plataforma telegram -> verificar specialist detection + platform column
3. Llamar gateway con plataforma whatsapp -> verificar respuesta concisa
4. Verificar que specialist_memory se guarda para mensajes importantes
5. Verificar que potus_chat tiene la columna platform con valores correctos

### Resumen de archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/_shared/rag-loader.ts` | Fix path resolution para funcionar desde cualquier edge function |
| `src/components/dashboard/DailyPlanCard.tsx` | Fix warning de Badge ref |

### Lo que NO se toca
- `jarvis-gateway/index.ts` - Funciona correctamente
- `telegram-webhook/index.ts` - Listo, solo falta el token del usuario
- `whatsapp-webhook/index.ts` - Listo, solo falta configuracion Meta
- `IntegrationsSettingsCard.tsx` - Funciona correctamente
- Migracion DB - Ya aplicada y verificada

### Resultado esperado
Un MVP funcional donde:
- El gateway procesa mensajes de cualquier plataforma con contexto completo
- Los RAGs se cargan correctamente para dar respuestas especializadas
- No hay warnings en consola
- El usuario solo necesita configurar los tokens de Telegram/WhatsApp para activar esas integraciones

