
# Correcciones: Layout desbordado + Analisis historico incompleto

## Problema 1: Layout desbordado

La pagina `/strategic-network` tiene contenido que se sale del viewport. El panel derecho (detalle del contacto) no tiene restriccion de ancho ni overflow controlado. Las cards con texto largo (descripciones, evidencias, patrones) se expanden sin limites.

### Solucion

- Agregar `overflow-hidden` al grid principal y `overflow-y-auto max-h-[calc(100vh-120px)]` al panel derecho de detalle
- Agregar `break-words overflow-hidden` a los textos largos dentro de las cards (descripciones de patrones, evidencias, etc.)
- Asegurar que el grid `grid-cols-[320px_1fr]` tenga `min-w-0` en la columna derecha para evitar desbordamiento

### Archivos afectados
- `src/pages/StrategicNetwork.tsx` — linea 1662 (grid principal), linea 1732-1751 (panel derecho), y multiples cards de ProfileByScope

---

## Problema 2: Analisis historico solo procesa 1,000 mensajes

El problema esta en `splitIntoQuarterlyBlocks` en la Edge Function `contact-analysis`:

```text
Causa raiz:
- Linea 329: Solo corta bloque cuando currentBlock.length >= 2000
- Si 18,000 mensajes no cruzan el umbral de 2000 en el momento correcto del cambio de trimestre, acaban en 1 solo bloque gigante
- Linea 418: blockText.substring(0, 25000) trunca a ~1000 mensajes
- Resultado: la IA solo ve julio-septiembre 2022 y pierde todo lo demas
```

### Solucion

1. Reescribir `splitIntoQuarterlyBlocks` para cortar siempre por trimestre (sin umbral de 2000), y luego subdividir bloques grandes en chunks de max 800 mensajes
2. Reducir el substring de 25000 a un formato mas compacto: solo fecha + direccion + primeras 80 chars del contenido, para meter mas mensajes por bloque
3. Asegurar que `evolucion_anual` muestre TODOS los anos (2022-2026) pasando los conteos exactos por ano al prompt de consolidacion (esto ya se hace parcialmente en linea 476-481, pero hay que reforzarlo)

### Cambios en `supabase/functions/contact-analysis/index.ts`

**splitIntoQuarterlyBlocks** (lineas 317-349):
- Cortar por trimestre SIN umbral minimo
- Despues subdividir bloques > 800 mensajes en chunks de 800
- Esto genera ~6-8 bloques manejables para 18k mensajes

**Bloque de texto por mensaje** (lineas 407-411):
- Formato compacto: `[YYYY-MM-DD] dir: content (max 80 chars)`
- Esto permite ~300 msgs en 25000 chars vs ~100 actuales

**Prompt de consolidacion** (lineas 444-472):
- Anadir instruccion explicita: "DEBES incluir TODOS los anos desde el primer mensaje hasta el ultimo"
- Pasar yearCounts como dato obligatorio (ya se hace en linea 485)

### Archivos afectados
- `supabase/functions/contact-analysis/index.ts` — funciones splitIntoQuarterlyBlocks, processHistoricalAnalysis

---

## Orden de implementacion

1. Corregir layout overflow en StrategicNetwork.tsx
2. Corregir splitIntoQuarterlyBlocks en contact-analysis
3. Optimizar formato de mensajes por bloque
4. Reforzar prompt de consolidacion
5. Deploy edge function
