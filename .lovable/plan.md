
Objetivo: aislar por qué los 2 WhatsApp de hoy no aparecen en la app.

Diagnóstico actual:
- No es un problema de la UI de `/data-import`.
- La base de datos no recibió mensajes nuevos hoy:
  - `contact_messages` para tu user_id tiene `last_whatsapp_created_at = 2026-03-15 01:01:29+00`
  - `last_whatsapp_message_date = 2026-03-13 19:38:31+00`
- Los logs de `whatsapp-webhook` siguen mostrando solo verificaciones `GET`:
  - `"[WhatsApp] Webhook verified"`
  - No hay ni un solo `POST received`
  - No hay ni `Message from...`
- `evolution-webhook` tampoco tiene logs.
- En `people_contacts` no hay contactos con `wa_id`, lo que refuerza que no entró ningún evento live reciente.

Conclusión:
Los 2 mensajes de hoy no están llegando a Supabase. El fallo está antes de la persistencia:
```text
WhatsApp/Meta (o Evolution) -> webhook -> contact_messages -> realtime UI
                         X aquí
```

Qué revisaría y corregiría:
1. Confirmar cuál es el origen real de esos mensajes
   - Si entran por Meta WhatsApp Business, el endpoint relevante es `whatsapp-webhook`.
   - Si entran por Evolution API, el endpoint relevante es `evolution-webhook`.
   - Ahora mismo ninguno de los dos recibe eventos.

2. Verificar en Meta Developers la configuración exacta
   - Callback URL exacta del webhook.
   - Verify token correcto.
   - Campo `messages` suscrito al mismo app/webhook.
   - Que la app no esté en modo Development para números no testers.
   - Que los mensajes estén entrando al número de negocio exacto `+34 635 87 13 39`, que sí aparece como conectado en `whatsapp-status`.

3. Verificar si estás escribiendo al número correcto
   - Si hoy escribiste a otro número/instancia (por ejemplo una instancia de Evolution distinta del número de Meta), esta app no lo verá.
   - Esto es especialmente probable porque:
     - `whatsapp-status` dice que Meta está conectado
     - pero no hay POSTs reales en logs

4. Confirmar secret y despliegue operativo
   - El secret `EVOLUTION_DEFAULT_USER_ID` sí existe ya.
   - `WHATSAPP_API_TOKEN` y `WHATSAPP_PHONE_ID` también existen.
   - O sea: si llegara el POST, el código debería al menos loguearlo.

Plan de acción recomendado:
1. Enviar un mensaje de prueba al número exacto `+34 635 87 13 39`
2. Revisar inmediatamente logs de `whatsapp-webhook`
   - Si aparece `POST received`, el problema pasa a parsing/persistencia
   - Si no aparece nada, el problema está 100% en Meta/configuración externa
3. Si ese mensaje de prueba entró por Evolution y no por Meta:
   - revisar la URL configurada en Evolution
   - validar que apunte a `/functions/v1/evolution-webhook`
4. Si quieres que lo siguiente sea robusto, la implementación correcta sería:
   - añadir un “último evento recibido” persistido en BD
   - mostrar en UI si el webhook lleva horas sin tráfico
   - guardar también eventos no-text/status para diagnóstico histórico

Detalles técnicos:
- `src/pages/DataImport.tsx`
  - La pestaña live consulta `contact_messages` con `source = 'whatsapp'`
  - La suscripción realtime escucha `INSERT` en `contact_messages` con `filter: 'source=eq.whatsapp'`
  - Si la BD no recibe filas nuevas, la UI nunca podrá enseñarlas
- `supabase/functions/whatsapp-webhook/index.ts`
  - Ya está preparado para loguear todos los POSTs
  - Pero en logs solo aparecen verificaciones GET
- Estado de datos:
  - ~587k mensajes WhatsApp históricos
  - el último `created_at` es de esta madrugada, no de hoy tras tus 2 mensajes
  - último `message_date` visible: 13 de marzo

Resultado esperado tras la corrección:
- En cuanto Meta/Evolution entregue eventos reales:
  - aparecerán nuevas filas en `contact_messages`
  - el panel Live se actualizará
  - saltará el toast de nuevo mensaje
  - se podrán asociar `wa_id` a contactos

Siguiente intervención que recomiendo:
- verificar y corregir la ruta externa de entrada (Meta vs Evolution) antes de tocar más código, porque ahora la evidencia indica que el problema no está dentro de React ni dentro de la query de Supabase.
