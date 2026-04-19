

## El problema (confirmado en código)

Mirando `supabase/functions/generate-response-draft/index.ts`:

1. **El prompt NO incluye fechas de los mensajes**. Línea 138: `[${m.direction === "incoming" ? m.sender : "Yo"}]: ${m.content}` — sólo dirección y contenido.
2. **No hay anclaje temporal**: el LLM no sabe qué día es hoy ni cuándo se dijo cada mensaje.
3. **No se distingue eventos pasados de pendientes**: si hace 2 semanas hablasteis del check-in de Venecia, el LLM lo ve como tema "reciente" y lo propone como acción a hacer ahora.
4. Encima los últimos 50 mensajes pueden mezclar conversaciones de meses distintos sin que el modelo lo sepa.

Por eso te sugiere "Pedirle el check-in del vuelo a Venecia" cuando ese viaje **ya ocurrió hace 2 semanas** y hay evidencias en el chat.

## La solución

Refactor de `generate-response-draft` con tres cambios concretos:

### 1. Anclar temporalmente cada mensaje en el prompt
Cambiar la serialización del historial para incluir fecha relativa:
```
[hace 14 días · Alicia]: oye, qué hora es el vuelo?
[hace 14 días · Yo]: 11:40, hago el check-in mañana
[hace 13 días · Yo]: ya en Venecia ✈️
[ayer · Alicia]: el aceite que recomendaste...
```
Así el LLM ve qué es presente y qué es pasado.

### 2. Añadir "HOY ES" al system prompt
Inyectar `Hoy: ${new Date().toLocaleDateString('es-ES', {...})}` y la regla:
> "REGLA TEMPORAL: Si en el historial aparecen eventos con fecha pasada (viajes, citas, vuelos, reuniones ya celebradas), NO los propongas como acción pendiente. Esos temas ya están cerrados — sólo se pueden retomar como recuerdo (`¿qué tal fue X?`), nunca como acción a coordinar."

### 3. Detectar el "último tema realmente activo"
Antes de llamar al LLM, calcular `daysSinceLastMessage` del último mensaje incoming. Si el último mensaje del contacto es de hace >3 días, marcar en el prompt:
> "ÚLTIMO MENSAJE recibido hace X días. La conversación está fría. Las sugerencias deben REABRIR el contacto, no continuar un tema que ya murió."

Y si el último mensaje incoming **es reciente (<48h)**, anclar las sugerencias a ESE mensaje específico, no a la conversación general.

### Archivos a tocar
Solo uno: `supabase/functions/generate-response-draft/index.ts`.
- Cambiar `conversationHistory` para incluir fecha relativa por mensaje
- Añadir `today` y la regla temporal al `systemPrompt`
- Calcular y exponer `daysSinceLastIncoming` y `lastIncomingMessage` al prompt

### Cómo lo verificas
1. Borrar las sugerencias actuales de Alicia (`update suggested_responses set status='rejected' where contact_id=...`).
2. Forzar regeneración (cualquier mensaje nuevo o llamada manual a la function).
3. Las nuevas sugerencias deben:
   - Hablar de **temas actuales** de los últimos 1-3 días
   - **No** mencionar "check-in del vuelo a Venecia" ni eventos ya pasados
   - Si procede, decir "qué tal fue Venecia" (recuerdo) en vez de "pídele el check-in" (acción pasada)

### Sin cambios de schema, sin migraciones
Sólo lógica del prompt en una edge function.

