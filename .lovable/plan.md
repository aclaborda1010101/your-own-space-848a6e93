

# Integracion Tecnica JARVIS -- Claude + WhatsApp + Gmail + Plaud + RAG

## Analisis: Que existe vs Que falta

### Ya implementado
- **process-transcription**: Edge function con Claude que clasifica en 3 cerebros, extrae tareas, personas, ideas, sugerencias. Guarda en transcriptions, commitments, people_contacts, follow_ups, ideas_projects, suggestions.
- **whatsapp-webhook**: Recibe mensajes WhatsApp (Meta API), vincula usuarios via linking codes, envia a jarvis-gateway.
- **email-sync**: Gmail, Outlook e iCloud sync con OAuth/refresh tokens. Guarda en jarvis_emails_cache.
- **daily-briefing**: Briefing matutino con Claude usando contexto de tareas, eventos, check-in, memorias.
- **knowledge_embeddings**: Tabla con pgvector, funciones search_knowledge y search_knowledge_text. Tiene datos seed de productividad.
- **jarvis-gateway**: Router de agentes (coach, nutrition, english, bosco) para WhatsApp/Telegram/Web.

### Falta por implementar (del documento)

1. **Plaud auto-ingesta via Gmail** -- Detectar emails de Plaud en Gmail y procesarlos automaticamente
2. **WhatsApp proactivo** -- Enviar notificaciones/briefings por WhatsApp (send-whatsapp), flujo de identificacion de personas no identificadas
3. **RAG de conversaciones** -- Embeddear transcripciones segmentadas en conversation_embeddings + busqueda semantica
4. **search-rag** -- Edge function para busqueda semantica ("Que dije sobre X?")
5. **Briefing nocturno** -- daily-briefing con modo evening
6. **Resumen semanal** -- weekly-summary
7. **WhatsApp bidireccional inteligente** -- Interpretar respuestas (identificar persona, validar sugerencias, consultas RAG)
8. **Scoring de personas** -- Frecuencia, fiabilidad, iniciativa automaticos
9. **Tabla interactions** -- Timeline multicanal por persona

---

## Plan de implementacion (3 bloques)

### Bloque 1: Plaud auto-ingesta + WhatsApp proactivo (PRIORIDAD ALTA)

#### 1.1 Edge Function `plaud-email-check`
- Consulta email-sync buscando emails con asunto/remitente de Plaud
- Si detecta nuevo email de Plaud, extrae texto y llama a process-transcription
- Marca email como procesado

#### 1.2 Edge Function `send-whatsapp`
- Funcion reutilizable para enviar mensajes WhatsApp via Meta API
- Recibe user_id + message
- Busca phone en platform_users y envia

#### 1.3 Ampliar process-transcription
- Tras procesar, si hay personas no identificadas, llamar send-whatsapp con pregunta
- Tras procesar, enviar notificacion WhatsApp con resumen de sugerencias

### Bloque 2: RAG de conversaciones + Busqueda semantica (PRIORIDAD ALTA)

#### 2.1 Tabla `conversation_embeddings`
Nueva tabla con pgvector para almacenar chunks de conversaciones segmentadas:
- conversation summary + metadata (fecha, personas, cerebro)
- embedding vector(1536) via OpenAI ada-002
- Indices para busqueda rapida

#### 2.2 Funcion SQL `search_conversations`
- Busqueda semantica con filtros por cerebro y persona
- Retorna matches ordenados por similitud

#### 2.3 Embeddear en process-transcription
- Tras procesar, generar embeddings de cada segmento y guardar en conversation_embeddings

#### 2.4 Edge Function `search-rag`
- Recibe query + filtros opcionales (cerebro, persona)
- Genera embedding de la query con OpenAI
- Busca en conversation_embeddings
- Envia resultados a Claude para generar respuesta contextual
- Retorna respuesta

#### 2.5 UI de busqueda semantica
- Anadir seccion "Buscar en memoria" en la pagina de Chat o Inbox
- Input de busqueda + filtros por cerebro/persona
- Mostrar resultados con fecha, personas, fragmento

### Bloque 3: Briefings mejorados + Interacciones (PRIORIDAD MEDIA)

#### 3.1 Briefing nocturno
- Ampliar daily-briefing para aceptar type: "evening"
- Resumen de lo procesado hoy, pendientes, anticipacion manana
- No cachear por fecha (permitir matutino + nocturno mismo dia)

#### 3.2 Resumen semanal
- Nueva edge function `weekly-summary`
- Consolida tareas, personas clave, temas abiertos, ideas capturadas
- Opcional: enviar por WhatsApp

#### 3.3 Tabla `interactions` + scoring personas
- Timeline de interacciones por persona y canal
- Scoring automatico (frequency, reliability, initiative) calculado al procesar

#### 3.4 UI briefing nocturno en Dashboard
- Tarjeta de briefing nocturno junto al matutino

---

## Detalles tecnicos

### Tablas SQL nuevas

```text
conversation_embeddings:
  id uuid PK, user_id uuid, transcription_id uuid FK,
  date date, brain text, people text[],
  summary text, content text,
  embedding vector(1536), metadata jsonb,
  created_at timestamptz
  RLS: user_id = auth.uid()
  Index: ivfflat(embedding vector_cosine_ops)

interactions:
  id uuid PK, user_id uuid, contact_id uuid FK people_contacts,
  date date, channel text (plaud/whatsapp/email/calendar),
  interaction_type text, summary text, sentiment text,
  commitments jsonb, created_at timestamptz
  RLS: user_id = auth.uid()

ALTER daily_briefings ADD: briefing_type text default 'morning'
  (permite morning + evening el mismo dia)
```

### Edge Functions nuevas/modificadas

| Funcion | Accion |
|---------|--------|
| `send-whatsapp` | Nueva - enviar mensajes WhatsApp proactivos |
| `plaud-email-check` | Nueva - detectar emails de Plaud y procesar |
| `search-rag` | Nueva - busqueda semantica en transcripciones |
| `weekly-summary` | Nueva - resumen semanal consolidado |
| `process-transcription` | Modificar - anadir embedding + WhatsApp notify |
| `daily-briefing` | Modificar - soporte briefing nocturno |

### Paginas frontend modificadas

| Fichero | Cambio |
|---------|--------|
| `src/pages/Inbox.tsx` | Anadir seccion de busqueda semantica |
| `src/pages/Dashboard.tsx` | Tarjeta briefing nocturno + resumen semanal |

### Variables de entorno necesarias
- `OPENAI_API_KEY` - Para generar embeddings (ada-002)
- Las demas (WHATSAPP_API_TOKEN, ANTHROPIC_API_KEY, etc.) ya estan configuradas

### Limitaciones
- **Cron jobs**: Supabase Cloud no tiene pg_cron nativo desde Lovable. La deteccion de emails de Plaud se hara bajo demanda o via webhook externo.
- **IMAP**: No disponible en Deno edge runtime (sin TCP). La ingesta de iCloud mail sigue limitada.
- **Embeddings**: Requiere OPENAI_API_KEY configurada como secret.

---

## Orden de ejecucion propuesto

1. Migracion SQL (conversation_embeddings + interactions + alter daily_briefings)
2. send-whatsapp (funcion reutilizable)
3. search-rag (busqueda semantica)
4. Ampliar process-transcription (embeddings + WhatsApp notify)
5. Ampliar daily-briefing (modo nocturno)
6. weekly-summary
7. plaud-email-check
8. UI busqueda semantica en Inbox
9. UI briefing nocturno en Dashboard

Recomiendo empezar por los bloques 1 y 2 en paralelo ya que son independientes.
