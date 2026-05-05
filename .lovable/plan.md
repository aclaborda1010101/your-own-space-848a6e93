He revisado el estado actual y hay dos señales claras:

1. El guard de build existe, pero depende de que el iframe llegue a ejecutar el bundle nuevo o al menos reciba un HTML nuevo. Si Lovable Preview mantiene una instancia/HTML anterior, puede seguir mostrando el bundle viejo sin disparar la comparación.
2. El briefing matutino ya apunta en código a `google/gemini-3-flash-preview`, pero puede seguir devolviendo resultados antiguos por dos vías: caché de la tabla `daily_briefings` para el día actual, o Edge Function desplegada todavía en versión anterior. Además no veo llamadas recientes a `daily-briefing` en logs, lo que encaja con que la preview no esté llegando al código nuevo o esté usando datos ya cacheados.

Plan de corrección:

1. Endurecer el refresco de la preview desde el HTML, antes de React
   - Añadir un “early freshness guard” inline en `index.html` que se ejecute antes de cargar `/src/main.tsx`.
   - En hosts de preview (`lovableproject.com`, `id-preview--`, `preview--`, localhost), comparará el `x-build-ts` del HTML contra una clave guardada en `sessionStorage/localStorage`.
   - Si detecta un build distinto, limpiará service workers/caches y recargará una sola vez con `_cb=<timestamp>`.
   - Esto cubre el caso donde el bundle viejo no llega a ejecutar `runtimeFreshness.ts` correctamente.

2. Hacer que el build id sea más robusto
   - Ajustar el plugin de `vite.config.ts` para reemplazar todos los `__BUILD_TS__` de forma global, no solo dos ocurrencias.
   - Mantener un único `BUILD_ID` compartido entre HTML y bundle.
   - Añadir una marca visible de versión en consola solo en preview, para poder comprobar rápidamente si la preview ejecuta el bundle correcto.

3. Evitar que el briefing muestre contenido diario antiguo
   - Cambiar `MorningBriefingCard` para que, cuando se pulse refrescar/generar, fuerce regeneración real y no acepte el briefing cacheado.
   - Mostrar en la tarjeta si el briefing viene de caché o acaba de generarse, con una fecha/hora simple de actualización si existe en el registro.
   - Corregir el render duplicado de `alerts` que ahora puede mostrar dos bloques de alertas.

4. Asegurar que `daily-briefing` usa el modelo nuevo en producción
   - Reconfirmar `DEFAULT_MODEL = 'google/gemini-3-flash-preview'` y añadir `model_used`/metadato en la respuesta y en `full_content` para que el frontend pueda mostrar o depurar qué modelo respondió.
   - Si la tabla no admite columna nueva, no se hará migración: se incluirá dentro de `full_content._meta` para evitar tocar esquema.
   - Desplegar la Edge Function `daily-briefing` después del cambio para que no dependa de un despliegue pendiente.

5. Forzar rebuild de Lovable Preview
   - Actualizar el comentario `// cache-bust:` en `src/main.tsx` con un timestamp nuevo.
   - Esto obliga a Lovable a reconstruir el frontend y activa el nuevo guard temprano.

6. Verificación posterior
   - Abrir `/nutrition` y/o `/dashboard` en preview.
   - Revisar consola para confirmar el build id nuevo.
   - Revisar network/logs de `daily-briefing` cuando se pulse regenerar.
   - Confirmar que ya no aparece el contenido viejo ni el mensaje genérico “Error cargando el briefing matutino” sin detalle.