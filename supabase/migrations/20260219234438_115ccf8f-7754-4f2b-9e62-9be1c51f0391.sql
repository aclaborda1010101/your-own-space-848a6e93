-- Purga completa de contactos, WhatsApp, Plaud y sugerencias
-- NO es cambio de schema, pero es la unica forma de ejecutar DELETE desde aqui

-- Tablas dependientes primero
DELETE FROM contact_messages;
DELETE FROM contact_aliases;
DELETE FROM contact_links;
DELETE FROM contact_link_suggestions;
DELETE FROM contact_relationships;
DELETE FROM business_project_contacts;

-- Plaud
DELETE FROM conversation_embeddings;
DELETE FROM plaud_recordings;
DELETE FROM plaud_threads;
DELETE FROM plaud_transcriptions;

-- Sugerencias
DELETE FROM suggestions;

-- Tablas principales
DELETE FROM people_contacts;
DELETE FROM phone_contacts;