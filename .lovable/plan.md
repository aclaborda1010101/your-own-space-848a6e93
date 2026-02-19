

# Fix: Fusionar contactos con espacios extra y prevenir futuros duplicados

## Problema

Hay 7 pares de contactos duplicados que difieren solo por espacios extra en el nombre (ej: "Raul  Agustito" vs "Raul Agustito"). Ademas:
- El codigo de `findOrCreateContact` normaliza el **key del Map** pero inserta el nombre **sin normalizar** en la base de datos (linea 237: `name.trim()` no colapsa espacios multiples)
- La pagina de Red Estrategica solo carga 1000 contactos (limite por defecto de Supabase)

## Solucion

### Paso 1: Fusionar los 7 pares duplicados en la base de datos (SQL)

Para cada par:
1. Elegir como "ganador" al contacto con mas mensajes
2. Reasignar los `contact_messages` del perdedor al ganador
3. Sumar `wa_message_count`
4. Normalizar el nombre del ganador (colapsar espacios)
5. Eliminar el perdedor

Pares afectados:
- Bea Lpc (1582 msgs vs 0)
- Gracia Mami Bosco (107 vs 0)
- Javi Agustito (173 vs 0)
- Laura Somosidea (0 vs 0)
- Miguel Hest (429 vs 172)
- Pilar Campojoyma (0 vs 0)
- Raul Agustito (0 vs 0)

### Paso 2: Corregir `findOrCreateContact` en `src/pages/DataImport.tsx`

Cambiar linea 237 de:
```
name: name.trim(),
```
a:
```
name: name.trim().replace(/\s+/g, ' '),
```

Esto garantiza que el nombre guardado en la base de datos tambien tenga los espacios colapsados, igualando la normalizacion del Map key.

### Paso 3: Aumentar limite de carga en Red Estrategica

En `src/pages/StrategicNetwork.tsx` linea 902, agregar `.limit(5000)` a la query de contactos para cargar todos los registros.

## Archivos modificados

1. `supabase/migrations/xxx_merge_space_duplicates.sql` - Fusionar los 7 pares y normalizar nombres
2. `src/pages/DataImport.tsx` - Normalizar espacios al insertar (1 linea)
3. `src/pages/StrategicNetwork.tsx` - Agregar `.limit(5000)` a la query
