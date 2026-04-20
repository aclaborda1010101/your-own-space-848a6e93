
El usuario dice: "Red Estratégica" muestra para Adolfo Alvaro Benito que el último contacto fue hace 1 mes (15 mar 2026), pero en WhatsApp acaba de hablar con él hoy (viernes, 17:41). Los contactos nuevos sí se actualizan, los antiguos no.

Causas probables:
1. El webhook de Evolution (`evolution-webhook`) recibe los mensajes y los persiste en `contact_messages`, pero **no actualiza `people_contacts.last_contact`** en contactos existentes — solo lo hace al crear contactos nuevos.
2. La columna `last_contact` está stale porque solo se rellena en INSERT, no en webhook updates.
3. La UI lee `last_contact` de `people_contacts` directamente.

Necesito verificar:
- `supabase/functions/evolution-webhook/index.ts` — ¿actualiza last_contact?
- `RedEstrategica.tsx` / expediente — ¿de dónde lee la fecha?
- ¿Hay trigger en BD que actualice last_contact al insertar en contact_messages?

Voy a explorar.
