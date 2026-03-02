

## Plan: Make tasks editable (content + permissions)

### Current state
- Tasks can only be created with title, type (work/life/finance), and personal toggle
- No way to edit a task after creation — no `updateTask` function in `useTasks.tsx`
- Priority is hardcoded to "P1" and duration to 30 min on creation
- No edit UI exists

### Changes

**1. `useTasks.tsx` — Add `updateTask` function**
- New function `updateTask(id, updates)` that accepts partial fields: `title`, `type`, `priority`, `duration`, `isPersonal`
- Updates Supabase and local state

**2. New component `EditTaskDialog.tsx`**
- Dialog that opens when clicking on a task
- Fields: title (input), type (work/life/finance buttons), priority (P0/P1/P2 select), duration (number input), personal toggle (switch)
- Save button calls `updateTask`

**3. `SwipeableTask.tsx` — Add edit trigger**
- Add `onEdit` callback prop
- Add a pencil/edit icon button next to the pomodoro/calendar buttons
- Pass the full task to `onEdit` when clicked

**4. `Tasks.tsx` — Wire edit dialog**
- Add state for `editingTask`
- Render `EditTaskDialog` with the selected task
- Pass `onEdit` handler to `SwipeableTask`
- Pass `updateTask` from the hook

### Files to modify
1. `src/hooks/useTasks.tsx` — add `updateTask`
2. `src/components/tasks/EditTaskDialog.tsx` — new component
3. `src/components/tasks/SwipeableTask.tsx` — add edit button + `onEdit` prop
4. `src/pages/Tasks.tsx` — wire dialog and state

