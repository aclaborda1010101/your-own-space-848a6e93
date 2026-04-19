
El usuario aprueba el plan con 3 ajustes:
1. Usar OpenAI TTS para narrator (más barato). Verificar OPENAI_API_KEY → ya está en secrets ✅
2. Aceptar scrub por segmento en MVP, mostrar tira visual de segmentos
3. Activar pg_cron y pg_net en Supabase (lo hago en la migración)

Buenas noticias: `OPENAI_API_KEY` ya está configurada. Ajusto el plan a opción **(b)**.

## Plan final consolidado

### Stack TTS
- **Narrator**: OpenAI TTS (`tts-1`, voz "nova") → ~0.05€/segmento ✅
- **Dialogue**: ElevenLabs Turbo v2.5 con 2 voces (Sarah + Brian) → ~0.30€/segmento
- **Guion**: Lovable AI Gateway (Gemini 2.5 Flash) — sin secret extra

### Fase 1 — Backend
**Migración SQL** (incluye `CREATE EXTENSION IF NOT EXISTS pg_cron; pg_net;`):
- `contact_podcasts`, `contact_podcast_segments`, `contact_headlines`, `podcast_generation_queue` + RLS por `user_id`
- Bucket privado `contact-podcasts` con políticas `{userId}/...`
- Cron `process-podcast-queue` cada minuto vía `pg_net`

**Edge Functions nuevas**:
- `generate-contact-podcast-segment` — delta 100 msgs, prompt con `accumulated_summary`, OpenAI TTS o ElevenLabs según formato, sube a Storage, actualiza tablas.
- `get-contact-headlines` — Gemini sobre últimos 200 msgs → 3 titulares, cachea, invalida cada 20 msgs nuevos.
- `process-podcast-queue` — desencola e invoca generador.

**Modificación `evolution-webhook`**: tras persistir, si `count(messages) % 100 == 0` y último mensaje hace >5 min → encola.

### Fase 2 — Diseño
- Tokens en `index.css` (background `#0A0B10`, glass, fonts Inter Display + Instrument Serif + JetBrains Mono).
- `tailwind.config.ts` con sombras halo índigo, accents turquesa/rosa.
- `<GlassCard>` wrapper.

### Fase 3 — Red Estratégica
- `src/pages/RedEstrategica.tsx`: hero + filtros (relación, salud, actividad, tiene podcast) + toggle vista (Tarjetas / Lista densa / Mapa placeholder) + grid `ContactCard`.
- `ContactCard` + `HealthMeter` (gradiente rojo→verde 0-10).

### Fase 4 — Ficha de contacto
- `src/pages/ContactDetail.tsx` en `/red-estrategica/:contactId`: header con avatar grande, nombre serif, botones (Llamar, WhatsApp, Recordatorio); 3 `HeadlineCard`; `PodcastPlayer` con **tira de segmentos visual** (Seg 1 · Seg 2 · Seg 3, scrub por segmento, tooltip "El scrub funciona dentro de cada segmento — concatenación completa próximamente"); detalle (timeline mensual, quotable moments, mini grafo placeholder, notas, historial podcasts).
- `useContactPodcast(contactId)` con polling 5s mientras `generating`, signed URLs 1h, `regenerate()`, `setFormat()`.
- `useContactHeadlines(contactId)`.

### Fase 5 — Compatibilidad
- Mantener rutas viejas (`/strategic-network`) → redirect a `/red-estrategica`.
- No tocar dashboard, saludo, otras secciones.

### Lo que NO hago
ffmpeg server-side, transcripción de audios WhatsApp, Spotify/RSS, push, sync multi-dispositivo, detección automática tipo relación. Mini grafo y mapa de red = placeholders.

### Acciones manuales tras pegar
- Verificar en Supabase Dashboard → Database → Extensions que `pg_cron` y `pg_net` están en verde tras la migración (la migración intenta activarlos; si falla por permisos, el usuario los activa con un click).
- `OPENAI_API_KEY` ya está ✅, `ELEVENLABS_API_KEY` ya está ✅.

Tras ejecutar entregaré: lista de archivos creados/modificados + estado de extensiones + URL de logs de cada edge function.
