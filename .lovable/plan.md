

## Plan: Command Center sin Check-in, con datos de Salud de Whoop

### Cambio respecto al plan anterior
Eliminar la seccion "Estado" basada en check-in. En su lugar, usar los datos de Whoop (recovery, HRV, sleep, strain) del hook `useJarvisWhoopData` que ya existe y trae el ultimo registro sincronizado.

### Nuevo componente: `CommandCenterCard.tsx`

4 secciones en una sola Card:

**1. Salud (Whoop)**
- Usa `useJarvisWhoopData()` para obtener recovery_score, hrv, sleep_hours, strain, resting_hr
- Muestra badges de color: recovery verde/amarillo/rojo, horas de sueno, HRV, strain
- Si no hay datos: badge "Sin datos Whoop" con link a /health

**2. Tareas prioritarias**
- Filtrar `tasks` (props) por `!completed` y prioridad P0/P1, top 3
- Mostrar toggle de completar inline
- Count total pendientes + link a /tasks

**3. Contactos pendientes**
- Query a `people_contacts` extrayendo `proxima_accion` de cada scope dentro de `personality_profile` (profesional/personal/familiar)
- Filtrar donde `proxima_accion.cuando <= hoy`
- Mostrar nombre, canal sugerido, pretexto resumido (max 3 contactos)
- Link a /strategic-network

**4. Calendario de hoy**
- Filtrar `events` (props) por fecha de hoy
- Mostrar hora + titulo (max 5 eventos)
- Si no hay: "Sin eventos hoy"

### Cambios en Dashboard.tsx
- Reemplazar `<DaySummaryCard />` por `<CommandCenterCard />` pasando `tasks`, `events`, `toggleComplete`
- Mantener el saludo y fecha dentro del CommandCenterCard (reusar logica de DaySummaryCard)
- Eliminar la seccion "Red de Contactos" del fondo del dashboard (se integra en el Command Center)
- Eliminar import de `DaySummaryCard` y el bloque de contactos hardcodeado

### Query para contactos pendientes
```sql
-- Se hara desde el componente con supabase-js
SELECT id, name, wa_id, phone_numbers, brain,
  personality_profile->'profesional'->'proxima_accion' as pa_pro,
  personality_profile->'personal'->'proxima_accion' as pa_per,
  personality_profile->'familiar'->'proxima_accion' as pa_fam
FROM people_contacts
WHERE personality_profile IS NOT NULL
  AND in_strategic_network = true
```
Luego filtrar en JS donde cualquier `cuando <= today`.

### Archivos
- **Crear**: `src/components/dashboard/CommandCenterCard.tsx`
- **Editar**: `src/pages/Dashboard.tsx` (reemplazar DaySummaryCard, eliminar bloque contactos)
- **Sin cambios backend**

