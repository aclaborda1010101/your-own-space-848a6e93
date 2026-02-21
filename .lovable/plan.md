

# Fix: Datos que desaparecen al cambiar de pantalla

## Causa raiz encontrada

Al investigar la base de datos, encontre que `bl_questionnaire_responses` tiene 4 registros (uno marcado como completado), pero `bl_diagnostics` tiene **0 registros**. La radiografia se genera, se muestra en pantalla desde la respuesta del servidor, pero **nunca se guarda en la base de datos**.

### Por que falla el guardado

En la edge function `ai-business-leverage`, linea 278-291, se usa:

```text
supabase.from("bl_diagnostics").upsert({...}, { onConflict: "project_id" })
```

Pero la tabla `bl_diagnostics` **no tiene un constraint UNIQUE en `project_id`** (solo tiene un indice normal). PostgreSQL requiere un constraint UNIQUE para que el upsert funcione. Sin el, el upsert falla silenciosamente y no inserta nada.

El codigo no comprueba el error del upsert, asi que la funcion continua, devuelve el diagnostico en la respuesta HTTP (por eso se ve en pantalla), pero nada se persiste. Al navegar fuera, el componente se desmonta, el estado local se pierde, y al volver `loadExisting()` no encuentra nada en la base de datos.

## Cambios propuestos

### 1. Migracion SQL: Agregar UNIQUE constraint

```sql
ALTER TABLE bl_diagnostics ADD CONSTRAINT bl_diagnostics_project_id_key UNIQUE (project_id);
```

Esto permite que el upsert funcione correctamente. Como la tabla tiene 0 registros, no hay conflictos.

### 2. Edge function `ai-business-leverage/index.ts`: Agregar control de errores

Despues del upsert, comprobar si hubo error y lanzar excepcion si fallo:

```text
const { data: saved, error: saveError } = await supabase.from("bl_diagnostics").upsert({...});
if (saveError) throw new Error("Failed to save diagnostic: " + saveError.message);
```

Aplicar lo mismo para las demas operaciones de guardado (recommendations, roadmap).

### 3. Hook `useBusinessLeverage.tsx`: Hacer `loadExisting` mas robusto

- Agregar un estado `initialLoading` para mostrar que se estan cargando datos de la base de datos al entrar
- Agregar `try/catch` con logs para depurar si `loadExisting` falla
- Asegurar que si la generacion se interrumpe (el usuario navega), al volver se carguen los datos desde DB

### 4. `BusinessLeverageTabs.tsx`: Mostrar indicador de carga inicial

- Mostrar un spinner mientras `loadExisting` se ejecuta al montar el componente
- Evitar que el usuario vea un estado "vacio" cuando los datos existen en DB pero aun no se han cargado

### 5. Verificar otros upserts similares

Revisando el codigo, hay otros upserts con `onConflict` que podrian tener el mismo problema. Los que ya tienen unique constraints correctos no necesitan cambio. Verificare cada uno.

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| Migracion SQL | UNIQUE constraint en `bl_diagnostics.project_id` |
| `supabase/functions/ai-business-leverage/index.ts` | Control de errores en upserts |
| `src/hooks/useBusinessLeverage.tsx` | Estado `initialLoading`, try/catch en loadExisting |
| `src/components/projects/BusinessLeverageTabs.tsx` | Spinner de carga inicial |

## Resultado esperado

- La radiografia (y recomendaciones, roadmap) se guardan correctamente en la base de datos
- Al cambiar de pantalla y volver, los datos se cargan desde la base de datos
- Si la generacion se interrumpe (el usuario sale), los datos ya guardados por el servidor persisten
- El usuario ve un spinner mientras se cargan los datos existentes, nunca un estado vacio falso

