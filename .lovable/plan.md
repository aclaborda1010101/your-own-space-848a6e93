

## Plan: Auto-rellenar Check-in desde datos WHOOP

### Problema
Cuando inicias el dia, los sliders de energia/mood/focus empiezan en 3 (valor por defecto). Pero ya tenemos datos reales de WHOOP (recovery, HRV, sleep) que pueden derivar valores mas precisos automaticamente.

### Logica de mapeo WHOOP → Check-in

```text
WHOOP recovery_score (0-100) → energy (1-5)
  0-20  → 1    40-60 → 3    80-100 → 5
  20-40 → 2    60-80 → 4

WHOOP sleep_performance (0-100) → mood (1-5)
  Misma escala que recovery

WHOOP HRV (relativo al baseline) → focus (1-5)
  HRV < 30  → 2    30-50 → 3    50-70 → 4    70+ → 5

WHOOP recovery → dayMode
  < 33% → "survival"    33-66% → "balanced"    > 66% → "push"
```

### Cambios

**1. `src/hooks/useCheckIn.tsx`**
- Importar `useJarvisWhoopData` (o recibir datos WHOOP como parametro)
- Cuando NO hay check-in registrado hoy y SI hay datos WHOOP de hoy, calcular los defaults desde WHOOP en vez de usar `{energy: 3, mood: 3, focus: 3}`
- Mostrar que los valores vienen de WHOOP (flag `prefilled: boolean`)

**2. `src/components/dashboard/CheckInCard.tsx`**
- Mostrar un badge "Pre-rellenado desde WHOOP" cuando los datos se auto-popularon
- El usuario puede ajustar manualmente antes de registrar

**3. `src/pages/StartDay.tsx`**
- Sin cambios directos necesarios: ya usa `useCheckIn()` que se auto-rellena

### Implementacion
- Crear funcion `mapWhoopToCheckIn(whoopData)` que convierte metricas WHOOP a valores check-in
- En `useCheckIn`, al cargar: si no hay check-in hoy, consultar `whoop_data` del dia y pre-rellenar
- Mantener editabilidad completa: WHOOP sugiere, el usuario confirma

