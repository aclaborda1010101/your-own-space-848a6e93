

# Integracion de mejoras del MVP - Asistente Personal IA

## Analisis: Que ya existe vs Que falta

He analizado tu documento completo y lo he cruzado con el estado actual de Jarvis. Aqui esta el mapa:

### Ya implementado (total o parcialmente)
- Chat multi-agente (JARVIS, Coach, English, Nutrition, Bosco, Finanzas)
- Sistema de tareas con tipos (work/life/finance) y prioridades
- Calendario (Google Calendar + iCloud)
- Email sync (Gmail API con OAuth)
- Daily briefing (matutino con Claude)
- WhatsApp/Telegram webhooks
- Check-in diario (energia, mood, foco)
- Smart notifications
- Memoria conversacional (jarvis_memory, specialist_memory)

### Falta por implementar (del documento)
1. **Clasificacion "3 Cerebros"** - Las tareas ya tienen tipos work/life/finance pero no hay clasificacion automatica de contenido entrante en Profesional/Personal/Bosco
2. **Ingesta Plaud Note Pro** - No hay procesamiento automatico de transcripciones
3. **Extraccion proactiva de tareas** - No se extraen tareas/compromisos de conversaciones
4. **Grafo de personas/CRM** - No existe tabla de contactos con contexto
5. **Seguimiento de temas abiertos** - No hay tracking de follow-ups
6. **Briefing nocturno** - Solo existe el matutino
7. **Resumen semanal** - No implementado
8. **Busqueda semantica** ("Que dije sobre X?") - Hay embeddings pero no UI de busqueda
9. **Recordatorios contextuales** - Solo fecha, no por contexto/persona
10. **Pre-meeting brief** - No existe

---

## Plan de integracion (priorizado por impacto)

Dado que Lovable usa React + Supabase Edge Functions, propongo implementar las mejoras en 3 bloques. El primer bloque es el mas impactante y viable:

### Bloque 1: Procesamiento inteligente de contenido (PRIORIDAD ALTA)

#### 1.1 Edge Function `process-transcription`
Nueva funcion que recibe texto (de Plaud Note Pro u otra fuente) y:
- Clasifica en los 3 cerebros (Profesional/Personal/Bosco)
- Extrae tareas y compromisos automaticamente
- Detecta personas mencionadas
- Detecta citas/eventos
- Genera seguimientos pendientes

La clasificacion usa Claude con un prompt especializado que devuelve JSON estructurado.

#### 1.2 Tablas nuevas en Supabase
- `transcriptions` - Texto raw con fecha, fuente, cerebro asignado
- `people_contacts` - Grafo de personas (nombre, relacion, contexto, cerebro, ultimo_contacto)
- `follow_ups` - Temas abiertos sin resolver (tema, estado, fecha_detectado, ultima_mencion)
- `commitments` - Compromisos detectados (propio o de terceros, persona, plazo, estado)

#### 1.3 Pagina "Inbox Inteligente" en el frontend
Nueva pagina donde puedes:
- Pegar o subir transcripciones de Plaud Note Pro
- Ver el resultado clasificado en los 3 cerebros
- Confirmar/editar tareas extraidas automaticamente
- Ver personas detectadas y su contexto

### Bloque 2: Briefings mejorados (PRIORIDAD ALTA)

#### 2.1 Briefing nocturno
Ampliar `daily-briefing` para generar un resumen nocturno:
- Que se hizo hoy
- Que quedo pendiente
- Anticipacion del dia siguiente

#### 2.2 Resumen semanal
Nueva funcion `weekly-summary` que consolida:
- Tareas completadas vs pendientes
- Personas clave de la semana
- Temas abiertos
- Evolucion de Bosco (si hay datos)

#### 2.3 UI en Dashboard
Tarjeta de briefing nocturno y enlace al resumen semanal desde el Dashboard.

### Bloque 3: Busqueda y contexto (PRIORIDAD MEDIA)

#### 3.1 Busqueda "Que dije sobre X?"
- Usar `knowledge_embeddings` existente para busqueda semantica
- Anadir UI de busqueda en la pagina de Chat o nueva seccion
- Edge function que busca en transcripciones y conversaciones

#### 3.2 CRM de contactos
- Vista de personas/contactos con contexto acumulado
- Historial de interacciones por persona
- Alertas de inactividad ("Hace 2 semanas que no hablas con X")

---

## Detalles tecnicos

### Tablas SQL nuevas

```text
transcriptions:
  id, user_id, source (plaud/manual/email), 
  raw_text, brain (professional/personal/bosco),
  processed_at, entities_json, created_at

people_contacts:
  id, user_id, name, relationship, brain,
  context, last_contact, interaction_count, created_at

follow_ups:
  id, user_id, topic, status (open/resolved),
  detected_at, last_mention, related_person_id,
  resolve_by, created_at

commitments:
  id, user_id, description, type (own/third_party),
  person_name, deadline, status (pending/done/expired),
  source_transcription_id, created_at
```

### Edge Functions nuevas
- `process-transcription` - Clasificacion + extraccion con Claude
- `weekly-summary` - Resumen semanal consolidado
- Ampliar `daily-briefing` con modo nocturno

### Paginas frontend nuevas/modificadas
- Nueva pagina `/inbox` - Inbox inteligente para procesar transcripciones
- Modificar `/dashboard` - Anadir tarjeta de briefing nocturno
- Nueva seccion en Chat - Busqueda semantica

### Limitaciones tecnicas
- **No es posible** montar un listener IMAP en Supabase Edge Functions (no hay TCP). La ingesta de Plaud Note Pro sera manual (pegar texto) o via email-sync existente.
- **No es posible** hacer cron jobs nativos en Lovable. Los briefings se generan bajo demanda o via webhook externo.
- El stack del documento sugiere FastAPI/Celery/Redis - eso no aplica aqui, pero las Edge Functions + Supabase cubren la funcionalidad equivalente.

---

## Propuesta de ejecucion

Recomiendo empezar por el **Bloque 1** (Inbox inteligente + procesamiento de transcripciones) porque es el nucleo del documento y el que mas valor aporta. Una vez funcionando, los bloques 2 y 3 se construyen sobre esa base.

Si quieres que empiece, implementare primero las tablas + la edge function de procesamiento + la pagina de inbox.

