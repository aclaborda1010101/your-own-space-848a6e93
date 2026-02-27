

## Plan: Refinar prompts Fases 4-9 basándose en el benchmark Barquero

### Objetivo
Actualizar `src/config/projectPipelinePrompts.ts` para que los outputs automáticos de las Fases 4-9 repliquen la estructura, nivel de detalle y calidad del documento Barquero simulado manualmente.

### Cambios en `src/config/projectPipelinePrompts.ts`

#### Fase 4 — Auditoría Cruzada (líneas 240-282)
**System prompt**: Refinar para exigir el formato exacto del benchmark:
- Hallazgos con códigos `[H-XX]` secuenciales
- Clasificación por colores/severidad: 🔴 CRÍTICO, 🟠 IMPORTANTE, 🟢 MENOR
- Cada hallazgo DEBE incluir: sección afectada, problema, dato original textual (con minuto/referencia si existe), acción requerida, consecuencia de no corregir
- Tabla de puntuación por sección (0-100) con notas breves
- Recomendación final: APROBAR / APROBAR CON CORRECCIONES / RECHAZAR

**JSON schema**: Añadir campos `codigo` (`H-01`, `H-02`...), `dato_original_textual` (cita exacta), `consecuencia`, y la tabla `puntuación_por_sección` con `notas` descriptivas como en Barquero

#### Fase 5 — Documento Final (líneas 288-317)
**System prompt**: Refinar para que genere correcciones concretas por hallazgo:
- Para cada `[H-XX]`: mostrar exactamente qué texto se añade/modifica y en qué sección
- Las correcciones deben ser texto listo para insertar, no descripciones vagas
- Incluir nuevas secciones completas cuando aplique (ej: Fase 0, módulo nuevo, riesgo nuevo)
- Changelog con formato tabla: Hallazgo | Severidad | Acción tomada
- Marcar `[H-XX] → Ya cubierto con [H-YY]` cuando un hallazgo se resuelve con otro

**Build prompt**: Instruir que el output sea el documento completo reescrito + changelog, no solo las correcciones sueltas

#### Fase 6 — AI Leverage (líneas 323-372)
**System prompt**: Refinar para exigir el nivel de detalle del benchmark:
- Cada oportunidad en formato tabla con campos: Módulo, Tipo, Modelo, Cómo funciona (explicación técnica concreta), Coste API (con cálculo de volumen), Precisión esperada (% con justificación), Esfuerzo (horas), ROI (cálculo explícito), Es MVP (✅/❌), Dependencias
- Incluir oportunidades tipo `REGLA_NEGOCIO_MEJOR` cuando la IA NO es necesaria (honestidad como en Barquero: AI-004 y AI-006)
- Stack IA recomendado con justificación por componente
- Quick Wins claramente identificados con justificación

**JSON schema**: Añadir `como_funciona` (explicación técnica detallada), `calculo_volumen` para costes, hacer `roi_estimado` más explícito con cálculo (X horas × Y€ = Z€/año vs coste IA)

#### Fase 7 — PRD Técnico (líneas 378-447)
**System prompt y build prompt**: Refinar para incluir:
- Personas detalladas (3 mínimo) con: perfil demográfico, dispositivos, frecuencia de uso, nivel técnico, dolor principal, uso específico del sistema
- Modelo de datos como tabla con campos reales (no genéricos)
- Flujos paso a paso numerados por tipo de usuario (como flujo conductor y flujo administrativo del benchmark)
- Criterios de aceptación en formato DADO/CUANDO/ENTONCES con métricas concretas
- Stack con tecnologías concretas (no genéricas)

#### Fase 8 — Generación de RAGs (líneas 453-516)
**System prompt**: Refinar para exigir:
- Distribución por categoría con rangos (ej: "Funcionalidad: 18-22 chunks")
- Chunks de ejemplo completos con contenido autocontenido de 200-500 tokens (como CHK-001 del benchmark)
- FAQs con respuestas detalladas que expliquen el "por qué" de las decisiones (como FAQ Combustible del benchmark)
- Mínimo 45-60 chunks para proyectos medianos
- Config de embeddings con modelo, dimensiones, overlap y estrategia de splitting concretos

#### Fase 9 — Detección de Patrones (líneas 522-595)
**System prompt**: Refinar para exigir:
- Patrones con `componente_extraíble` con nombre de producto (ej: "DocCapture", "StepFlow")
- Oportunidades comerciales con pitch textual listo para usar en reunión
- Score del cliente como tabla con dimensiones específicas + siguiente contacto con fecha y motivo
- Señales de necesidades futuras con timing concreto (ej: "cuando lleven 3+ meses")
- Aprendizajes del proceso aplicables al pipeline interno

### Detalle técnico

Todas las ediciones son en un solo archivo. Los prompts se refinan manteniendo la estructura de funciones existente (`buildXxxPrompt`), solo se enriquece el contenido de los strings. No cambia ninguna interfaz ni firma de función.

### Archivos afectados
- `src/config/projectPipelinePrompts.ts` — Refinamiento de 6 system prompts y 6 build prompts (Fases 4-9)

