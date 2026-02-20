
# Limpieza de contactos basura y verificacion UI

## Problema detectado

Hay **88 contactos basura** en `people_contacts` cuyos nombres son frases enteras, coordenadas GPS o fragmentos de texto mal parseados durante la importacion de WhatsApp. Ejemplos:

- "le podemos hacer un *vale regalo*..." (217 caracteres)
- "ES,,Ubicacion,40 26 6 N 3 42 6 W" (coordenadas GPS)
- "creo que lo mejor seria escribir a la tutora..." (frases)
- "cartel roto de Gas 24h..." (descripciones)

Estos contaminan la lista de contactos y dificultan la navegacion.

## Criterios de deteccion (conservadores)

Se eliminaran contactos que cumplan CUALQUIERA de estas condiciones:
1. Nombre con mas de 40 caracteres (todos son basura confirmada)
2. Nombre contiene "Ubicacion" (coordenadas GPS parseadas como contactos)
3. Nombre entre 31-40 caracteres que empieza en minuscula (frases)
4. Nombre entre 31-40 caracteres que empieza con "ES " (coordenadas)

Se **preservan** los 3 contactos reales detectados en ese rango:
- "Valentyna Zalievska Language School" (37 msgs)
- "Javier Calduch - Psicologia Deportiva" (46 msgs)
- "Alejandro Contabilidad Control De Costes" (195 msgs)

## Solucion en 2 pasos

### Paso 1: Eliminar mensajes huerfanos

Borrar primero los registros de `contact_messages` vinculados a estos contactos basura (necesario por la FK):

```text
DELETE FROM contact_messages
WHERE contact_id IN (
  SELECT id FROM people_contacts
  WHERE (
    LENGTH(name) > 40
    OR name LIKE '%Ubicación%'
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name ~ '^[a-záéíóúñ]')
    OR (LENGTH(name) BETWEEN 31 AND 40 AND name LIKE 'ES %')
  )
  AND name NOT IN (
    'Valentyna Zalievska Language School',
    'Javier Calduch - Psicología Deportiva',
    'Alejandro Contabilidad Control De Costes'
  )
);
```

### Paso 2: Eliminar contactos basura

Borrar los 88 contactos basura de `people_contacts` y cualquier referencia en `contact_links`:

```text
DELETE FROM contact_links
WHERE source_contact_id IN (...) OR target_contact_id IN (...);

DELETE FROM people_contacts
WHERE (mismos criterios);
```

### Paso 3: Verificar UI

Recargar la pagina de Strategic Network y confirmar que:
- Los contactos reales (Raul Agustito, Xuso, etc.) muestran sus mensajes correctamente
- No aparecen contactos con nombres de frases largas
- El conteo total baja de 1141 a ~1053

## Impacto

- **88 contactos eliminados** (todos basura confirmada)
- **~414 mensajes eliminados** (vinculados a esos contactos basura - eran mensajes mal asignados durante el parsing)
- **0 contactos reales afectados** - los 3 contactos legitimos con nombre largo se preservan explicitamente
- No se necesitan cambios en el codigo frontend
