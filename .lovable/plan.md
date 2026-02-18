

# Plan: Sistema de Inteligencia de Contactos v2 — RAG por ambito

## Resumen

Reescribir completamente el motor de analisis de contactos para que sea especifico por ambito (profesional/personal/familiar), con extraccion de datos factuales concretos, metricas de comunicacion, deteccion de patrones y acciones pendientes. Actualizar la UI para mostrar fichas ricas adaptadas al ambito.

---

## Parte 1: Reescritura del Edge Function `contact-analysis`

### Cambios principales en `supabase/functions/contact-analysis/index.ts`

El prompt actual es generico y produce analisis superficiales. Se reemplaza por un sistema de prompts diferenciados por ambito:

**Estructura del nuevo prompt:**

1. **Capa comun** (siempre se ejecuta):
   - Extraer datos factuales concretos mencionados en conversaciones (compromisos, fechas, personas mencionadas, datos personales revelados, cambios vitales)
   - Calcular metricas de comunicacion: frecuencia, ratio de iniciativa (quien escribe primero), tendencia (creciente/estable/declive), ultimo contacto, canales usados
   - Detectar acciones pendientes: reuniones mencionadas, tareas comprometidas, seguimientos prometidos, informacion solicitada

2. **Capa por ambito** (segun `category` del contacto):
   - **Profesional**: empresa/cargo, proyectos mencionados, presupuestos/cifras, competidores, plazos, decisores, objeciones. Patrones: oportunidad de negocio, interes creciente, enfriamiento, objecion no resuelta, compromiso incumplido, momento de cierre, cambio de poder, referencia a competencia.
   - **Personal**: intereses/hobbies, situacion sentimental, planes, estado de animo, temas recurrentes, favores, eventos compartidos. Patrones: distanciamiento, momento dificil, reciprocidad desequilibrada, confianza creciente, favor pendiente, oportunidad social, cambio vital, fechas importantes.
   - **Familiar**: estado emocional, necesidades, salud, logros (Bosco), conflictos, planes familiares, coordinacion logistica. Patrones: necesidad no expresada, tension creciente, desconexion, hito del hijo, salud, coordinacion fallida, momento positivo, patron emocional del hijo.

3. **Reglas estrictas en el prompt**:
   - NUNCA generar analisis genericos — cada insight respaldado por contenido real
   - NUNCA inventar informacion — poner "Datos insuficientes" si no hay evidencia
   - SIEMPRE citar ejemplos concretos con fechas y contenido
   - SIEMPRE priorizar los ultimos 30 dias
   - SIEMPRE terminar con acciones pendientes concretas

**Nuevo formato JSON de salida:**

```text
{
  "ambito": "profesional|personal|familiar",
  "ultima_interaccion": { "fecha": "2026-02-15", "canal": "whatsapp" },
  "estado_relacion": { "emoji": "...", "descripcion": "..." },
  "datos_clave": [
    { "dato": "texto concreto", "fuente": "WhatsApp 15/01", "tipo": "empresa|familia|salud|..." }
  ],
  "situacion_actual": "2-3 frases con hechos concretos",
  "metricas_comunicacion": {
    "frecuencia": "X msgs/semana",
    "ratio_iniciativa": { "usuario": 60, "contacto": 40 },
    "tendencia": "creciente|estable|declive",
    "ultimo_contacto": "2026-02-15",
    "canales": ["whatsapp", "email"]
  },
  "patrones_detectados": [
    { "emoji": "...", "patron": "nombre", "evidencia": "texto concreto con fecha", "nivel": "verde|amarillo|rojo" }
  ],
  "alertas": [
    { "nivel": "rojo|amarillo", "texto": "con evidencia concreta" }
  ],
  "acciones_pendientes": [
    { "accion": "texto", "origen": "mensaje/fecha", "fecha_sugerida": "2026-02-20" }
  ],
  "proxima_accion": {
    "que": "descripcion",
    "canal": "whatsapp|email|presencial|llamada",
    "cuando": "fecha o periodo",
    "pretexto": "tema concreto"
  },
  // Campos especificos por ambito:
  // Profesional:
  "pipeline": { "oportunidades": [...], "probabilidad_cierre": "alta|media|baja" },
  // Personal:
  "termometro_relacion": "frio|tibio|calido|fuerte",
  "reciprocidad": { "usuario_inicia": 70, "contacto_inicia": 30, "evaluacion": "desequilibrada" },
  // Familiar:
  "bienestar": { "estado_emocional": "...", "necesidades": [...] },
  "coordinacion": [{ "tarea": "...", "responsable": "..." }],
  "desarrollo_bosco": { "hitos": [...], "patrones_emocionales": [...] }
}
```

