
Objetivo: arreglar el pipeline real de push iOS de extremo a extremo y dejar trazabilidad visible en Ajustes > Notificaciones nativas.

Diagnóstico ya confirmado en el código y datos:
- El callback nativo crítico de iOS NO está implementado en `ios/App/App/AppDelegate.swift`. Falta reenviar a Capacitor:
  - `didRegisterForRemoteNotificationsWithDeviceToken`
  - `didFailToRegisterForRemoteNotificationsWithError`
  Sin eso, `PushNotifications.addListener("registration", ...)` puede no dispararse nunca en iOS/TestFlight aunque el permiso esté concedido.
- `useNativePushNotifications()` se instancia dos veces:
  - una en `NativeBootstrap`
  - otra en `NativeNotificationSettings`
  Eso divide listeners/estado y puede hacer que un listener reciba el token mientras la UI lee otra instancia vacía.
- En BD, `device_tokens` solo tiene filas huérfanas (`user_id = NULL`). Ahora mismo no hay ningún dispositivo iOS activo asociado a usuario real.
- El proyecto iOS no muestra en repo evidencia de capability/entitlements de Push Notifications, así que hay que revisar también esa capa nativa.

Plan de implementación

1. Unificar el estado push en una sola fuente de verdad
- Convertir `useNativePushNotifications` en un provider/context compartido o montar la lógica una sola vez y consumir el mismo estado desde bootstrap + settings.
- Evitar dobles listeners, dobles `register()` y estados inconsistentes.
- Mantener toda la trazabilidad en un único objeto de estado.

2. Arreglar la capa nativa iOS de raíz
- Añadir en `AppDelegate.swift` los métodos oficiales que reenvían el token/errores a Capacitor:
  - `didRegisterForRemoteNotificationsWithDeviceToken`
  - `didFailToRegisterForRemoteNotificationsWithError`
- Revisar la configuración iOS del proyecto para asegurar que quede soportado el flujo real de APNs:
  - Push Notifications capability
  - entitlements `aps-environment`
  - si aplica, Background Modes para remote notifications
- No tocar solo UI: cerrar el hueco nativo donde ahora se rompe la cadena.

3. Endurecer el registro backend del dispositivo
- Ampliar el hook para persistir y volver a leer explícitamente estas fases:
  - `permission`
  - `registrationAttempted`
  - `tokenReceived`
  - `tokenSavedToBackend`
  - `lastError`
  - `lastTokenPreview`
  - `deviceId`
  - `lastBackendSyncAt`
- Generar/leer un `device_id` estable con `Device.getId()`.
- Guardar en `device_tokens` con upsert robusto sobre la clave real (`token`) y además limpiar/reclamar huérfanos.
- Si el upsert falla por RLS, unique, columna o cualquier error de Supabase, surfacarlo literal en `lastError`.
- Tras guardar, reconsultar `device_tokens` del usuario actual y usar esa lectura real para pintar la UI.

4. Mejorar el modelo de lectura/estado de dispositivos
- Dejar de basar la pantalla solo en contadores.
- Leer el dispositivo actual y la lista de dispositivos activos del usuario.
- Mostrar:
  - “Registrando dispositivo...” si hay intento en curso
  - “Token recibido, guardando...” si ya llegó token
  - dispositivo actual activo cuando exista fila real en BD
  - error técnico real cuando falle cualquiera de las fases
- El aviso “Sin dispositivos activos” solo debe aparecer cuando la relectura backend confirme que no existe ninguno.

5. Debug surface temporal pero completa en Ajustes > Notificaciones nativas
- Añadir un bloque debug visible con:
  - permission
  - registrationAttempted
  - tokenReceived
  - tokenSavedToBackend
  - deviceRegistered
  - activeDeviceCount
  - deviceId
  - token preview seguro (prefijo/sufijo)
  - lastError
  - última respuesta de guardado/lectura
- Añadir logs de consola consistentes para:
  - requestPermissions
  - register() lanzado
  - registration recibido
  - registrationError recibido
  - upsert OK/error
  - relectura OK/error
  - test push OK/error

6. Arreglar el envío de push de prueba
- Hacer que el botón use la lectura real del dispositivo activo del usuario actual.
- Si no hay token activo, mostrar motivo técnico exacto.
- Si APNs responde error, mostrar el error real devuelto por la función.
- Si existe token y el envío va bien, reflejarlo en la UI debug además del toast.

7. Verificación de datos/RLS
- Revisar políticas e índices de `device_tokens` para que el insert/update del usuario autenticado funcione sin huecos.
- Confirmar si conviene separar políticas por `SELECT/INSERT/UPDATE` en lugar de una `FOR ALL`, para que los errores sean más claros y el comportamiento sea menos ambiguo.
- Mantener seguridad por `user_id = auth.uid()`.

8. QA real que dejaré cubierta tras implementar
- Caso TestFlight real:
  1. abrir Ajustes > Notificaciones nativas
  2. permiso concedido
  3. pulsar “Reintentar registro”
  4. verificar en debug:
     - `registrationAttempted = true`
     - `tokenReceived = true`
     - `tokenSavedToBackend = true`
     - desaparece “Sin dispositivos activos”
     - aparece el dispositivo actual
  5. pulsar “Enviar push de prueba”
  6. confirmar que llega la notificación real al iPhone
- Si falla, el usuario verá exactamente en qué etapa cayó: nativo, token, Supabase o APNs.

Archivos a tocar
- `ios/App/App/AppDelegate.swift`
- `src/hooks/useNativePushNotifications.ts`
- `src/components/native/NativeBootstrap.tsx`
- `src/components/settings/NativeNotificationSettings.tsx`
- posiblemente `src/App.tsx` si el provider compartido se monta ahí
- migración SQL solo si hace falta reforzar políticas/índices/columnas para trazabilidad

Detalles técnicos clave
- El bug principal no parece ser solo de Supabase: ahora mismo la app iOS no implementa el puente nativo requerido por Capacitor para publicar el token APNs al listener JS.
- Además, la doble instancia del hook puede ocultar el problema real y dejar la UI leyendo un estado distinto del listener que registró el token.
- La BD confirma el síntoma: hay tokens iOS históricos huérfanos, pero ningún dispositivo asociado al usuario autenticado actual.

Resultado esperado tras el fix
- Permiso concedido + token recibido + fila real en `device_tokens` asociada al usuario.
- La pantalla deja de culpar al usuario y refleja el estado real del pipeline.
- El push de prueba usa un dispositivo activo real y entrega notificación al iPhone.
