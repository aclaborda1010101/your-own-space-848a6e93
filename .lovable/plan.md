

# Importacion masiva de WhatsApp con auto-deteccion de contactos

## Problema actual

El flujo actual obliga a:
1. Seleccionar manualmente un contacto (o crear uno nuevo)
2. Subir UN solo archivo .txt
3. Repetir para cada chat

Esto es inviable si tienes 4+ archivos con todas tus conversaciones.

## Nueva experiencia de usuario

1. El usuario sube 1 o mas archivos .txt de WhatsApp (con `multiple`)
2. El sistema parsea cada archivo, detecta el speaker principal (el que NO eres tu)
3. Cruza cada nombre detectado contra `people_contacts` existentes (fuzzy match)
4. Muestra una tabla de revision:

```text
+---------------------------+-------------------+----------+
| Archivo                   | Contacto detectado| Match    |
+---------------------------+-------------------+----------+
| Chat de Juan.txt          | Juan Lopez        | Vinculado|
| Chat de Maria.txt         | Maria Garcia      | Vinculado|
| Chat de Pedro.txt         | Pedro             | Nuevo    |
| Chat de Mama.txt          | Mama              | Nuevo    |
+---------------------------+-------------------+----------+
```

5. Para los que no tienen match, el usuario puede:
   - Vincular a un contacto existente (con combobox buscable)
   - Crear nuevo contacto automaticamente
   - Ignorar ese archivo
6. Al confirmar, se procesan todos de golpe

## Cambios tecnicos

**Archivo: `src/pages/DataImport.tsx`**

### 1. Nuevos estados

- `waFiles: File[]` - multiples archivos seleccionados
- `waParsedChats: ParsedChat[]` - resultado del parseo de cada archivo con speaker detectado, match encontrado, y accion del usuario
- `waImportStep: 'select' | 'review' | 'done'` - paso actual del flujo

### 2. Nueva interfaz ParsedChat

```text
interface ParsedChat {
  file: File;
  detectedSpeaker: string;        // nombre detectado del interlocutor
  messageCount: number;            // mensajes del contacto
  myMessageCount: number;          // mensajes mios
  matchedContactId: string | null; // id del contacto si hay match
  matchedContactName: string;      // nombre del match
  action: 'link' | 'create' | 'skip'; // que hacer
}
```

### 3. Funcion parseWhatsAppFile(file, myIdentifiers)

Reutiliza la logica de parseo existente (lineas 282-308) pero extraida a una funcion independiente que:
- Lee el archivo
- Detecta speakers
- Identifica cual es "yo" usando `my_identifiers`
- Retorna el speaker principal (el mas frecuente que no soy yo)

### 4. Funcion matchContactByName(name, contacts)

Busca en `existingContacts` por coincidencia:
- Exacta (case-insensitive)
- Parcial (el nombre detectado esta contenido en el nombre del contacto o viceversa)

### 5. Nuevo flujo en la UI

**Paso 1 - Seleccion de archivos:**
- Input `multiple` para .txt
- Boton "Analizar archivos"
- Al pulsar, parsea todos los archivos y pasa al paso 2

**Paso 2 - Revision:**
- Tabla con cada chat detectado
- Columnas: archivo, speaker detectado, mensajes, contacto vinculado, accion
- Los que tienen match aparecen con check verde
- Los que no, muestran un combobox para vincular o boton "Crear nuevo"
- Boton "Importar todos" para procesar

**Paso 3 - Resultado:**
- Resumen: "4 chats importados, 2 contactos nuevos creados"

### 6. Se mantiene el modo individual

El selector "Vincular a contacto" actual se mantiene como opcion alternativa para subir un solo archivo manualmente vinculandolo a un contacto especifico. Se agregan tabs o un toggle: "Importacion rapida (multiples)" vs "Importacion manual (individual)".

## Archivo a modificar

- `src/pages/DataImport.tsx` (unico archivo)

