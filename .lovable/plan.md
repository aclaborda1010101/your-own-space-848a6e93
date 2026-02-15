

# Arreglar integracion WHOOP - columna user_id faltante

## Problema

La tabla `jarvis_whoop_data` no tiene columna `user_id`. El hook `useJarvisWhoopData.tsx` intenta filtrar con `.eq("user_id", user.id)`, lo que produce el error:

```
column jarvis_whoop_data.user_id does not exist
```

Columnas actuales de la tabla: `id`, `date`, `recovery_score`, `strain`, `hrv`, `sleep_hours`, `synced_at`.

## Solucion

### Paso 1 - Migracion SQL

Agregar la columna `user_id` a la tabla `jarvis_whoop_data` y anadir las columnas adicionales que el hook espera (`resting_hr`, `sleep_performance`, `data_date`):

```sql
ALTER TABLE jarvis_whoop_data 
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS resting_hr integer,
  ADD COLUMN IF NOT EXISTS sleep_performance integer,
  ADD COLUMN IF NOT EXISTS data_date date;

-- Habilitar RLS
ALTER TABLE jarvis_whoop_data ENABLE ROW LEVEL SECURITY;

-- Politica para que cada usuario vea solo sus datos
CREATE POLICY "Users can view own whoop data" ON jarvis_whoop_data
  FOR SELECT USING (auth.uid() = user_id);
```

### Paso 2 - Ajustar el hook

Actualizar `useJarvisWhoopData.tsx` para que las columnas del SELECT coincidan con las que realmente existen en la tabla (usar `data_date` o `date` segun corresponda y manejar los campos opcionales).

## Resultado

La pagina /health dejara de mostrar error y cargara los datos de WHOOP correctamente cuando existan en la base de datos.
