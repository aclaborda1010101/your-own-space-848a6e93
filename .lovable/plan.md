

# Plan: Corregir Error "failed send request function" en JARVIS Realtime

## Problema Identificado

Después de investigar el código y la documentación de OpenAI Realtime API:

1. **Funciones no implementadas**: El edge function `jarvis-voice` define 9 funciones (`create_task`, `complete_task`, `create_event`, `delete_event`, `list_pending_tasks`, `get_today_summary`, `get_my_stats`, `ask_about_habits`, `log_observation`), pero el hook `useJarvisRealtime.tsx` solo implementa 6 de ellas.

2. **Funciones faltantes**:
   - `get_my_stats` - No implementada
   - `ask_about_habits` - No implementada  
   - `delete_event` - No implementada

3. **Formato de respuesta**: Cuando OpenAI llama a una función no implementada, el código devuelve `{ error: "Función X no implementada" }` lo cual puede causar el error "failed send request function".

## Cambios Necesarios

### 1. Implementar funciones faltantes en useJarvisRealtime.tsx

| Función | Implementación |
|---------|----------------|
| `get_my_stats` | Consultar racha de días, sesiones pomodoro, tareas completadas |
| `ask_about_habits` | Consultar insights de hábitos desde `habit_insights` o usar jarvis-coach |
| `delete_event` | Llamar a `icloud-calendar` con action: 'delete' |

### 2. Mejorar manejo de errores

Asegurar que las respuestas de función siempre tengan un formato válido que OpenAI pueda procesar.

## Detalle Técnico

```typescript
// Nuevas implementaciones en useJarvisRealtime.tsx

case 'get_my_stats': {
  const today = new Date();
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  
  const [{ data: pomodoros }, { data: tasks }, { data: checkIns }] = await Promise.all([
    supabase.from('pomodoro_sessions')
      .select('id')
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('tasks')
      .select('id, completed')
      .gte('created_at', weekAgo.toISOString()),
    supabase.from('check_ins')
      .select('date')
      .gte('date', weekAgo.toISOString().split('T')[0])
      .order('date', { ascending: false }),
  ]);
  
  const streak = checkIns?.length || 0;
  const tasksCompleted = tasks?.filter(t => t.completed).length || 0;
  const totalTasks = tasks?.length || 0;
  const pomodoroCount = pomodoros?.length || 0;
  
  return JSON.stringify({
    weeklyStreak: streak,
    pomodoroSessions: pomodoroCount,
    tasksCompleted,
    totalTasks,
    completionRate: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0,
  });
}

case 'ask_about_habits': {
  const { data: insights } = await supabase
    .from('habit_insights')
    .select('insight_type, insight_text, created_at')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (!insights?.length) {
    return JSON.stringify({ 
      message: 'Aún no hay suficientes datos para generar insights sobre hábitos.',
      suggestion: 'Continúe usando la app durante unos días más.' 
    });
  }
  
  return JSON.stringify({
    question: args.question,
    insights: insights.map(i => ({
      type: i.insight_type,
      text: i.insight_text,
    })),
  });
}

case 'delete_event': {
  const { data, error } = await supabase.functions.invoke('icloud-calendar', {
    body: {
      action: 'delete',
      title: args.event_title,
    },
  });
  
  if (error) throw error;
  return JSON.stringify({ success: true, deleted: args.event_title });
}
```

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useJarvisRealtime.tsx` | Añadir implementación de `get_my_stats`, `ask_about_habits`, `delete_event` |

## Resultado Esperado

- Todas las funciones que JARVIS puede llamar tendrán implementación real
- No habrá más errores "failed send request function"
- JARVIS podrá responder con información real sobre estadísticas, hábitos y eliminar eventos

