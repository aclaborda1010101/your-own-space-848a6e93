
## Diagnóstico

`Adolfo Alvaro Benito` está en el XLSX con teléfonos (`34627460836`, `34914200544`), pero el `mac-import-direct` no lo enriqueció porque el match por nombre falló en algún punto (probablemente normalización de tildes/espacios distinta entre lo que generé en Python y lo que tenía la BD, o el contacto se cargó después del momento del run).

Esto significa que **hay más casos como Adolfo** entre los 970 contactos viejos que siguen sin teléfono. El reporte dijo "304 enriquecidos" — pero seguramente había bastantes más matcheables que se escaparon.

## Plan: re-pasada de enriquecimiento usando SQL directo

En vez de volver a tirar la edge function (que ya borré + tenía bugs de normalización), hago el match **directamente en SQL** dentro de la BD usando `unaccent` de Postgres, que es lo que mejor normaliza:

1. La tabla `_tmp_mac_import` sigue viva con los 1.779 registros del XLSX.
2. Hago un `UPDATE` de `people_contacts` cruzando por `unaccent(lower(name))` igualados, donde el contacto en BD tenga `wa_id IS NULL` Y `phone_numbers IS NULL`.
3. Para cada match: pongo `wa_id = desired_wa` y `phone_numbers = phones` del staging.
4. Limpio `contact_headlines` de los IDs tocados para que se regeneren con la info correcta.
5. Reporte: cuántos enriquecidos extra, y verifico explícitamente Adolfo + 4-5 ejemplos más.

Como es un `UPDATE` masivo, lo hago vía migración (única forma de updates sin pasar por edge function).

## Lo que NO hago

- No toco contactos que ya tienen `wa_id` (no sobrescribo).
- No creo nuevos.
- No toco UI ni código de la app.

## Resultado esperado

- Adolfo Álvaro Benito y el resto de "huérfanos por bug de normalización" pasan a tener su teléfono.
- Reporte con número exacto de enriquecidos extra y verificación de Adolfo.

¿Tiro?
