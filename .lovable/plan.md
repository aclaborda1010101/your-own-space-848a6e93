
# Plan: Deduplicar contactos y vincular mensajes correctamente

## Diagnostico real

El problema NO es que los mensajes no se almacenan (hay 323,580 mensajes con contenido en `contact_messages`). El problema es que hay **contactos duplicados masivos**:

- "Carls Primo" tiene **34 registros** en `people_contacts`
- Solo 1 de ellos (`c11e37fc-...`) tiene los 2,225 mensajes vinculados
- La UI muestra otro registro (`6596eb3e-...`) que tiene 0 mensajes
- Al pulsar "Analizar IA", el edge function busca mensajes por `contact_id` del registro vacio y no encuentra nada

Esto afecta a muchos contactos: Angel Baena (18 duplicados), Mi Nena (18), Ana Cifuentes (15), CezStar (14), etc.

## Solucion

### Paso 1: Deduplicar contactos en la base de datos

Crear una operacion de limpieza que, para cada nombre duplicado:
1. Identifique el registro "ganador" (el que tiene mayor `wa_message_count` o mas mensajes en `contact_messages`)
2. Reasigne todos los `contact_messages` de los duplicados al registro ganador
3. Acumule los `wa_message_count` en el ganador
4. Preserve los datos de `personality_profile`, `is_favorite`, y `category` del registro mas completo
5. Elimine los registros duplicados

### Paso 2: Prevenir duplicados futuros

Modificar `src/pages/DataImport.tsx` para que al importar contactos de WhatsApp, busque primero si ya existe un contacto con el mismo nombre antes de crear uno nuevo. Usar `upsert` o verificacion previa en vez de `insert`.

### Paso 3: Actualizar wa_message_count del ganador

Recalcular `wa_message_count` desde la tabla `contact_messages` para que refleje el conteo real.

---

## Cambios tecnicos

### Archivo 1: `src/pages/DataImport.tsx`

En la funcion de importacion de contactos (bulk import y whatsapp import), antes de insertar un nuevo contacto:
- Buscar si ya existe en `people_contacts` por nombre normalizado (ignorando mayusculas/espacios extra)
- Si existe, usar el registro existente en vez de crear uno nuevo
- Actualizar `wa_message_count` sumando al valor existente

### Archivo 2: `src/pages/StrategicNetwork.tsx`

Anadir un boton/accion de "Deduplicar contactos" en la pagina, o alternativamente ejecutar la deduplicacion automaticamente al cargar:
- Agrupar contactos por nombre normalizado
- Para cada grupo con duplicados, fusionar en uno solo
- Reasignar mensajes y eliminar duplicados

### Alternativa mas segura: Script SQL de deduplicacion

Ejecutar directamente un script SQL que:

```text
1. Para cada nombre duplicado:
   a. Seleccionar el registro con mayor wa_message_count como "ganador"
   b. UPDATE contact_messages SET contact_id = ganador WHERE contact_id IN (duplicados)
   c. UPDATE people_contacts SET wa_message_count = (SELECT COUNT(*) FROM contact_messages WHERE contact_id = ganador) WHERE id = ganador
   d. DELETE FROM people_contacts WHERE name = X AND id != ganador
```

### Archivo 3: `src/pages/DataImport.tsx` - Prevencion

Modificar `handleBackupImport` y `handleWhatsAppImport` para hacer upsert por nombre en vez de insert, evitando crear duplicados en futuras importaciones.

---

## Secuencia

1. Implementar deduplicacion en StrategicNetwork (boton "Limpiar duplicados" o automatica)
2. Corregir DataImport para prevenir duplicados futuros
3. Los analisis funcionaran inmediatamente despues de deduplicar, ya que el edge function `contact-analysis` ya lee correctamente de `contact_messages` por `contact_id`
