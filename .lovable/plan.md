

# Purga de datos: Contactos + WhatsApp + Plaud

## Datos a borrar

| Tabla | Registros | Que contiene |
|-------|-----------|-------------|
| contact_messages | 336,062 | Mensajes de WhatsApp importados |
| contact_aliases | 0 | Aliases de contactos |
| contact_links | 0 | Vinculos entre contactos |
| contact_link_suggestions | 0 | Sugerencias de vinculacion |
| people_contacts | 1,162 | Contactos principales del CRM |
| phone_contacts | 1,850 | Contactos de agenda (ocultos) |
| conversation_embeddings | 2,499 | Embeddings de conversaciones Plaud |
| plaud_recordings | 63 | Grabaciones Plaud |
| plaud_threads | 1 | Hilos de conversacion Plaud |
| plaud_transcriptions | 0 | Transcripciones Plaud (nueva tabla) |
| suggestions | 93 | Sugerencias generadas por Plaud/sistema |

## Lo que NO se borra

- `jarvis_emails_cache` — emails intactos
- `email_accounts` — cuentas de email configuradas

## Pasos

1. **Ejecutar DELETE en todas las tablas listadas** (no hay FK constraints, se puede hacer en paralelo)
2. **Verificar que queda todo vacio**
3. **Reimportar contactos** desde /onboarding o /data-import (VCF + WhatsApp)
4. **Re-sincronizar emails** para que se vinculen con los contactos nuevos (esto recalcula vinculos email-contacto)
5. **Las grabaciones de Plaud** se reprocesaran cuando lleguen nuevos emails de Plaud o se fuerce un reprocess de email-sync

## Detalle tecnico

Se ejecutaran estas queries SQL via el insert tool (no es cambio de schema):

```sql
DELETE FROM contact_messages;
DELETE FROM contact_aliases;
DELETE FROM contact_links;
DELETE FROM contact_link_suggestions;
DELETE FROM conversation_embeddings;
DELETE FROM plaud_recordings;
DELETE FROM plaud_threads;
DELETE FROM plaud_transcriptions;
DELETE FROM suggestions;
DELETE FROM people_contacts;
DELETE FROM phone_contacts;
```

El orden importa poco porque no hay foreign keys, pero se borran primero las tablas dependientes por seguridad.

Despues de la purga, el usuario podra:
- Ir a /onboarding o /data-import para reimportar VCF y WhatsApp
- Sincronizar emails desde /data-import para vincularlos con los nuevos contactos
- Los nuevos emails de Plaud se procesaran automaticamente via email-sync + plaud-intelligence

