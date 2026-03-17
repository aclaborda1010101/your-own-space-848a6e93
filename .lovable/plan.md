

## Plan: Mejorar drasticamente la calidad de los borradores de WhatsApp

### Problemas detectados en `generate-response-draft`

1. **Muestra de voz limitada al contacto**: Solo toma 40 mensajes salientes hacia ESE contacto. Si apenas has escrito 5 mensajes a alguien, la IA no tiene datos reales de tu estilo. Necesita una muestra GLOBAL de tus mensajes salientes a TODOS los contactos.

2. **Solo 3000 caracteres de muestra**: Insuficiente para captar tu voz real. Hay que subir a 8000+.

3. **Temperature 0.8**: Demasiado alta. Genera texto creativo/inventado en vez de imitar fielmente. Hay que bajarla a 0.4-0.5 para que se ciña a tu estilo.

4. **El prompt no incluye ejemplos literales**: Le describe el estilo con metadatos ("directo", "formalidad 5/10") pero no le pega tus mensajes reales como few-shot examples. La IA necesita ver TUS frases exactas.

5. **Solo 10 mensajes de contexto**: Poco historial conversacional para entender de qué va la conversación.

### Cambios propuestos

**Archivo**: `supabase/functions/generate-response-draft/index.ts`

#### 1. Muestra de voz GLOBAL + por contacto
- Cargar 100 mensajes salientes GLOBALES del usuario (a cualquier contacto) para captar la voz general
- Mantener los 40 por contacto para captar el tono específico con esa persona
- Combinar ambas muestras priorizando la del contacto

#### 2. Subir el contexto conversacional
- De 10 a 25 mensajes recientes de la conversación

#### 3. Reestructurar el prompt con few-shot examples
- Incluir 8-10 mensajes reales del usuario como ejemplos literales en el prompt
- Cambiar de "analiza estilo" abstracto a "aquí tienes cómo escribe esta persona, imita esto exactamente"
- Eliminar la fase 1 separada (style analysis) y fusionarla en un solo prompt más potente

#### 4. Bajar temperature
- De 0.8 a 0.45 para la generación de borradores
- Mantener 0.3 para el análisis de estilo si se conserva

#### 5. Prompt reescrito con enfoque de imitacion directa
- En vez de describir el estilo con labels, pegar los mensajes reales y decir "escribe EXACTAMENTE como estos ejemplos"
- Incluir instrucciones anti-diplomatico mas agresivas
- Añadir regla: "Si el usuario escribe mensajes cortos de 1-2 lineas, tus sugerencias deben ser de 1-2 lineas"

### Resultado esperado
Los borradores sonarán como si los hubieras escrito tú, con tu vocabulario real, tu longitud de mensaje habitual, tu nivel de formalidad/informalidad y tus muletillas.

