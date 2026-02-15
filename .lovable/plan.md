
# Fix: Las tareas desde sugerencias no se crean

## Problema detectado

El codigo en `Inbox.tsx` y `BrainDashboard.tsx` que inserta tareas al aceptar una sugerencia de tipo "task" **no comprueba el error** del insert en la tabla `tasks`. Si el insert falla por cualquier razon (sesion expirada, error de red, etc.), el error se ignora silenciosamente y el toast dice "Sugerencia aceptada" aunque la tarea nunca se creo.

Linea 170-179 en Inbox.tsx:
```typescript
await supabase.from("tasks").insert({...});
// No se comprueba el error!
```

## Solucion

### Archivo: `src/pages/Inbox.tsx` (lineas 170-179)

Capturar el error del insert y lanzarlo si falla:

```typescript
const { error: taskError } = await supabase.from("tasks").insert({
  user_id: user.id,
  title,
  type: taskType,
  priority,
  duration: 30,
  completed: false,
  source: "plaud",
  description,
});
if (taskError) throw taskError;
```

### Archivo: `src/pages/BrainDashboard.tsx` (lineas 209-218)

Mismo fix - capturar y lanzar el error:

```typescript
const { error: taskError } = await supabase.from("tasks").insert({
  user_id: user.id,
  title,
  type: taskType,
  priority,
  duration: 30,
  completed: false,
  source: "plaud",
  description,
});
if (taskError) throw taskError;
```

### Tambien anadir `onError` a la mutacion

En ambos archivos, anadir un handler `onError` para que el usuario vea el error real:

```typescript
onError: (err: any) => {
  console.error("Error actualizando sugerencia:", err);
  toast.error("Error al procesar sugerencia", { description: err.message });
},
```

## Seccion tecnica

### Archivos modificados

- `src/pages/Inbox.tsx` - Anadir error check al insert de tasks + onError handler
- `src/pages/BrainDashboard.tsx` - Mismo fix

### Diagnostico adicional

Si despues de este fix sigue sin funcionar, el error real aparecera en el toast y en consola, lo que permitira diagnosticar la causa raiz (sesion expirada, RLS, etc.).
