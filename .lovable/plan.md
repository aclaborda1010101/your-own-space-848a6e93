

# Arreglar la integracion WHOOP: unificar tablas y datos

## Problema detectado

Existen **dos tablas separadas** para datos de WHOOP que no estan conectadas entre si:

- `whoop_data`: tabla donde las edge functions (`whoop-auth`, `whoop-sync`) guardan los datos. Esta **vacia**.
- `jarvis_whoop_data`: tabla que el hook `useJarvisWhoopData` lee en la pagina /health. Tiene 1 registro pero con `user_id = NULL` y casi todos los campos vacios.

El hook de la pagina Health lee de una tabla que las funciones de sincronizacion nunca llenan.

## Solucion

### Paso 1 - Unificar: hacer que el hook lea de `whoop_data`

Modificar `useJarvisWhoopData.tsx` para que lea de la tabla `whoop_data` en lugar de `jarvis_whoop_data`. Esta es la tabla que realmente se llena con datos cuando se sincroniza via `whoop-auth` o `whoop-sync`.

### Paso 2 - Asegurar RLS en `whoop_data`

Verificar y configurar RLS en la tabla `whoop_data` para que cada usuario solo vea sus propios datos.

### Paso 3 - Actualizar la pagina Health para incluir boton de sincronizacion manual

Agregar un boton en la pagina `/health` que permita al usuario:
- Conectar WHOOP si no esta conectado (usando el hook `useWhoop` existente)
- Sincronizar datos manualmente (llamando a `fetchData` de `useWhoop`)

Esto es necesario porque actualmente la pagina solo muestra datos pasivos pero no tiene forma de conectar ni sincronizar.

### Paso 4 - Combinar ambos hooks

Hacer que la pagina Health use `useWhoop` (que ya tiene la logica de conexion, sincronizacion y OAuth callback) como fuente principal, en vez del hook `useJarvisWhoopData` que solo lee una tabla incorrecta.

## Seccion tecnica

### Archivo: `src/pages/Health.tsx`

- Reemplazar `useJarvisWhoopData` por `useWhoop`
- Agregar botones de "Conectar WHOOP" y "Sincronizar" segun el estado de conexion
- Mapear los datos de `useWhoop` al formato que espera la UI

### Archivo: `src/hooks/useWhoop.tsx`

- Sin cambios necesarios, ya tiene toda la logica correcta

### Migracion SQL

- Habilitar RLS en `whoop_data` si no esta habilitado
- Crear politica SELECT para que usuarios vean solo sus datos

### Resultado

La pagina /health mostrara el flujo completo: conectar WHOOP via OAuth, sincronizar datos, y visualizar recovery, strain, HRV, sueno y FC en reposo.

