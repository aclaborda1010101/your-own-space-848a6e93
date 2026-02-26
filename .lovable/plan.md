
Objetivo inmediato: cortar el bucle que quema créditos y dejar el discovery de Bosco avanzando sin reinicios infinitos ni métricas engañosas.

Estado real verificado (ahora):
- Bosco está en `building`, con 11 subdominios definidos.
- Ya hay 8 subdominios visibles en runs; en curso: `Play Therapy` (batches 50 y 52 running), faltan 53–76.
- El problema no es “solo 4 subdominios reales”, es combinación de reintentos duplicados + visualización/contadores inconsistentes.

Plan de implementación (directo):

1) Blindaje definitivo anti-loop en `rag-architect` (todas las salidas por timeout)
- Unificar los 3 puntos de timeout (líneas ~1411, ~1454, ~1525) para usar la misma función `handleTimeoutAndMaybeAdvance`.
- Regla única:
  - contar intentos `partial/running` del par `(rag_id, subdomain, research_level)`.
  - si `>= 3` => marcar run actual `completed` (o `failed_timeout`) y avanzar al siguiente batch.
  - si `< 3` => `partial` + self-kick del mismo batch.
- Resultado: cero loops infinitos por checkpoints no cubiertos.

2) Reducir reintentos caros por 429 (control de costo)
- En academic/frontier: si Semantic Scholar devuelve 429 repetido N veces en el batch, cortar scholar para ese batch y seguir con fallback Perplexity + scrape.
- Mantener progreso de batch aunque falle la fuente académica principal.

3) Corregir cálculo de progreso y cobertura (fuente de verdad)
- Dejar de usar acumuladores incrementales (`rag.total_sources/chunks += batch`) porque con reintentos duplica.
- Recalcular métricas desde DB en cada cierre de batch:
  - `total_sources = count(distinct rag_sources.id where rag_id=...)`
  - `total_chunks = count(*) from rag_chunks where rag_id=...`
  - `coverage_pct = completed_batches_unicos / total_batches`
- `completed_batches_unicos` usando latest run por `(subdomain, level)`.

4) Corregir UI para que nunca “desaparezcan” subdominios
- En `RagBuildProgress`, renderizar grilla desde `domain_map.subdomains` (los 11) x 7 niveles.
- Pintar estado por “latest run” de cada celda; si no existe, mostrar `pending`.
- Así se ven siempre los faltantes y no solo lo que llegó en `research_runs`.

5) Endurecer `handleStatus` para evitar estados falsos
- Basar “all done” en matriz de latest runs por par `(subdomain, level)` y no en `runs.every(...)` histórico.
- No disparar post-build hasta que las 77 celdas estén en estado terminal (`completed|failed_timeout|failed`).

6) Remediación one-shot sobre Bosco al aplicar fix
- Marcar como terminal cualquier `running` huérfano (>10 min) en batch activo.
- Lanzar resume desde el primer batch faltante calculado por matriz latest (no por conteo bruto de runs).
- Dejar pipeline continuar hasta 76 y luego post-build.

Validación obligatoria (para cerrar hoy sin repetir):
- Verificar en DB:
  - no crecen indefinidamente runs `partial` del mismo `(subdomain, level)`.
  - batch index avanza cuando hay 3 timeouts.
  - cobertura refleja celdas únicas (no 100% falso).
- Verificar en UI:
  - aparecen los 11 subdominios siempre.
  - cada nivel cambia de pending → running → completed/failed sin “saltos”.
- Verificar costo:
  - caída clara de reintentos 429 por batch y menos invocaciones repetidas.

Detalles técnicos (resumen):
- Archivos:
  - `supabase/functions/rag-architect/index.ts` (timeout guard unificado, métrica real, status gating).
  - `src/components/rag/RagBuildProgress.tsx` (matriz fija 11x7 con latest status).
  - `src/hooks/useRagArchitect.tsx` (si hace falta, normalizar payload de status para latest runs).
- No se borran chunks existentes.
- Se preserva avance actual y se continúan solo batches pendientes.
