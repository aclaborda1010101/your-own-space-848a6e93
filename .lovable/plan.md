

# Importacion inteligente de grupos WhatsApp

## Problema actual

El backup CSV contiene TODAS las conversaciones en un solo archivo. La columna 0 identifica el chat (individual o grupo), pero el parser actual no distingue entre ellos: trata todo el archivo como una sola conversacion y busca un unico "speaker dominante". Esto hace que en grupos con muchos participantes se pierda informacion valiosa.

## Solucion

### 1. Separar conversaciones por chat_name (Col 0)

Modificar `tryParseBackupCSV` en `src/lib/whatsapp-file-extract.ts` para que, ademas de generar texto plano, pueda devolver los datos agrupados por chat/grupo.

Nueva funcion `parseBackupCSVByChat(lines)` que retorna:
```text
Map<chatName, {
  speakers: Map<senderName, messageCount>,
  totalMessages: number,
  isGroup: boolean  // true si hay 3+ speakers distintos (yo + 2 o mas)
}>
```

### 2. Nuevo flujo de importacion para backup CSV completo

En `DataImport.tsx`, cuando se detecta un CSV de backup:

- **Paso 1**: Parsear y agrupar por chat_name
- **Paso 2**: Mostrar tabla con todas las conversaciones detectadas:
  - Nombre del chat/grupo
  - Numero de participantes
  - Total mensajes
  - Icono de grupo vs individual
  - Accion: importar / saltar
- **Paso 3**: Para chats individuales, el flujo actual (vincular a 1 contacto)
- **Paso 4**: Para grupos, crear/actualizar TODOS los participantes:
  - Cada speaker se busca en la agenda existente (`matchContactByName`)
  - Si no existe, se crea automaticamente en `people_contacts`
  - Se actualiza `wa_message_count` sumando los mensajes de ese contacto
  - Se almacena el grupo como parte de `metadata.groups` del contacto (array de nombres de grupo)

### 3. Enriquecimiento de perfil con datos de grupo

Para cada contacto detectado en grupos:
- `wa_message_count`: se suma el total de mensajes de ese contacto en todos los chats
- `metadata.groups`: lista de grupos donde aparece (ej: `["Familia", "Trabajo equipo"]`)
- `metadata.group_activity`: resumen de actividad por grupo
- `context`: se enriquece con "Activo en grupos: Familia, Trabajo..."

### 4. Deteccion de grupo vs individual

Un chat se considera **grupo** si:
- Tiene 3 o mas speakers unicos (contando al usuario)
- O el nombre del chat NO coincide con ningun speaker individual

Un chat es **individual** si:
- Tiene exactamente 2 speakers (yo + otro)
- O 1 speaker (solo mensajes del otro, sin los mios)

## Cambios tecnicos

### Archivo: `src/lib/whatsapp-file-extract.ts`

- Nueva interfaz `ParsedBackupChat` con campos: chatName, speakers (Map), myMessages, isGroup
- Nueva funcion `parseBackupCSVByChat(text: string, myIdentifiers: string[]): ParsedBackupChat[]`
  - Agrupa lineas por col 0 (chat_name)
  - Para cada grupo, cuenta mensajes por speaker
  - Detecta mensajes "Yo" (Saliente) y los marca como del usuario
  - Clasifica como grupo o individual
- Exportar la nueva funcion

### Archivo: `src/pages/DataImport.tsx`

- Detectar si un archivo subido es un backup CSV completo (muchos chats en 1 archivo)
- Nuevo estado para el flujo de backup: `backupChats: ParsedBackupChat[]`
- Nueva UI de revision: tabla con chats/grupos, checkbox para seleccionar cuales importar
- Para grupos seleccionados: crear/actualizar cada participante en `people_contacts`
- Actualizar `metadata.groups` en cada contacto con los nombres de grupo
- Sumar `wa_message_count` acumulativamente (no reemplazar)

## Archivos a modificar

- `src/lib/whatsapp-file-extract.ts` (nueva funcion de parsing por chat)
- `src/pages/DataImport.tsx` (nuevo flujo UI para backup CSV con grupos)

