

## Diagnóstico: Salud no persiste datos + solo 4 métricas

### Problemas encontrados

**Problema 1: Los datos NO se guardan en la base de datos**
- La tabla `whoop_data` no tiene un constraint UNIQUE en `(user_id, data_date)`.
- El upsert usa `onConflict: "user_id,data_date"` pero sin ese constraint, Supabase devuelve el error: `"there is no unique or exclusion constraint matching the ON CONFLICT specification"`.
- Los logs confirman este error. La fila existente para 2026-03-15 tiene TODOS los campos en NULL.
- Por eso cada vez que entras a /health tienes que volver a sincronizar, y aun así los datos no persisten.

**Problema 2: Solo llegan 4 métricas (strain, calorías, FC media, FC máxima)**
- Los endpoints de Recovery y Sleep de WHOOP devuelven **404 Not Found**.
- Solo el endpoint de Cycle funciona (2 registros), que aporta: strain, calories, avg_hr, max_hr.
- Las 404 pueden deberse a que los endpoints `/developer/v1/recovery` y `/developer/v1/activity/sleep` requieren parámetros diferentes o la cuenta WHOOP no tiene esos datos disponibles en ese rango.

### Plan

1. **Crear constraint UNIQUE en `whoop_data`** - Migración SQL:
   ```sql
   ALTER TABLE whoop_data 
   ADD CONSTRAINT whoop_data_user_date_unique 
   UNIQUE (user_id, data_date);
   ```
   Esto permite que los upserts funcionen y los datos se persistan correctamente.

2. **Corregir endpoints de Recovery y Sleep en `whoop-auth`** - Los endpoints de WHOOP API v1 usan paginación y pueden requerir formatos de query diferentes. Investigar si:
   - Recovery necesita `?start=...&end=...` o si usa un path diferente
   - Sleep usa `/developer/v1/activity/sleep` o simplemente `/developer/v1/sleep`
   - Agregar logging detallado de las URLs y responses para diagnosticar las 404

3. **Manejar filas huérfanas** - Limpiar la fila existente con todos NULLs para 2026-03-15, y ajustar el filtro de upsert para que también persista filas con solo datos de ciclo (actualmente el filtro en línea 297 solo guarda si hay recovery, strain o sleep, pero strain sí está presente así que debería funcionar... el problema es que el upsert falla antes).

4. **Redesplegar `whoop-auth`** con los fixes aplicados.

### Detalle técnico
- La tabla `whoop_data` tiene `id` como PK (uuid) pero ningún constraint unique en `(user_id, data_date)`.
- Tanto `whoop-auth` como `whoop-sync` usan `onConflict: "user_id,data_date"`, así que ambos están afectados.
- El fix del constraint UNIQUE resolverá la persistencia para ambas funciones inmediatamente.

