
El usuario quiere que YO ejecute la importación directamente desde el sandbox (con el CSV/XLSX que ya subió), en vez de hacerla él desde la UI. Razón: la UI no está cogiendo bien algunos contactos (Juan Jácome, Obra Militar...) cuyos teléfonos están en la columna AM/Nota.

## Plan

Ejecutar la importación de teléfonos directamente contra la BD usando el XLSX que subió, sin depender de la UI:

1. **Leer el XLSX** (`Contactos_-_2026-02-19_08_05_00-3.xlsx`) en el sandbox con Python (openpyxl/pandas).
2. **Extraer teléfonos** de TODAS las columnas relevantes:
   - Columna I (`Teléfono móvil`) y resto de columnas de teléfono.
   - Columna AM (`Nota`) — regex para `+34...`, `6XX...`, `7XX...`, `9XX...`.
3. **Normalizar** a formato `34XXXXXXXXX` (quitar `+`, espacios, guiones; añadir `34` si es número español de 9 dígitos).
4. **Match contra `people_contacts`** del usuario (Agustín):
   - Por nombre normalizado (sin tildes, lowercase).
   - Por cualquier teléfono ya existente en `wa_id` o `phone_numbers`.
5. **Update directo via psql/INSERT tool**:
   - Si existe y le falta `wa_id` → poner el primer móvil válido.
   - Mergear `phone_numbers` (unión sin duplicados).
   - **No tocar** ningún otro campo.
6. **Resolver colisiones**: si el `wa_id` que voy a poner ya existe en otro contacto fantasma → mover mensajes al real y borrar el fantasma.
7. **Limpiar `contact_headlines`** de los contactos tocados para que se regeneren.
8. **Reporte final** en chat: cuántos enriquecidos, cuántos fantasmas mergeados, cuántos sin match (los que habría que crear nuevos), y mostrar concretamente qué pasó con "Juan Jácome" y "Obra Militar" para confirmar que se arreglaron.

## Lo que NO voy a hacer

- No tocar la UI de import (ya está, queda como fallback).
- No crear contactos nuevos masivamente — solo enriquecer los existentes. Si hay nombres del XLSX que no matchean con ningún contacto en BD, los listo al final para que decidas si los quieres crear.

## Archivos / acciones

- Script Python en `/tmp/enrich_contacts.py` (efímero) para parsear XLSX y generar SQL.
- Llamadas `psql` + insert tool para los UPDATE/DELETE sobre `people_contacts`, `contact_messages`, `contact_headlines`.
- Sin cambios en código de la app.

## Resultado esperado

- Juan Jácome, Obra Militar y el resto de contactos con teléfono en la columna Nota pasan a tener `wa_id` + `phone_numbers` correctos.
- WhatsApp entrante de esos números los encuentra y deja de crear duplicados.
- Reporte exacto de qué se tocó.
