

## Plan: Página de Consumos IA de la App

### Problema
Actualmente el tracker de costes IA solo existe como una card colapsable dentro de Settings (`AICostTrackerCard`). El usuario quiere una página dedicada con historial detallado de cada llamada individual (no solo agrupaciones), mostrando fecha, operación, modelo, tokens y coste.

### Solución

Crear una nueva página `/ai-costs` con:

1. **Resumen global** (tarjetas): gasto total, llamadas API, tokens entrada/salida
2. **Historial detallado** (tabla paginada): cada registro individual de `project_costs` con columnas:
   - Fecha/hora
   - Operación (edge function)
   - Modelo IA
   - Proyecto (si aplica)
   - Tokens entrada / salida
   - Coste en euros
3. **Filtros**: por modelo, por operación, por rango de fechas
4. **Desgloses** (tabs o secciones): por modelo y por función (reutilizando la lógica existente de `AICostTrackerCard`)
5. **Gráfico de gasto diario** (barras simple) para ver tendencia

### Archivos a crear/modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/AICosts.tsx` | Nueva página completa con historial, filtros, resumen y desgloses |
| `src/App.tsx` | Añadir ruta `/ai-costs` con lazy load |
| `src/components/layout/AppSidebar.tsx` (o equivalente) | Añadir enlace en el menú lateral |

### Datos
- Tabla `project_costs` ya tiene todo: `created_at`, `service` (modelo), `operation`, `tokens_input`, `tokens_output`, `cost_usd`, `project_id`, `user_id`, `metadata`
- No necesita migraciones DB
- Query: `select * from project_costs where user_id = X order by created_at desc`
- Join con `business_projects` para mostrar nombre del proyecto

### UI
- Estilo consistente con el resto de la app (Tailwind, shadcn)
- Tabla con scroll, paginación client-side (o limit 500 + load more)
- Badges de color por modelo
- Formato `€0.0045` para costes pequeños

