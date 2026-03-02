

## Plan: Tareas/Eventos personales vs compartidos + Panel de compartir en Ajustes

### Concepto
Actualmente, al compartir el modulo "task" o "calendar", se comparten TODAS las tareas/eventos. El usuario quiere poder marcar items individuales como "personal" para que NO se compartan aunque el modulo este compartido.

### Cambios

**1. SQL Migration** — Columna `is_personal` en `tasks`
```sql
ALTER TABLE tasks ADD COLUMN is_personal BOOLEAN NOT NULL DEFAULT false;
```
- Actualizar la politica RLS SELECT de tasks para excluir items personales del sharing:
  - Owner siempre ve todo
  - Shared users solo ven items donde `is_personal = false`

**2. Actualizar RLS de tasks**
```sql
DROP POLICY "Users can view own or shared tasks" ON tasks;
CREATE POLICY "Users can view own or shared tasks" ON tasks FOR SELECT USING (
  auth.uid() = user_id 
  OR (
    is_personal = false 
    AND has_shared_access(auth.uid(), 'task', id)
  )
);
```
Mismo patron para UPDATE (shared-edit solo si `is_personal = false`).

**3. Hook `useTasks.tsx`**
- Anadir `isPersonal` al interface `Task`
- Pasar `is_personal` en `addTask()` y en el mapeo de `fetchTasks()`
- Nuevo parametro opcional en `addTask`: `isPersonal?: boolean`

**4. UI de crear tarea** (`Tasks.tsx`)
- Anadir toggle/switch "Personal" junto a los botones de tipo al crear tarea
- Icono candado cuando `isPersonal = true` en la lista de tareas

**5. Nuevo componente `SharingManagerCard.tsx`** en Settings
- Reemplaza el simple `SharedWithMeCard` con un panel completo de gestion
- Input email + boton anadir usuario
- Lista de usuarios con los que compartes
- Por cada usuario: checkboxes para cada modulo (Proyectos, Tareas, RAG, Auditorias, Contactos, Calendario, Datos, Detector, Check-in)
- Boton "Seleccionar todo" / "Deseleccionar todo"
- Usa `useSharing()` internamente

**6. Settings.tsx**
- Anadir nueva seccion "Compartir con otros" con `SharingManagerCard`
- Mantener "Compartido conmigo" (`SharedWithMeCard`) separado debajo

### Archivos a modificar
1. SQL migration — `is_personal` + RLS update
2. `src/hooks/useTasks.tsx` — campo `isPersonal`
3. `src/pages/Tasks.tsx` — toggle personal al crear + icono en lista
4. `src/components/settings/SharingManagerCard.tsx` — nuevo componente
5. `src/pages/Settings.tsx` — anadir seccion compartir