**Mejoras tecnicas en la recopilacion de datos:**
- Incluir `message_date` en los mensajes enviados al prompt para que la IA pueda citar fechas
- Incluir direccion (incoming/outgoing) para calcular ratio de iniciativa
- Aumentar limite de mensajes a 800 (recientes) para cubrir los ultimos 30 dias con mas profundidad
- Filtrar transcripciones con mas precision usando nombre completo Y primer nombre

---

## Parte 2: UI del perfil de contacto adaptada al ambito

### Cambios en `src/pages/StrategicNetwork.tsx` — `ContactDetail`

Reemplazar la seccion del tab "Perfil" con un renderizado adaptado al ambito del contacto:

**Secciones comunes (todos los ambitos):**
1. **Estado y ultima interaccion**: emoji + descripcion + fecha/canal
2. **Datos clave**: lista con iconos por tipo (empresa, salud, familia...) — solo datos REALES
3. **Situacion actual**: parrafo narrativo con hechos concretos
4. **Metricas de comunicacion**: frecuencia, barra de ratio iniciativa, badge de tendencia
5. **Patrones detectados**: lista con emoji de semaforo (verde/amarillo/rojo) y evidencia
6. **Alertas**: tarjetas rojas/amarillas con evidencia concreta
7. **Acciones pendientes**: checklist con origen y fecha sugerida
8. **Proxima accion recomendada**: tarjeta destacada con que/canal/cuando/pretexto

**Secciones especificas profesional:**
- Pipeline card con oportunidades y probabilidad de cierre
- Decisores y competidores mencionados

**Secciones especificas personal:**
- Termometro visual de relacion (frio a fuerte)
- Barra de reciprocidad (quien inicia mas)
- Datos personales (cumpleanos, gustos, situacion)

**Secciones especificas familiar:**
- Tarjeta de bienestar con estado emocional
- Coordinacion familiar (tareas con responsable)
- Timeline de desarrollo de Bosco (si aplica)

**Fallback**: Cuando no hay datos suficientes para una seccion, mostrar "Datos insuficientes — se necesitan mas interacciones para analizar este aspecto" en vez de ocultar la seccion.

---

## Parte 3: Mejoras en la recopilacion de datos

### Cambios menores en `supabase/functions/contact-analysis/index.ts`

- Incluir `message_date` y `direction` en el resumen de mensajes enviados al prompt: `[2026-02-15 | Yo → Carlos] contenido del mensaje`
- Buscar en `commitments` y `follow_ups` asociados al contacto para incluir compromisos ya detectados
- Buscar en `interactions` si existe, para enriquecer metricas de canal

---

## Archivos a modificar

| Archivo | Accion |
|---|---|
| `supabase/functions/contact-analysis/index.ts` | Reescribir: prompt por ambito, nuevo formato JSON, reglas estrictas, mejor recopilacion |
| `src/pages/StrategicNetwork.tsx` | Redisenar tab Perfil: secciones adaptadas al ambito, metricas visuales, acciones pendientes |

## Secuencia

1. Reescribir edge function con el nuevo sistema de prompts por ambito
2. Actualizar UI para renderizar el nuevo formato de datos con secciones adaptadas
3. Deploy de la edge function

