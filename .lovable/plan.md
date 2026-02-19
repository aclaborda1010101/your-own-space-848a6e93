

# Ronda 3: Diferenciacion real entre vistas y calidad del filtrado

## Resumen

6 mejoras centradas en que cada vista (profesional/personal/familiar) muestre contenido ESTRICTAMENTE filtrado a su ambito, con metricas segmentadas y nuevas secciones exclusivas de la vista personal.

## Cambios

### 1. Filtrado estricto de contenido por ambito (edge function)

Actualizar el prompt de cada scope en `contact-analysis/index.ts` para incluir reglas de filtrado explicitas:

- Anadir al prompt una seccion "REGLAS DE FILTRADO POR AMBITO" que indique exactamente que contenido incluir y que excluir segun el ambito actual
- Profesional: SOLO proyectos, negocios, propuestas, reuniones de trabajo, pipeline
- Personal: SOLO planes, quedadas, humor, intereses, favores, gestiones administrativas compartidas. Si hay pocos mensajes personales, el analisis debe decirlo como insight ("La relacion se ha profesionalizado...")
- Familiar: SOLO familia, hijos, salud familiar, coordinacion, celebraciones
- Regla explicita: "Si un contacto tiene 90% de mensajes profesionales, la vista personal NO debe rellenarse con contenido profesional. Debe reflejar que hay poca interaccion personal."

### 2. Metricas segmentadas por tipo de mensaje (edge function)

Anadir al prompt instrucciones para que Claude clasifique los mensajes y genere metricas filtradas:

- Nuevo campo en JSON: `metricas_comunicacion.mensajes_ambito` con total de mensajes de este ambito, porcentaje sobre el total, media semanal filtrada
- El prompt instruye a Claude a estimar la proporcion de mensajes profesionales/personales/familiares y reportar solo los del ambito actual
- Nuevo patron automatico: si la proporcion profesional/personal cambia drasticamente, generar alerta de "profesionalizacion de la relacion"

### 3. Seccion "Gestiones compartidas" en vista personal (edge function + frontend)

- Nuevo campo en JSON para ambito personal: `gestiones_compartidas: [{ descripcion, monto, origen, estado, fecha_detectada }]`
- En el prompt personal, instruir: "Cualquier mencion de dinero entre usuario y contacto que NO sea un proyecto de negocio (prestamos, pagos compartidos, suscripciones, facturas) va a gestiones_compartidas"
- En frontend: nueva Card con icono de Wallet en la vista personal

### 4. Contactos de segundo nivel con validacion (edge function + frontend)

- Actualizar prompt: si no hay contexto suficiente para saber quien es, marcar con `relacion: "no_determinada"` y no inventar
- Si el nombre coincide potencialmente con otro contacto del sistema, marcar con `posible_match: true`
- En frontend: mostrar icono de advertencia para "no_determinada" y icono de enlace para "posible_match"

### 5. "Dinamica de la relacion" en vista personal (edge function + frontend)

- Nuevo campo JSON para ambito personal: `dinamica_relacion: { tono, uso_humor, temas_no_laborales, confianza_percibida, evidencia_confianza, ultima_conversacion_personal }`
- En frontend: nueva Card con icono de Sparkles en la vista personal, mostrando tono, humor, temas, confianza

### 6. Deteccion de profesionalizacion como patron (edge function)

- En el prompt, anadir instruccion: si la proporcion de mensajes personales vs profesionales ha cambiado significativamente, generar alerta amarilla de "Profesionalizacion de la relacion"

## Archivos modificados

### `supabase/functions/contact-analysis/index.ts`

- Actualizar `PROFESSIONAL_LAYER`, `PERSONAL_LAYER` y `FAMILIAR_LAYER` con reglas de filtrado estricto
- Anadir `PERSONAL_LAYER`: seccion de gestiones compartidas, dinamica de relacion
- Actualizar JSON schema: campos `mensajes_ambito`, `gestiones_compartidas`, `dinamica_relacion`
- Actualizar instrucciones de `red_contactos_mencionados`: usar "no_determinada" si no hay contexto
- Anadir al prompt regla de deteccion de profesionalizacion

### `src/pages/StrategicNetwork.tsx`

- En `ProfileByScope`: mostrar metricas con porcentaje de ambito (ej: "350 de 434 totales (81%)")
- Nueva Card "GESTIONES COMPARTIDAS" (solo vista personal)
- Nueva Card "DINAMICA DE LA RELACION" (solo vista personal)
- Mejorar `red_contactos_mencionados`: icono de advertencia para "no_determinada", icono de enlace para "posible_match"

## Detalle tecnico del filtrado

```text
PROMPT PROFESIONAL:
  "Analiza SOLO el contenido profesional: proyectos, negocios, reuniones de trabajo.
   IGNORA completamente: planes personales, humor, temas familiares.
   Las metricas deben reflejar solo mensajes profesionales."

PROMPT PERSONAL:
  "Analiza SOLO el contenido personal: amistad, planes, humor, gestiones compartidas.
   IGNORA completamente: proyectos de negocio, reuniones de trabajo, pipeline.
   Si hay pocos mensajes personales, dilo como insight. NO rellenes con contenido profesional.
   Incluye gestiones_compartidas y dinamica_relacion."

PROMPT FAMILIAR:
  "Analiza SOLO el contenido familiar: hijos, salud, coordinacion, celebraciones.
   IGNORA completamente: proyectos de negocio, temas de amistad no familiar."
```

## Detalle tecnico de metricas segmentadas

```text
Nuevo campo en JSON de cada ambito:
  "metricas_comunicacion": {
    ...campos existentes...,
    "mensajes_ambito": {
      "total": 350,
      "porcentaje": 81,
      "media_semanal": 81.3
    }
  }

Claude estima la proporcion basandose en el contenido de los mensajes.
Los totales generales siguen siendo pre-calculados y exactos.
```

