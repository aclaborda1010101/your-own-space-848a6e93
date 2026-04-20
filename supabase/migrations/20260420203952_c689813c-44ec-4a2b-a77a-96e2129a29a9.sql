-- Invalidar briefs cacheados de "tomorrow" para forzar regeneración con datos reales de iCloud
DELETE FROM public.daily_briefs
WHERE scope = 'tomorrow'
  AND brief_date >= CURRENT_DATE;

-- También limpiar el "health" y "nutrition" de hoy si están cacheados (no usan calendario, pero por consistencia tras el fix)
DELETE FROM public.daily_briefs
WHERE scope IN ('health', 'nutrition')
  AND brief_date = CURRENT_DATE
  AND (context_snapshot->>'cal_count')::int = 0;