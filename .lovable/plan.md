

# Fix del reprocesamiento: segmentacion inteligente sin texto en JSON

## Problema diagnosticado

El reprocesamiento fallo porque:

1. `maxOutputTokens: 4096` es insuficiente - Gemini debe devolver el texto COMPLETO de cada segmento dentro del JSON, pero 6000 palabras no caben en 4096 tokens de salida
2. El bloque 1 fallo con `SyntaxError: Unterminated string in JSON at position 14332` - JSON truncado
3. La transcripcion original sigue existiendo sin cambios (sin group_id, sin segmentos)

## Solucion: segmentacion por marcadores (sin texto en JSON)

En lugar de pedirle a Gemini que devuelva el texto completo de cada segmento (lo que causa el truncamiento), le pediremos que devuelva solo **marcadores de posicion**: las primeras palabras y ultimas palabras de cada segmento. Luego, el codigo cortara el texto original programaticamente.

### Cambios en el prompt de segmentacion

Nuevo formato de respuesta:

```text
{
  "segments": [
    {
      "segment_id": 1,
      "title": "Comida con clientes mexicanos",
      "participants": ["Agustin", "Andrei", "Cristian"],
      "start_words": "las primeras 8-10 palabras del segmento",
      "end_words": "las ultimas 8-10 palabras del segmento",
      "context_clue": "cambio de interlocutores"
    }
  ]
}
```

Ventajas:
- El JSON de respuesta es pequeno (unos pocos KB vs. decenas de KB)
- `maxOutputTokens: 4096` sera mas que suficiente
- Sin riesgo de truncamiento

### Cambios en el codigo de segmentacion

1. Gemini devuelve marcadores (start_words, end_words)
2. El codigo busca esas palabras en el texto original del bloque
3. Corta el texto programaticamente
4. Si no encuentra los marcadores, usa todo el bloque como fallback

### Otros ajustes

- Subir `maxOutputTokens` a 8192 como medida de seguridad adicional
- Mejorar el manejo de errores: si un bloque falla, loggear el raw response para debug

## Seccion tecnica

### Archivo: `supabase/functions/process-transcription/index.ts`

**Prompt de segmentacion (lineas 11-47)**:
- Cambiar formato de respuesta para pedir `start_words` y `end_words` en vez de `text`
- Anadir instruccion explicita: "NO incluyas el texto completo, solo marcadores"

**Interface Segment (lineas 83-89)**:
- Cambiar `text: string` por `start_words: string; end_words: string`
- Mantener `text` como campo opcional que se rellena programaticamente

**Funcion segmentText (lineas 125-170)**:
- Tras recibir los marcadores de Gemini, recorrer el texto del bloque y buscar cada `start_words`
- Asignar el texto entre un `start_words` y el siguiente como contenido del segmento
- Si es el ultimo segmento, tomar hasta el final del bloque

**generationConfig (linea 112)**:
- Cambiar `maxOutputTokens` de 4096 a 8192

### Redespliegue

Redesplegar la edge function y volver a lanzar el reprocesamiento de `8c8ea923`.

### Resultado esperado

La transcripcion de 176K caracteres (32K palabras) se segmentara en ~8-15 conversaciones reales:
- Comida con los mexicanos
- Llamada con Raul
- Llamada/reunion con Chuso
- Conversaciones familiares con Bosco/Juany (al cerebro personal/bosco)
- Etc.

En vez de los 122 temas erroneos que se mostraban.

