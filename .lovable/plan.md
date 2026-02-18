

# Plan: Menu cleanup + Perfil inteligente de contactos con RAG

## Parte 1: Limpieza del menu de visibilidad

### Cambios en `src/components/settings/MenuVisibilityCard.tsx`
- **Eliminar** "Red Estrategica" (`/strategic-network`) y "Dashboard Cerebros" (`/brains-dashboard`) del array `menuGroups`
- **Anadir** "Tareas" (`/tasks`) con icono `CheckSquare` y "Calendario" (`/calendar`) con icono `Calendar` en la seccion "Principal"

### Cambios en `src/components/layout/SidebarNew.tsx`
- **Eliminar** "Red Estrategica" y "Dashboard Cerebros" de `navItems`
- **Anadir** "Tareas" y "Calendario" a `navItems`

---

## Parte 2: Almacenar contenido de mensajes WhatsApp

Actualmente, la importacion de WhatsApp solo guarda el **conteo** de mensajes en `people_contacts.wa_message_count`, pero NO el contenido de los mensajes. Sin contenido, no podemos hacer RAG ni analisis psicologico.

### Nueva tabla: `contact_messages`
```
- id (uuid, PK)
- user_id (uuid, NOT NULL)
- contact_id (uuid, FK -> people_contacts)
- source (text: 'whatsapp' | 'email' | 'plaud')
- sender (text: nombre del remitente)
- content (text: contenido del mensaje)
- message_date (timestamptz)
- chat_name (text: nombre del chat/grupo)
- direction (text: 'incoming' | 'outgoing')
- created_at (timestamptz, default now())
```

### Modificar flujo de importacion (`src/pages/DataImport.tsx`)
- Al importar chats de backup CSV, ademas de actualizar conteos, **insertar los mensajes** en `contact_messages` (batch de hasta 500 por insercion para no saturar)
- Almacenar tanto mensajes entrantes como salientes, con el `contact_id` del interlocutor

### Modificar parser (`src/lib/whatsapp-file-extract.ts`)
- Extender `parseBackupCSVByChat` para que devuelva tambien los mensajes individuales (no solo conteos), con fecha, remitente y contenido

---

## Parte 3: Edge Function de analisis de contacto

### Nueva Edge Function: `contact-analysis`

Recibe un `contact_id` y:

1. **Recopila datos** del contacto:
   - Mensajes de `contact_messages` (ultimos 500 mas recientes)
   - Transcripciones de `conversation_embeddings` donde `people` incluya al contacto
   - Emails de `jarvis_emails_cache` si existen
   - Datos existentes de `people_contacts` (metadata, context, etc.)

2. **Llama a la IA** (Anthropic Claude) con un prompt especializado que genera:
   - **Sinopsis**: Quien es esta persona, contexto de la relacion
   - **Temas frecuentes**: Los 5-8 temas mas recurrentes en las conversaciones
   - **Perfil psicologico**: Rasgos de personalidad detectados, estilo de comunicacion (formal/informal, directo/indirecto, emocional/racional)
   - **Analisis estrategico**: Como nos percibe, nivel de confianza mutua (1-10), oportunidades de negocio o colaboracion
   - **Temas sensibles**: Cosas que evitar o tratar con cuidado
   - **Recomendaciones**: Consejos practicos de interaccion, frecuencia sugerida de contacto, nivel de atencion requerido (alto/medio/bajo)

3. **Guarda el resultado** en `people_contacts.personality_profile` (JSONB)

---

## Parte 4: UI del perfil de contacto enriquecido

### Modificar `src/pages/StrategicNetwork.tsx` - `ContactDetail`

Reemplazar el panel derecho actual (que solo tiene tabs Plaud/Email/WhatsApp + un perfil IA basico) por un panel completo con secciones:

1. **Header** (existente, mejorado): nombre, avatar, badges, boton "Analizar con IA"
2. **Sinopsis**: parrafo narrativo generado por IA
3. **Temas frecuentes**: chips/badges con los temas detectados
4. **Perfil psicologico**: tarjeta con rasgos, estilo de comunicacion, medidor visual de confianza
5. **Analisis estrategico**: oportunidades, como nos ve, nivel de atencion
6. **Temas sensibles**: lista con icono de alerta
7. **Recomendaciones de interaccion**: consejos practicos
8. **Historial** (tabs): Plaud, Email, WhatsApp (funcionalidad existente)

El boton "Analizar con IA" invoca la edge function, muestra un spinner, y al terminar recarga los datos del contacto.

---

## Resumen de archivos a modificar/crear

| Archivo | Accion |
|---|---|
| `src/components/settings/MenuVisibilityCard.tsx` | Eliminar Red Estrategica y Dashboard Cerebros, anadir Tareas y Calendario |
| `src/components/layout/SidebarNew.tsx` | Igual: eliminar items obsoletos, anadir nuevos |
| `src/lib/whatsapp-file-extract.ts` | Extender parser para devolver mensajes individuales |
| `src/pages/DataImport.tsx` | Insertar mensajes en `contact_messages` durante importacion |
| `supabase/functions/contact-analysis/index.ts` | **NUEVO** - Edge function de analisis IA |
| `src/pages/StrategicNetwork.tsx` | Redisenar panel de detalle con perfil completo + boton analizar |
| Migracion SQL | Crear tabla `contact_messages` con RLS |

## Secuencia de implementacion

1. Migracion DB (tabla `contact_messages`)
2. Menu: limpiar MenuVisibilityCard + SidebarNew
3. Parser: extender para devolver mensajes
4. Import: guardar mensajes en DB
5. Edge function: `contact-analysis`
6. UI: redisenar ContactDetail con perfil inteligente
