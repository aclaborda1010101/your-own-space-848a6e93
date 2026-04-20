

## Plan: marcar asunto pendiente como "ya hecho / descartado" y que JARVIS no insista

### Diagnóstico (confirmado en BD)

Alicia Martínez tiene en `contact_headlines.payload.pending.title` = **"Añadir música a vídeo de casting"** (`freshness=active`, generado el 20/4 con 291 mensajes). El usuario dice que ese asunto ya se hizo, pero el sistema lo seguirá mostrando hasta que entren ≥20 mensajes nuevos o caduque solo. Hoy no hay forma de decirle "esto ya está hecho".

Además ese mismo título reaparece como **"Asunto pendiente"** en el bloque "Temas y tono" → es la misma fuente (`payload.pending.title`).

### Causas

1. **Bloque hero "JARVIS sugiere"** sólo tiene "Aceptar y agendar" + "Ver evidencia". Falta **"Hecho"** y **"Descartar"**.
2. La cache de headlines no guarda decisiones del usuario → al regenerar, el LLM vuelve a proponer lo mismo porque sigue viendo el hilo de mensajes original.
3. **"Asunto pendiente"** dentro de "Temas y tono" es un eco del mismo `pending.title` → si limpiamos la cabecera, también desaparece de ahí.

### Cambios

**1. Nueva tabla `contact_headline_dismissals` (migración)**
Registra qué asuntos se marcaron como hechos/descartados/pospuestos para cada contacto. Reutiliza la misma normalización de firma que `detect-task-signals` para que variantes léxicas no escapen.
```
id, user_id, contact_id, signature, original_title,
decision ('done'|'dismissed'|'snoozed'), decided_at, expires_at
```
RLS por `user_id`. Índice `(user_id, contact_id)`.

**2. UI — botones de decisión en `JarvisSuggestionHero`**
Añadir dos acciones nuevas al hero (junto a "Aceptar y agendar"):
- **"Ya está hecho"** (success outline, `Check`) → marca `done`.
- **"No aplica"** (ghost, `X`) → marca `dismissed`.

Ambas escriben en `contact_headline_dismissals`, invalidan la cache local del hook y disparan `refresh(true)` del headline para que JARVIS proponga otra cosa.

**3. `get-contact-headlines` con memoria**
Antes de llamar al LLM:
- Cargar las últimas N (≈10) decisiones del contacto.
- Inyectarlas en el prompt como bloque **"YA RESUELTO / DESCARTADO POR EL USUARIO — NO PROPONGAS ESTO NI SUS VARIANTES"** (mismo patrón que ya usamos en `detect-task-signals`).
- Tras generar el `pending.title`, normalizar firma y comparar contra dismissals: si coincide → forzar `title="Sin asunto vivo"` y `freshness="stale"` para que el front caiga en el fallback de `proxima_accion`.

**4. ContactDetail.tsx — invalidación inmediata**
Tras "Hecho/Descartar", llamar `refresh(true)` del hook headlines (ya existe `refresh` en `useContactHeadlines`). El hook `pending.title` desaparece del hero **y** del bloque "Asunto pendiente" en Temas/Tono, porque ambos leen el mismo campo.

### Out of scope
- No tocamos la generación de "Próxima acción recomendada" (viene de `personality_profile`, ya está bien).
- No tocamos el sistema de `suggestions` (bandeja de inteligencia) — ya tiene su propia memoria desde el cambio anterior.

### Archivos a tocar
- **Migración** nueva: tabla `contact_headline_dismissals` + RLS.
- `src/components/contact/JarvisSuggestionHero.tsx` — añadir props `onMarkDone`, `onMarkDismissed` y dos botones.
- `src/pages/ContactDetail.tsx` — handlers que insertan el dismissal y llaman `refresh(true)`.
- `src/hooks/useContactHeadlines.ts` — exponer la firma del título actual (para crear el dismissal con la misma normalización).
- `supabase/functions/get-contact-headlines/index.ts` — cargar dismissals, inyectar al prompt, sobreescribir `pending` si el LLM repite algo dismissed.

### Resultado esperado
Hoy en Alicia: pulsar **"Ya está hecho"** en "Añadir música a vídeo de casting" hará que (a) desaparezca del hero, (b) desaparezca del bloque "Asunto pendiente" en Temas/Tono, (c) JARVIS no lo vuelva a proponer aunque la conversación lo siga mencionando, (d) el hero caiga al fallback de la "próxima acción recomendada" del perfil.

