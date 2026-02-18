

# Plan: Agenda oculta de contactos + ranking por frecuencia de WhatsApp

## Resumen

Cargar los ~870 contactos del CSV del telefono en una tabla oculta (`phone_contacts`). Cuando se importen chats de WhatsApp, el sistema cruza nombres/numeros automaticamente con esa agenda. En la vista de Contactos, solo se muestran los contactos con los que realmente hay interaccion, ordenados por frecuencia, con opcion de marcar favoritos y expandir para ver todos.

## Cambios

### 1. Nueva tabla `phone_contacts` (agenda oculta)

Almacena los contactos del CSV sin mostrarlos en el CRM visible:

```text
phone_contacts
  id            uuid PK
  user_id       uuid NOT NULL
  display_name  text NOT NULL
  phone_numbers text[] DEFAULT '{}'
  email         text
  company       text
  birthday      text
  raw_data      jsonb         -- datos originales del CSV por si hacen falta
  linked_contact_id  uuid FK -> people_contacts.id  -- vinculo al CRM (null = oculto)
  created_at    timestamptz DEFAULT now()
```

RLS: solo el usuario propietario.

### 2. Nuevas columnas en `people_contacts`

- `is_favorite` (boolean, default false) -- para marcar favoritos
- `phone_numbers` (text[], default '{}') -- numeros vinculados
- `wa_message_count` (integer, default 0) -- mensajes de WhatsApp contados

### 3. Nueva tab "Contactos" en DataImport

En `/data-import`, nueva pestana para importar CSV:

- Acepta archivos CSV (formato iPhone/Google Contacts como el que has subido)
- Parsea columnas: Nombre, Segundo nombre, Apellidos, Telefono movil, Email, Empresa, Cumpleanos
- Preview con conteo antes de importar
- Inserta en `phone_contacts` en batch
- Resumen: "870 contactos importados a tu agenda oculta"
- Si ya hay contactos importados, ofrece "Actualizar" o "Reemplazar"

Formato del CSV detectado (tu exportacion):
```text
Nombre, Segundo nombre, Apellidos, ..., Telefono movil, ..., Email de la casa, ...
```

### 4. Importacion masiva de WhatsApp (multiple chats)

Modificar la tab WhatsApp para permitir subir MULTIPLES archivos .txt a la vez:

- Se sube una carpeta o se seleccionan N archivos
- Para cada archivo, se detecta el nombre del contacto (speaker que no es "Yo")
- Se cruza automaticamente con `phone_contacts` por nombre (fuzzy) y numero
- Se crea automaticamente la entrada en `people_contacts` si hay match
- Se cuenta `wa_message_count` para cada contacto
- Al final: resumen global "Procesados 250 chats, 180 contactos vinculados"

### 5. Vista de Contactos con ranking y favoritos

En `/strategic-network`:

- **Vista por defecto**: solo contactos con `wa_message_count > 0` o `is_favorite = true` o `interaction_count > 0`, ordenados por frecuencia de mensajes
- **Filtro "Top 100"**: los 100 contactos con mas mensajes de WhatsApp
- **Filtro "Favoritos"**: solo los marcados con estrella
- **Filtro "Todos"**: muestra absolutamente todos (incluidos los de `phone_contacts` sin interaccion)
- **Boton estrella** en cada contacto para marcar/desmarcar favorito
- **Ordenar por**: mensajes WA, ultima interaccion, nombre

### 6. Flujo completo

```text
1. Importas CSV de contactos -> 870 contactos en phone_contacts (ocultos)
2. Importas N chats de WhatsApp -> se detecta speaker, se cruza con phone_contacts
3. Los contactos con mensajes se promueven a people_contacts
4. Vista Contactos muestra Top 100 por frecuencia
5. Marcas favoritos manualmente -> se fijan arriba
6. Puedes expandir "Ver todos" para acceder a los 870
```

## Detalle tecnico

### Migracion SQL

1. `CREATE TABLE phone_contacts (...)` con indices y RLS
2. `ALTER TABLE people_contacts ADD COLUMN is_favorite boolean DEFAULT false`
3. `ALTER TABLE people_contacts ADD COLUMN phone_numbers text[] DEFAULT '{}'`
4. `ALTER TABLE people_contacts ADD COLUMN wa_message_count integer DEFAULT 0`

### Archivos a modificar

- **`src/pages/DataImport.tsx`**:
  - Nueva tab "Contactos" con parseo de CSV (detectar separador, mapear columnas del formato iPhone)
  - Tab WhatsApp: soporte multi-archivo, matching automatico contra `phone_contacts`, conteo de mensajes
  - Normalizar numeros de telefono para matching (quitar espacios, +34, etc.)

- **`src/pages/StrategicNetwork.tsx`**:
  - Nuevos filtros: "Top 100" / "Favoritos" / "Activos" / "Todos"
  - Boton estrella junto a cada contacto
  - Ordenacion por `wa_message_count` descendente como default
  - Opcion "Ver contactos ocultos" que carga de `phone_contacts`

- **`src/integrations/supabase/types.ts`**: se actualiza automaticamente

### Parseo del CSV

El CSV del usuario tiene este formato (exportacion iPhone):
```text
Nombre,Segundo nombre,Apellidos,...,Telefono movil,...,Email de la casa,...,Empresa,...
```

El parser:
1. Lee la primera linea como headers
2. Mapea `Nombre` + `Segundo nombre` + `Apellidos` como `display_name`
3. Extrae `Telefono movil` y normaliza (quitar espacios, prefijo +34)
4. Extrae `Email de la casa` o `Email del trabajo`
5. Extrae `Empresa`
6. Extrae `Cumpleanos`
7. Guarda el row completo en `raw_data` como JSON

### Matching WhatsApp - Contactos

Al importar un chat de WhatsApp, el speaker detectado se cruza con `phone_contacts` de la siguiente forma:
1. Match exacto por nombre (case-insensitive)
2. Match parcial: si el nombre del archivo o speaker contiene el `display_name`
3. Match por numero: si el speaker es un numero de telefono, se normaliza y busca en `phone_numbers`
4. Si hay match: se vincula `phone_contacts.linked_contact_id` y se crea/actualiza `people_contacts`
5. Si no hay match: se ofrece seleccion manual

