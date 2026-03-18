

# Plan: Mostrar Plauds vinculados con cualquier estado procesado

## Problema

Las transcripciones de Plaud vinculadas a contactos no aparecen porque la query filtra por `processing_status = 'completed'`, pero la mayoría tienen estado `pending_review`. De 13 transcripciones vinculadas en la BD, solo 2 son `completed`.

## Solución

Cambiar el filtro en 3 lugares para incluir tanto `completed` como `pending_review`:

### Archivo 1: `src/components/contacts/ContactTabs.tsx` (linea ~633)
- Cambiar `.eq('processing_status', 'completed')` por `.in('processing_status', ['completed', 'pending_review'])`

### Archivo 2: `src/pages/StrategicNetwork.tsx` (linea ~1303)
- Badge count: mismo cambio de `.eq` a `.in` para incluir `pending_review`

### Archivo 3: `src/pages/StrategicNetwork.tsx` (linea ~1948)
- Query de contactos con Plauds vinculados: mismo cambio

En la UI, se puede mostrar un badge indicando si la transcripcion esta "completada" o "pendiente de revision" para diferenciarlas visualmente.

