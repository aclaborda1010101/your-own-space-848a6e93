
## Plan: Timeline tipo "curva de vida" en cada contacto

### Lo que pides
1. **Test multimedia**: ya está desplegado. Te confirmo que cuando tu nena te mande audio/foto al WhatsApp, en el chat del contacto verás `[🎙️ Audio] transcripción…` o `[🖼️ Imagen] descripción + OCR…` en ~5-15s. Si en 30s no aparece, miramos logs de `process-whatsapp-media`. Esto **no requiere cambios de código**, solo que la pruebes.

2. **Timeline mejorado** (esto sí requiere trabajo):

### Estado actual
Ya existe `RelationshipTimelineChart.tsx` + `build-relationship-timeline` edge function. Funciona pero:
- Agrupa por mes (poco granular).
- Hitos vienen solo de `personality_profile.hitos` con sentiment heurístico (no analiza qué pasó realmente).
- Eventos personales mezclados pero sin destacar.
- Tooltip básico.

### Lo que vamos a cambiar

**A) Edge function `build-relationship-timeline`** — extracción de hitos reales con IA
- Pasar a Gemini Flash una muestra representativa de los mensajes del contacto (primeros + últimos + picos de actividad).
- Pedir extracción JSON estricta:
  ```json
  { "hitos": [
    { "date": "2024-08-15", "title": "Viaje a Tulum",
      "description": "Vacaciones juntos, lo pasaron genial",
      "sentiment": 3, "category": "viaje|celebracion|conflicto|logro|perdida|reencuentro|cotidiano" }
  ]}
  ```
- Sentiment ya no heurístico: lo decide el LLM (-3 a +3).
- Cachear resultado en `people_contacts.personality_profile._timeline_cache` con TTL 7 días para no re-llamar al LLM cada vista.
- Mantener serie de frecuencia mensual como línea base.

**B) Componente `RelationshipTimelineChart.tsx`** — curva continua + hitos marcados
- Curva de actividad/sentimiento desde el primer mensaje hasta hoy (línea suave).
- Puntos sobre la curva por cada hito, color según sentiment:
  - verde (positivo: viajes, celebraciones, reencuentros)
  - rojo (negativo: conflictos, pérdidas)
  - amarillo (neutro/cotidiano)
- Iconos por categoría (✈️ viaje, 🎉 celebración, 💔 conflicto, 🏆 logro, etc.).
- Tooltip rico al pasar por encima:
  - Fecha exacta formateada (`15 ago 2024`)
  - Título + descripción del hito
  - Etiqueta de sentimiento ("Bueno", "Malo", "Neutro")
- Eventos personales del usuario (viaje a Venecia) como marcadores diferenciados encima de la curva (línea vertical punteada con icono).
- Eje X: línea de tiempo desde primer mensaje hasta hoy (no agrupado por mes rígido).

**C) Integración en `ContactDetail.tsx`**
- El componente ya está; nos aseguramos que ocupa una sección destacada (ya lo está vía tabs).
- Botón "Recalcular timeline" que invalida el cache y vuelve a llamar al LLM.

### Archivos a tocar
- `supabase/functions/build-relationship-timeline/index.ts` (refactor extracción + cache)
- `src/components/contact/RelationshipTimelineChart.tsx` (nueva visualización)
- `src/hooks/useRelationshipTimeline.ts` (añadir `forceRefresh`)

### Resultado
Abres el contacto de tu primo Carlitos y ves una curva continua desde el primer mensaje. Picos verdes en "Viaje a Tulum (ago 2024)", "Cumpleaños (mar 2025)", quizá un valle rojo si hubo bronca, y marcadores de tus propios viajes (Venecia) superpuestos. Pasas el ratón y te dice exactamente qué pasó y si fue bueno o malo.

### Sobre el test del audio/foto
Mándale ahora mismo a tu nena que te envíe un audio corto y una foto. Vuelve aquí en 1 minuto y me dices qué ves en el chat del contacto en `/red-estrategica/<su-id>`. Si funciona, paso al timeline. Si no, miramos logs antes.
