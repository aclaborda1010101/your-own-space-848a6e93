

## Plan: Ampliar y crear RAGs especializados para JARVIS

### Estado actual
El sistema tiene 8 RAGs embebidos en `rag-loader.ts` con contenido resumido (~40-80 líneas cada uno). Existen archivos `.md` extendidos en `supabase/functions/_shared/rags/` pero NO se usan en runtime (el contenido embebido en el .ts es lo que se sirve).

### RAGs a actualizar/crear

| RAG | Estado actual | Acción |
|-----|--------------|--------|
| **coach** | Existe (~34 líneas, básico) | Ampliar con metodologías completas del .md extendido (~576 líneas) |
| **nutrition** | Existe (~38 líneas, básico) | Ampliar con cálculos TMB/TDEE, macros por objetivo, timing, suplementos del .md (~837 líneas) |
| **bosco** | Existe (~210 líneas, bueno) | Ampliar con inteligencias múltiples de Gardner, análisis PLAUD, perfil evolutivo |
| **english** | Existe (~30 líneas, básico) | Ampliar con CEFR assessment, ejercicios por nivel, errores españoles, shadowing del .md (~865 líneas) |
| **ia-formacion** | Existe (~30 líneas, solo adultos) | Ampliar + crear versión niños separada |
| **ia-formacion-kids** | NO EXISTE | Crear RAG de IA para niños (Scratch, conceptos lúdicos, edad 5-12) |
| **secretaria** | NO EXISTE | Crear RAG de secretaria/asistente ejecutivo (agenda, emails, priorización, gestión del tiempo) |
| **contenidos** | Existe (~36 líneas) | Mantener (no solicitado) |

### Implementación técnica

1. **Actualizar `rag-loader.ts`**: Reemplazar los 8 RAGs actuales con versiones ampliadas (~200-400 líneas cada uno, equilibrando profundidad vs tamaño del bundle)
2. **Crear 2 nuevos RAGs**:
   - `ia-kids`: Profesor de IA/tecnología para niños (Scratch, Blockly, pensamiento computacional, actividades lúdicas por edad)
   - `secretaria`: Asistente ejecutivo (gestión de agenda, priorización GTD/Eisenhower, gestión email, preparación reuniones, seguimientos)
3. **Actualizar `AGENT_NAMES`** y **`SPECIALISTS`** en `jarvis-gateway` para incluir los nuevos agentes
4. **Actualizar triggers de detección** en el gateway para los nuevos especialistas

### Contenido clave por RAG

**Coach (ampliado)**: Sesiones diarias/semanales/mensuales, Fear Setting completo, protocolos por emoción, accountability levels, integración WHOOP, preguntas poderosas categorizadas.

**Nutrición (ampliado)**: Harris-Benedict TMB, factores actividad, macros por objetivo (perder/ganar/mantener), ajustes por WHOOP recovery, timing pre/post entreno, listas de alimentos, suplementos por tier, escenarios especiales (restaurante, viaje).

**Bosco (ampliado)**: Radar de Gardner (8 inteligencias), análisis de transcripciones PLAUD, perfil evolutivo por área, actividades por zona de desarrollo próximo.

**English (ampliado)**: Test CEFR inicial, plan por nivel, errores típicos hispanohablantes, chunks por situación, shadowing method, connected speech, evaluación progreso.

**IA Formación (ampliado)**: Transformers en profundidad, RAG architecture, agentes, fine-tuning, prompting avanzado, recursos, papers clave.

**IA Kids (nuevo)**: Scratch/Blockly por edad, pensamiento computacional sin código, IA explicada con analogías infantiles, proyectos padre-hijo, seguridad digital.

**Secretaria (nuevo)**: GTD + Eisenhower, gestión inbox zero, preparación briefings, seguimiento tareas, priorización inteligente, plantillas comunicación, gestión calendario.

### Archivos a modificar
- `supabase/functions/_shared/rag-loader.ts` - Contenido RAG + AGENT_NAMES
- `supabase/functions/jarvis-gateway/index.ts` - SPECIALISTS array con nuevos triggers

### Estimación
- ~2000 líneas de contenido RAG nuevo/ampliado
- El bundle de la edge function crecerá pero se mantiene dentro de límites (~50KB de texto)

