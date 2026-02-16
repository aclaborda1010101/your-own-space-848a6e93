

# Rediseno de Brain Dashboards + Correccion de segmentacion

## Problema actual

1. **Datos mal segmentados**: La transcripcion `8c8ea923` tiene ~30 chunks, TODOS con el mismo titulo "Reunion de trabajo y comida de negocios con clientes mexicanos" y TODOS con la misma lista de 8 personas (Raul, Chuso, Joseba, Andrei, Cristian, Bosco, Juany). No se segmento correctamente en conversaciones independientes.

2. **Titulo de tarjeta erroneo**: La tarjeta principal muestra el titulo de la primera transcripcion ("Reunion de trabajo y comida") en lugar de la FECHA ("Dia 15 de febrero"). Cada subtema deberia tener su propio titulo descriptivo (Comida con mexicanos, Llamada con Raul, etc.).

3. **Bug critico en linea 469**: El backend todavia comprueba `ANTHROPIC_API_KEY` en vez de `GOOGLE_AI_API_KEY`, lo que impide reprocesar.

4. **Frontend basico**: Sin diferenciacion visual entre los 3 cerebros, sin iconos contextuales, sin scroll areas.

## Solucion en 4 pasos

### Paso 1: Fix backend (process-transcription)

Cambiar linea 469 de `ANTHROPIC_API_KEY` a `GOOGLE_AI_API_KEY` y redesplegar.

### Paso 2: Rediseno de ConversationCard

Cambiar la logica de agrupacion y visualizacion:

- **Titulo principal** = fecha formateada ("Dia 15 de febrero 2026"), NO el titulo de la transcripcion
- **Cada segmento dentro** muestra su titulo propio con icono contextual:
  - Telefono para llamadas (titulo contiene "llamada", "telefono")
  - Tenedor para comidas ("comida", "cena", "almuerzo", "restaurante")
  - Video para videollamadas ("video", "zoom", "meet")
  - Maletin para reuniones ("reunion", "meeting")
  - Mensaje por defecto
- Mostrar numero de participantes de forma compacta
- Badges de personas solo del segmento, no de toda la transcripcion
- Bordes y separadores mas claros entre segmentos

### Paso 3: Rediseno de BrainDashboard

- **Colores por cerebro**:
  - Profesional: azul (bg-blue-500/10, text-blue-600)
  - Personal: verde (bg-emerald-500/10, text-emerald-600)  
  - Familiar: ambar (bg-amber-500/10, text-amber-600)
- **Header** con color del cerebro aplicado al icono y fondo
- **Stats grid** con 5 items (anadir Follow-ups)
- **ScrollArea** de Radix para las listas de conversaciones en vez de overflow-y-auto
- **Seccion de contactos** con avatares con iniciales coloreadas y tags de IA visibles
- **Agrupacion de conversaciones por fecha** en el listado (hoy, ayer, esta semana, etc.)

### Paso 4: Boton de reprocesar en Inbox + reprocesamiento

- Anadir boton "Reprocesar" en cada transcripcion del historico del Inbox
- Tras desplegar el fix, reprocesar la transcripcion `8c8ea923` para que Gemini Flash la segmente correctamente en conversaciones independientes

## Seccion tecnica - Archivos a modificar

### `supabase/functions/process-transcription/index.ts`
- Linea 469: `ANTHROPIC_API_KEY` -> `GOOGLE_AI_API_KEY`

### `src/components/brain/ConversationCard.tsx`
- Titulo principal = fecha ("Dia 15 de febrero") en vez de metadata.title
- Cada segmento muestra su propio titulo con icono contextual (Phone, Utensils, Video, Briefcase, MessageCircle)
- Badges de personas por segmento, no globales
- Indicador compacto de participantes totales

### `src/pages/BrainDashboard.tsx`
- Config de colores por cerebro (BRAIN_CONFIG ampliado con color/bgColor)
- Header con color del cerebro
- Stats grid con 5 items (anadir follow-ups)
- ScrollArea en vez de overflow-y-auto para las listas
- Agrupacion de conversaciones por fecha
- Seccion de contactos mejorada con avatares de iniciales

### `src/pages/Inbox.tsx`
- Boton "Reprocesar" por transcripcion en el historico
- Estado de loading durante reprocesamiento
- Invalidacion de queries tras reprocesar

### Orden de ejecucion
1. Fix backend linea 469 y desplegar
2. Modificar ConversationCard con nueva logica de titulos y iconos
3. Modificar BrainDashboard con colores, stats y layout
4. Modificar Inbox con boton reprocesar
5. Reprocesar transcripcion 8c8ea923

