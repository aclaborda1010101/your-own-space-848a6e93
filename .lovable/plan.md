
# Arreglar conversaciones recientes duplicadas

## Problema

Cuando metes todas las transcripciones del dia juntas, el sistema:

1. Segmenta correctamente el texto en conversaciones separadas (edge function `process-transcription`)
2. Para cada segmento, genera MULTIPLES embeddings (chunks de texto de max 1500 chars)
3. Cada chunk se guarda como una fila separada en `conversation_embeddings`
4. El dashboard de cerebro consulta `conversation_embeddings` con `limit(20)` sin deduplicar

Resultado: si una conversacion genera 5 chunks de embedding, aparecen 5 "conversaciones" identicas (mismo titulo, mismas personas, mismo resumen). Por eso ves 20+ entradas todas iguales.

## Solucion

Deduplicar las conversaciones por `transcription_id` en el frontend. En vez de mostrar cada fila de embedding como una conversacion separada, agrupar por `transcription_id` y mostrar solo una entrada por transcripcion real.

## Seccion tecnica

### Archivo: `src/pages/BrainDashboard.tsx`

**Cambio 1**: Aumentar el limite de la query para compensar duplicados y luego deduplicar en el cliente:

```typescript
// En la query de conversations (linea 50-57):
const { data } = await supabase
  .from("conversation_embeddings")
  .select("id, date, brain, summary, people, transcription_id, metadata")
  .eq("brain", dbBrain)
  .eq("user_id", user!.id)
  .order("date", { ascending: false })
  .limit(100); // Subir limite para tener margen

// Deduplicar por transcription_id, quedando solo la primera fila de cada transcripcion
const seen = new Set<string>();
const unique = (data || []).filter(row => {
  const key = row.transcription_id || row.id;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});
return unique.slice(0, 20); // Limitar a 20 conversaciones unicas
```

Esto garantiza que cada transcripcion real aparezca solo una vez, con su titulo, personas y resumen propios (que son los que Claude extrajo para cada segmento individual).

### Sin cambios en el backend

El backend (`process-transcription`) ya funciona correctamente: segmenta bien las conversaciones y extrae titulo/personas/resumen diferentes para cada segmento. El problema esta unicamente en la visualizacion que no agrupa los chunks de embedding.
