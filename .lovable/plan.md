

## Plan: Corregir timeout en contact-analysis para contactos con muchos mensajes

### Problema raiz

La funcion `contact-analysis` hace UN call de AI por cada bloque de 800 mensajes, secuencialmente. Para contactos con muchos mensajes (Mi Nena: 94K msgs = 127 bloques, Angel Baena: 14K msgs = 25 bloques), la funcion excede el limite de tiempo de Supabase Edge Functions (~400s) y se mata con `shutdown` antes de completar el analisis historico.

El analisis de Angel Baena (25 bloques) tarda ~10s/bloque = ~250s, esta al limite. Mi Nena (127 bloques) necesitaria ~1270s, imposible.

### Solucion: Procesar bloques en paralelo con limite de concurrencia

En vez de procesar bloque a bloque secuencialmente, procesar en lotes paralelos de 3-4 bloques simultaneos. Esto reduce el tiempo total por ~3-4x.

Ademas, aumentar el tamano maximo de chunk de 800 a 1500 mensajes para reducir el numero de bloques (Mi Nena pasaria de 127 a ~63 bloques).

### Cambios

**Archivo**: `supabase/functions/contact-analysis/index.ts`

1. **Aumentar MAX_CHUNK** en `splitIntoQuarterlyBlocks`: de 800 a 1500 mensajes por bloque. Reduce bloques a la mitad.

2. **Procesar bloques en paralelo** en `processHistoricalAnalysis`: en vez del `for` secuencial (lineas 455-496), usar batches de 4 bloques en paralelo con `Promise.all`. El resumen progresivo se actualiza despues de cada batch.

3. **Limitar bloques maximos**: Si hay mas de 30 bloques, samplear solo los mas recientes + primeros + intermedios (maximo 30 bloques) para mantenerse dentro del timeout.

4. **Truncar contenido por bloque**: Reducir el substring de 40000 a 25000 chars por bloque para acelerar cada llamada AI.

### Estructura del cambio

```text
Antes:  bloque1 → bloque2 → bloque3 → ... → bloque127  (secuencial, ~1270s)

Despues: 
  - MAX_CHUNK = 1500 (reduce a ~63 bloques)
  - Cap a 30 bloques (sampleo inteligente)
  - Paralelo x4: [b1,b2,b3,b4] → [b5,b6,b7,b8] → ... → consolidacion
  - Tiempo estimado: 30 bloques / 4 paralelos * 10s = ~75s
```

### Resultado esperado

Contactos con hasta ~100K mensajes se analizan en <120s, dentro del limite de Edge Functions.

