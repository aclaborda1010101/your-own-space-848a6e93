

## Diagnóstico

Tres problemas separados, los abordo de raíz:

**1. "Llevan 35 días sin actualizarse"** — Confirmado en BD: 14 contactos en red estratégica, **todos** con `updated_at` > 30 días. El cron `contact-profiles-weekly-refresh` corre sólo domingos 4 AM y la lógica exige "nuevos mensajes desde el último update" (filtro estricto `gt('created_at', updated_at)`); si por idempotencia algunos messages cargados tienen `created_at` viejo, nunca dispara.

**2. "Falta toda la información"** — Encontrado el origen: el componente `<ProfileByScope>` (que muestra perfil psicológico, emocional, percepción mutua, oportunidades de negocio, engaño/interés, próxima acción, pipeline, termómetro, alertas) **se renderiza en `StrategicNetwork.tsx` línea 1704 pero NO en `ContactDetail.tsx`**. La pestaña "Perfil" actual sólo muestra `ProfileKnownData` (datos secos). Por eso parece que se perdió: nunca se montó en la nueva ficha.

**3. "Quiero gráfica temporal de la relación"** — No existe. Hay que construirla desde cero usando los `hitos` que ya genera `contact-analysis` + datos personales del usuario (whoop, check-ins, eventos).

---

## Plan

### Bloque A — Cron diario + trigger por volumen (backend)

1. **Reescribir `contact-profiles-refresh`**:
   - Quitar el filtro "sólo si hay nuevos mensajes desde updated_at" (es lo que está bloqueando todo).
   - Nueva lógica: refresca todo contacto en red estratégica con `updated_at < now() - interval '24 hours'`.
   - Subir `MAX_CONTACTS_PER_RUN` a 30 y reducir `DELAY_BETWEEN_MS` a 3 s.
   - Ejecutar `scopes: ["professional","personal","family"]` + `include_historical: true` para los que nunca se procesaron.

2. **Reprogramar cron**: cambiar de `0 4 * * 0` (domingo) a `0 3 * * *` (cada noche 3 AM Madrid).

3. **Trigger por volumen de WhatsApp**: en `evolution-webhook` (donde ya se inserta cada mensaje), después de cada inserción, contar mensajes en `contact_messages` desde `people_contacts.updated_at`. Si ≥ 30 → invocar `contact-analysis` fire-and-forget para ese contacto. Sin schema nuevo.

4. **Nueva edge function `contact-profiles-refresh-all`**: invocada desde el botón "Actualizar todo" — encola TODOS los contactos de la red sin filtro de antigüedad y devuelve progreso por SSE/polling. Reusa `contact-analysis` por contacto.

### Bloque B — Restaurar el informe completo en la ficha (frontend)

5. **`ContactDetail.tsx`**: añadir bloque `<ProfileByScope>` en la pestaña "Perfil" (encima de `ProfileKnownData`). Cargar `personality_profile`, `historical_analysis`, `contact_links`, lista de contactos del usuario para el linking de menciones (igual patrón que en `StrategicNetwork.tsx`).
   - Selector de ámbito (profesional / personal / familiar) sobre el bloque.
   - Mostrar todas las secciones que ya genera `contact-analysis`: estado actual, percepción mutua (cómo te percibe / cómo lo percibes), pipeline / oportunidades de negocio, alertas (engaño/desinterés/estrés), termómetro, dinámica, próxima acción, sobre qué hablar, red de contactos mencionados con linking.

6. **Botón "Actualizar perfil"** en el header de la ficha: invoca `contact-analysis` para ese contacto solo, con loading + toast + recarga.

7. **Botón "Actualizar toda la red"** en `RedEstrategica.tsx`: ya existe `refreshHeadlines` (sólo cache de novedades). Añado uno nuevo: **"Regenerar perfiles completos"** que invoca `contact-profiles-refresh-all`. Toast con progreso.

### Bloque C — Timeline visual superpuesta (frontend + backend ligero)

8. **Nueva tabla `personal_timeline_events`** (eventos vitales del usuario):
   - `id, user_id, event_date, title, description, sentiment (-5..+5), source (manual|whoop|checkin|task|conversation), source_id, created_at`
   - RLS por `user_id = auth.uid()`
   - Ya tienes datos para popularla automáticamente: `daily_checkins` (mood), eventos WHOOP críticos (recovery <30%), tareas completadas grandes, etc. Auto-import opcional en una segunda iteración; arrancamos con `hitos` extraídos por la IA + entrada manual.

9. **Nuevo componente `RelationshipTimelineChart`** (Recharts):
   - Eje X: fechas (línea de tiempo desde primer mensaje hasta hoy).
   - Eje Y: sentimiento (-5 muy malo .. +5 muy bueno).
   - **Dos líneas superpuestas**:
     - Línea A (color primary): **eventos de la relación** — sacados de `personality_profile.hitos` + `historical_analysis.hitos` + picos/valles de frecuencia mensual de `contact_messages`.
     - Línea B (color accent, semitransparente): **tu vida personal** — sacada de `personal_timeline_events` filtrados al rango de fechas.
   - Puntos clicables con tooltip: fecha, descripción, "cómo estabas tú entonces".
   - Marcadores rojos (eventos malos) y verdes (buenos).
   - Se monta en la pestaña "Resumen" del expediente, encima de la conversación.

10. **Mini edge function `build-relationship-timeline`**: agrega los hitos de la relación (de `personality_profile` + `historical_analysis` + agregados mensuales de `contact_messages`) y los devuelve junto con `personal_timeline_events` del rango. Cacheable 1 día.

---

## Archivos a tocar

**Backend (edge functions + DB)**
- `supabase/functions/contact-profiles-refresh/index.ts` — reescribir lógica
- `supabase/functions/contact-profiles-refresh-all/index.ts` — **nueva**
- `supabase/functions/build-relationship-timeline/index.ts` — **nueva**
- `supabase/functions/evolution-webhook/index.ts` — añadir trigger ≥30 msgs
- Migración: tabla `personal_timeline_events` + RLS + cron diario

**Frontend**
- `src/pages/ContactDetail.tsx` — montar `ProfileByScope`, botón "Actualizar perfil", `RelationshipTimelineChart`
- `src/pages/RedEstrategica.tsx` — botón "Regenerar perfiles completos"
- `src/components/contact/RelationshipTimelineChart.tsx` — **nuevo**
- `src/hooks/useRelationshipTimeline.ts` — **nuevo**
- `src/hooks/useContactProfile.ts` — **nuevo** (centraliza load de profile + links)

---

## Lo que verás después

- Esta noche a las 3 AM (y tras pulsar "Regenerar perfiles") los 14 contactos pasan de "35 días" a "hoy".
- Ficha de Alicia: pestaña Perfil con todo el psicológico/emocional/oportunidades/percepción/próxima acción dividido por ámbito + timeline gráfica con su vida y la tuya superpuestas.
- Cuando entren 30+ WhatsApps de un contacto, su perfil se reanaliza solo en background.
- Botón "Actualizar todos" en la red disponible en cualquier momento.

Sin tocar la estructura visual que ya te gusta — añade información, no la sustituye.

