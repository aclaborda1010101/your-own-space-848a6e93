
## Plan: corregir ahora mismo el “36 días” falso en toda la red

### Qué voy a hacer
Haré dos cosas en el mismo trabajo:

1. **Arreglo definitivo del bug**
   - `evolution-webhook` hoy guarda mensajes pero no está manteniendo bien `people_contacts.last_contact`.
   - `send-whatsapp` guarda salientes pero tampoco actualiza `last_contact`.
   - `whatsapp-webhook` sí intenta hacerlo, pero usa una condición que falla cuando `last_contact` es `NULL`.
   - Resultado: la UI de `/red-estrategica` sigue enseñando 36d aunque hayas hablado ayer.

2. **Reparación masiva de tus datos actuales**
   - Haré un backfill para recalcular `last_contact` desde `contact_messages.message_date` y ponerlo bien en todos tus contactos activos.
   - Así no solo queda arreglado hacia futuro: también se corrige lo que ya está mal ahora.

### Evidencia que he encontrado en el código
- `src/components/contact/ContactCard.tsx` calcula el chip usando `contact.last_contact`.
- `src/pages/RedEstrategica.tsx` también filtra y calcula actividad con `last_contact`.
- `supabase/functions/evolution-webhook/index.ts` inserta el mensaje pero no veo actualización de `people_contacts.last_contact`.
- `supabase/functions/send-whatsapp/index.ts` persiste salientes y tampoco actualiza `last_contact`.
- `supabase/functions/whatsapp-webhook/index.ts` hace:
  `update({ last_contact: messageDate }).lt("last_contact", messageDate)`
  y eso deja fuera filas con `last_contact = null`.
- `contact-profiles-refresh-all` solo toca `updated_at`; no arregla la recencia.

### Cambios concretos
#### 1) Persistencia correcta de recencia
Actualizaré:
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`

Con una regla robusta:
- si `last_contact` es `NULL`, se rellena
- si el nuevo `message_date` es más reciente, se actualiza
- si el mensaje es antiguo, no pisa un valor más nuevo

#### 2) Reparación masiva inmediata
Haré una actualización de datos para:
- recorrer tus contactos activos de la red/favoritos
- calcular `MAX(contact_messages.message_date)` por contacto
- guardar ese valor en `people_contacts.last_contact`

Así desaparecerá el “36d” falso en bloque, sin esperar a que entren mensajes nuevos.

#### 3) Ajuste del botón de refresh
Revisaré el flujo de “Regenerar perfiles” para no mezclar “perfil actualizado” con “último contacto”.
Si conviene, dejaré más claro en UI que:
- una cosa es perfil IA
- otra cosa es recencia real de conversación

### Resultado esperado
Después de implementarlo:
- Gorka, tu primo, Adolfo y el resto deberían reflejar la fecha real del último WhatsApp
- la red estratégica dejará de marcar 36d falsos en masa
- los próximos mensajes entrantes y salientes mantendrán `last_contact` correcto automáticamente
- volver a pulsar “Regenerar perfiles” ya no dará la sensación de que “actualiza todo” cuando en realidad no arregla la recencia

### Detalle técnico
#### Lógica de corrección
```text
last_contact_correcto(contacto) =
  MAX(message_date) de contact_messages
  donde contact_id = contacto.id
  y source in ('whatsapp', 'whatsapp_backup')
```

#### Archivos a tocar
- `supabase/functions/evolution-webhook/index.ts`
- `supabase/functions/send-whatsapp/index.ts`
- `supabase/functions/whatsapp-webhook/index.ts`

#### Operación de datos a ejecutar
- backfill sobre `people_contacts.last_contact` usando el histórico real de `contact_messages`

### Validación que haré al terminar
1. Comprobar varios contactos problemáticos concretos.
2. Verificar que el chip de recencia en `/red-estrategica` cambia tras recargar.
3. Verificar que al entrar un mensaje nuevo el `last_contact` se mueve solo.
4. Revisar un envío saliente desde la app para asegurar que también actualiza.
