

# Plan: Eliminar emojis, corregir filtro de contactos, y mejorar importacion WhatsApp

## Estado actual

- **Emojis**: NO se han eliminado. Quedan ~284 emojis en 19 archivos.
- **Filtro de contactos activos**: NO se ha corregido. Sigue mostrando todos los contactos con `interaction_count > 0` (los 349).
- **Selector de contactos**: Es un dropdown `<Select>` sin busqueda. Con muchos contactos es inusable.
- **WhatsApp multi-archivo**: Solo acepta 1 archivo .txt a la vez. No hay segmentacion automatica.

## Cambios a implementar

### 1. Eliminar todos los emojis (19 archivos)

Reemplazar cada emoji por un icono Lucide equivalente o texto plano segun contexto:

| Archivo | Emojis | Solucion |
|---------|--------|----------|
| `Logs.tsx` | trophy, heart, refresh, check, lightning, smiley | Lucide: `Trophy`, `Heart`, `RotateCcw`, `CheckCircle`, `Zap`, `Smile` |
| `StrategicNetwork.tsx` | mic, chat, star, trophy | Lucide: `Mic`, `MessageCircle`, `Star`, `Trophy` |
| `BrainsDashboard.tsx` | speaker, tv, mute, mic, calendar | Lucide: `Users`, `Monitor`, `VolumeX`, `Mic`, `Calendar` |
| `Communications.tsx` | mic, document, briefcase, heart, family | Lucide: `Mic`, `FileText`, `Briefcase`, `Heart`, `Users` |
| `Settings.tsx` | robot, calendar, globe, wifi | Lucide: `Bot`, `Calendar`, `Globe`, `Wifi` |
| `PublicationsCard.tsx` | fire, rocket, lightning, thought, lightbulb | Lucide: `Flame`, `Rocket`, `Zap`, `MessageCircle`, `Lightbulb` |
| `useFinances.tsx` | lightbulb, phone, family, briefcase, building, money | Texto plano (son labels de categorias) |
| `usePushNotifications.tsx` | warning, clipboard, calendar | Texto plano (son titulos de notificaciones nativas) |
| `ModeSelector.tsx` | warning, palm_tree | Texto plano |
| `GoogleCalendarSettingsCard.tsx` | warning | Lucide: `AlertTriangle` |
| `DaySummaryCard.tsx` | sparkles | Lucide: `Sparkles` |
| `DataImport.tsx` | phone, building | Lucide: `Phone`, `Building2` |
| `WebSocketDebug.tsx` | lightbulb | Lucide: `Lightbulb` |
| `AINews.tsx` | star | Lucide: `Star` |
| Otros archivos menores | emojis dispersos | Lucide equivalente |

### 2. Corregir filtro de contactos activos

En `StrategicNetwork.tsx` linea 447, cambiar:

```text
// Antes: muestra los 349 contactos
return (c.wa_message_count || 0) > 0 || c.is_favorite === true || c.interaction_count > 0;

// Despues: solo los relevantes
return (c.wa_message_count || 0) > 0 || c.is_favorite === true || (c.interaction_count || 0) >= 3;
```

Ademas, cambiar la vista por defecto de "active" a "top100" para que la primera impresion sea mas limpia.

### 3. Selector de contactos con busqueda

Reemplazar el `<Select>` del WhatsApp import en `DataImport.tsx` por un **Combobox** (usando `cmdk` que ya esta instalado):

- Input de texto donde escribes para filtrar contactos
- Dropdown con resultados filtrados
- Se selecciona un contacto haciendo clic
- Misma logica para el boton "Crear nuevo"

### 4. WhatsApp multi-archivo con segmentacion automatica

Modificar la tab WhatsApp en `DataImport.tsx`:

**Opcion A: Subir multiples archivos .txt (uno por chat)**
- Cambiar `<input type="file">` a `multiple`
- Procesar cada archivo individualmente
- Auto-detectar el nombre del contacto del chat (el speaker que no eres tu)
- Cruzar automaticamente contra `phone_contacts` por nombre
- Si hay match, vincular automaticamente; si no, mostrar para revision manual

**Opcion B: Subir un archivo grande con multiples chats**
- Detectar patrones de separacion entre chats (WhatsApp exporta con header de grupo/nombre)
- Segmentar automaticamente por cambios de participantes
- Mostrar lista de chats detectados para confirmar antes de importar

Se implementaran ambas opciones con un selector "Archivo unico" / "Multiples archivos".

**Logica de segmentacion para archivo unico con multiples chats:**
- WhatsApp no exporta multiples chats en un solo archivo nativamente
- La opcion principal sera multi-archivo (mas realista)
- Para archivo unico: se detectara si hay mas de 2 speakers distintos y se ofrecera revision

**Flujo multi-archivo:**
1. Usuario selecciona N archivos .txt
2. Para cada archivo, se detecta el speaker principal (no-yo)
3. Se cruza con `phone_contacts` por nombre (case-insensitive, fuzzy)
4. Se muestra resumen: "12 chats detectados, 8 vinculados automaticamente, 4 requieren revision"
5. El usuario confirma o ajusta las vinculaciones
6. Se insertan/actualizan `people_contacts` con `wa_message_count`

## Archivos a modificar

1. **19 archivos** para eliminacion de emojis
2. **`src/pages/StrategicNetwork.tsx`** - filtro activos + vista default
3. **`src/pages/DataImport.tsx`** - combobox contactos + multi-archivo WhatsApp

## Orden de implementacion

1. Eliminar emojis en los 19 archivos
2. Corregir filtro y vista default en StrategicNetwork
3. Implementar combobox de busqueda de contactos
4. Implementar importacion multi-archivo WhatsApp con auto-matching

