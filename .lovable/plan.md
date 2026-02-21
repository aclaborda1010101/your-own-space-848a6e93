

# Fix: Forzar generacion de senales no convencionales en Phase 5

## Problema raiz

El codigo YA contiene las instrucciones para metricas compuestas en Phase 5 (lineas 615-642) y el catalogo de fuentes no convencionales en Phase 2 (lineas 260-274). Sin embargo, el modelo Gemini las ignora y genera solo senales convencionales (renta, densidad, accesibilidad).

La causa es que las instrucciones estan como "sugerencia" en el prompt del usuario, pero el system prompt no las menciona. El modelo prioriza generar senales "seguras" y omite las no convencionales.

## Solucion

Hacer las instrucciones imposibles de ignorar:

### Cambio 1: System prompt de Phase 5 reforzado

Mover las instrucciones de senales no convencionales al system prompt (no solo al user prompt). Incluir una regla explicita:

- "Para centros comerciales, las Capas 3-5 DEBEN contener senales no convencionales especificas. Si solo generas senales convencionales (renta, densidad, accesibilidad), tu respuesta es INCORRECTA."

### Cambio 2: Listar los signal_name exactos obligatorios

En vez de describir las senales de forma narrativa, listar los nombres exactos que DEBEN aparecer en el JSON de salida:

Capa 3 obligatorias:
- "Predictor Matricula Escolar"
- "Momentum Inmobiliario"
- "Proxy Gentrificacion Airbnb"
- "Atractor Fibra Optica"

Capa 4 obligatorias:
- "Proxy Saturacion Delivery"
- "Demanda Insatisfecha Google"
- "Dead Hours Traffic"
- "Indicador Teletrabajo Coworkings"
- "Proxy Poder Adquisitivo Gimnasios"
- "Crecimiento Empresarial LinkedIn"

Capa 5 obligatorias:
- "Latent Demand Score"
- "Future-Proof Index"
- "Climate Refuge Score"
- "Dead Hours Vitality Index"
- "Correlacion Pet Shops Demografia"

### Cambio 3: Instruccion de coexistencia

Anadir instruccion explicita: "Mantén las senales convencionales (son correctas para Capas 1-2) Y anade las senales no convencionales en Capas 3-5. Ambos tipos deben coexistir."

### Cambio 4: Evidencia contraria obligatoria

Para cada senal no convencional, pedir al modelo que genere contradicting_evidence especifica. Ejemplo: "Para Proxy Saturacion Delivery, la evidencia contraria podria ser que el tiempo de respuesta alto se debe a falta de repartidores, no a baja saturacion comercial."

### Cambio 5: Aumentar maxTokens de Phase 5

Con ~20 senales adicionales, el modelo necesita mas espacio. Subir maxTokens de 8192 a 12288 para Phase 5 en centros comerciales.

---

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | Reforzar system prompt Phase 5, listar signal_names obligatorios, subir maxTokens, anadir instruccion de coexistencia |

## Detalle tecnico

En la funcion `executePhase5` (linea 598):

1. Modificar el system prompt (linea 647) para incluir regla explicita sobre senales no convencionales cuando `sectorKey === "centros_comerciales"`

2. Reescribir `compositeMetricsBlock` (lineas 616-642) para ser mas directivo: listar los signal_name exactos, marcar como OBLIGATORIO, incluir evidencia contraria de ejemplo

3. Cambiar maxTokens en la llamada a chat (linea 701): si es centros comerciales, usar 12288

4. Reforzar la instruccion del user prompt para que diga "Las Capas 3-5 DEBEN contener MINIMO las senales listadas abajo. Puedes anadir mas, pero estas son obligatorias."

## Resultado esperado

- Las Capas 1-2 siguen con senales convencionales (correctas)
- La Capa 3 incluye matricula escolar, momentum inmobiliario, Airbnb, fibra optica
- La Capa 4 incluye delivery, Google Maps, dead hours, coworkings, gimnasios, LinkedIn
- La Capa 5 incluye las 5 metricas compuestas con formulas
- Cada senal tiene contradicting_evidence especifica
- Todas pasan por el Credibility Engine automaticamente

