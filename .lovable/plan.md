
# Plan: Limpiar contactos - solo interlocutores reales

## Problema

La tabla `people_contacts` tiene **118 registros**, pero solo ~20 son interlocutores reales (personas que hablan en las transcripciones). Los demas son personas mencionadas de pasada, personajes historicos, nombres de TV, etc.

## Contactos a MANTENER (interlocutores reales)

Basado en el campo `people` de `conversation_embeddings`:

- **Agustin Cifuentes** (tu)
- **Juany** (familiar, 71 menciones como speaker)
- **Bosco** (hijo, 43 menciones)
- **Raul Agustito** (profesional, 32 menciones)
- **Speaker 4, 5, 6, 7** (comida con amigos - interlocutores anonimos)
- **Speaker 17, 20, 21, 23, 24, 25, 26, 30, 31, 33, 41, 42** (otros interlocutores anonimos de varias grabaciones)

## Contactos a ELIMINAR (~95 registros)

Todos los demas: personajes historicos (El Cid, Juana la Loca, Felipe el Hermoso), animales de documentales (Freddy, Rufus, Oscar), personas mencionadas en conversaciones pero que no hablan (Kobayashi, Steve Jobs, Enrique Olvera, Maria Asuncion, etc.), y nombres genericos (amiga, novio, prima).

## Ejecucion

### Paso 1: Borrar todos los contactos que NO son interlocutores reales

Ejecutar un DELETE en `people_contacts` excluyendo solo los nombres que aparecen como speakers en `conversation_embeddings.people`.

```text
DELETE FROM people_contacts
WHERE name NOT IN (
  SELECT DISTINCT unnest(people) FROM conversation_embeddings WHERE people IS NOT NULL
);
```

Esto eliminara automaticamente todos los contactos cuyo nombre no aparece como interlocutor en ninguna conversacion.

### Paso 2: Limpiar tambien los "Speaker X" del CRM (opcional)

Los "Speaker X" son interlocutores reales pero no aportan valor como contactos en el CRM (son anonimos). Se podrian eliminar tambien:

```text
DELETE FROM people_contacts WHERE name LIKE 'Speaker %';
```

Esto dejaria solo: Agustin Cifuentes, Juany, Bosco, y Raul Agustito como contactos utiles.

### Paso 3: Tambien limpiar el array `people` en conversation_embeddings

Para que las tarjetas de conversacion no muestren "Speaker 31" como interlocutor, limpiar los speakers anonimos de los embeddings:

```text
UPDATE conversation_embeddings
SET people = array_remove(people, s.speaker)
FROM (SELECT DISTINCT unnest(people) as speaker FROM conversation_embeddings WHERE people IS NOT NULL) s
WHERE s.speaker LIKE 'Speaker %'
AND s.speaker = ANY(conversation_embeddings.people);
```

## Resultado esperado

De 118 contactos pasaremos a **4 contactos reales**: Agustin Cifuentes, Juany, Bosco y Raul Agustito. Las tarjetas de conversacion mostraran solo interlocutores con nombre real.

## Seccion tecnica

### Archivos a modificar
Ninguno. Solo operaciones de datos (DELETE/UPDATE) en las tablas `people_contacts` y `conversation_embeddings`.

### Orden de ejecucion
1. DELETE contactos no-interlocutores de `people_contacts`
2. DELETE contactos "Speaker X" de `people_contacts`
3. UPDATE `conversation_embeddings` para quitar "Speaker X" del array `people`
