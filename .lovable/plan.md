

## Qué está pasando

He encontrado los **dos problemas exactos**:

### 1) Las tareas se crean solas — culpable: `contact-analysis`
Cuando tú (o el sistema) abre/analiza un contacto, la edge function `contact-analysis` ejecuta al final un bloque "syncedTasks" que coge las `acciones_pendientes` del perfil generado por la IA (Adolfo, IVA, Guadalupe, Cristo, etc.) y **las inserta directamente como `tasks`**, saltándose por completo la bandeja de inteligencia.

Por eso ves en `/tasks` cosas tipo *"Confirmar si el perro de Alicia se recuperó"*, *"Devolver el dinero de más"*, *"Cuadrar cita pendiente para verse tras su regreso de Barcelona"* — son sugerencias de la IA aplicadas como hechos.

Lo correcto es que esas mismas acciones entren en `suggestions` con `status='pending'`, que es lo que ya pinta `IntelligenceInbox` (pestaña "Bandeja de inteligencia").

### 2) En el menú móvil no aparece "Bandeja inteligencia"
En `SidebarNew.tsx` (desktop) sí está la entrada `Brain → /intelligence/inbox`, pero en `src/pages/MobileMenu.tsx` la ruta no se incluye en ninguna sección. Por eso desde el móvil no puedes llegar a validarlas.

## Plan

### A) Cortar la creación automática de tareas y redirigirla a la Bandeja
En `supabase/functions/contact-analysis/index.ts` (líneas ~1280-1325):
- Sustituir el `insert` en `tasks` por un `insert` en `suggestions` con:
  - `suggestion_type: 'task'`
  - `status: 'pending'`
  - `content`: `{ title, type, priority, contact_id, contact_name, source: 'contact-analysis', pretexto, ambito }`
  - `confidence`: la que venga del perfil (o 0.7 por defecto)
  - `reasoning`: `pretexto` del perfil
- Mantener el chequeo de duplicados pero contra `suggestions` (mismo contacto + título normalizado + status pending/accepted) para no spamear.
- Resultado: lo que antes caía en `/tasks` aparece en `/intelligence/inbox` esperando tu Aceptar/Rechazar, y solo al aceptar se crea la `task` real (lógica que ya existe en `useSuggestions.acceptTask`).

### B) Limpiar lo que ya hay metido sin tu validación
Migración SQL puntual:
- Identificar las tareas no completadas creadas por `contact-analysis` (`source = 'manual'` con `contact_id` no nulo, `created_at` reciente, sin pasar por `suggestions`). Como `source` no las distingue, usaremos un criterio conservador:
  - `completed = false`
  - `contact_id IS NOT NULL`
  - `priority = 'P1' AND duration = 15` (firma exacta del bloque de auto-sync)
  - `created_at >= '2026-04-01'`
- Para cada una: insertarla en `suggestions` como `pending` (para que no se pierda el trabajo del LLM, las puedas revisar) y borrarla de `tasks`.
- Reporte final con cuántas movidas / por contacto.

> Si prefieres "borrarlas y olvidar" en vez de moverlas a la bandeja, dímelo y lo hago así. Mi recomendación es moverlas para que decidas tú.

### C) Añadir "Bandeja inteligencia" al menú móvil
En `src/pages/MobileMenu.tsx`, sección **Principal**, justo debajo de "Tareas":
- Nuevo item: `{ icon: Brain, label: "Bandeja inteligencia", path: "/intelligence/inbox", meta: "<N> sugerencias pendientes", badge: pendingCount }`
- Añadir un nuevo `count` (`suggestionsPending`) al `useEffect` de carga (`select count from suggestions where user_id = uid and status = 'pending'`).

### D) Confirmar que no queda otro insert silencioso
He visto otros tres puntos que también insertan tareas sin validación:
- `email-intelligence/index.ts` (line 187): mete hasta 3 tasks por email automáticamente.
- `process-transcription/index.ts` (line 515): tasks desde transcripciones.
- `jarvis-agent/index.ts` (line 269): el agente conversacional (esta es legítima — la pides tú al chat).

Propuesta: aplicar el mismo cambio (→ `suggestions`) a `email-intelligence` y `process-transcription` por consistencia. `jarvis-agent` se queda igual (es acción explícita tuya por chat).

## Resultado esperado

- `/tasks` deja de llenarse solo de "preguntar por el perro" y similares.
- Todo lo que la IA infiere de WhatsApp/email/análisis de contacto cae en `/intelligence/inbox` con confianza + razón + Aceptar/Rechazar.
- Desde el móvil, en el menú, sale "Bandeja inteligencia" con badge del pendiente.
- Las tareas basura ya creadas se mueven a la bandeja para que las valides en bloque (o se borran si lo prefieres).

