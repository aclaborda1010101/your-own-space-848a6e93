

## Plan: Paneles de información más visuales, estructurados y plegables

### Problema actual
El panel de perfil de contacto en `ProfileByScope` tiene ~15 secciones (Historia, Estado, Situación, Evolución, Datos Clave, Métricas, Pipeline, Alertas, Red de Contactos, Acciones, Próxima Acción...) todas visibles a la vez como Cards apiladas. Es un muro de información sin jerarquía visual clara.

### Cambios propuestos

#### 1. Hacer todas las secciones plegables con `CollapsibleCard`
Cada sección actual (Card) se convierte en un `CollapsibleCard` con icono, título y estado plegado/desplegado persistente via `sessionStorage`. Esto ya existe en el proyecto (`src/components/dashboard/CollapsibleCard.tsx`).

**Secciones y estado por defecto:**

| Sección | Icono | Abierta por defecto |
|---------|-------|---------------------|
| Próxima Acción Recomendada | ArrowRight | Sí (moverla ARRIBA del todo) |
| Estado de la Relación | Activity | Sí |
| Situación Actual | FileText | Sí |
| Evolución Reciente | TrendingUp | No |
| Historia de la Relación | Clock | No |
| Datos Clave | Tag | Sí |
| Métricas de Comunicación | BarChart3 | No |
| Pipeline / Termómetro / Bienestar | (scope-specific) | Sí |
| Patrones Detectados | Eye | No |
| Alertas | AlertTriangle | Sí |
| Red de Contactos | Network | No |
| Acciones Pendientes | CheckSquare | Sí |

#### 2. Mover "Próxima Acción" arriba del todo + botón Enviar WA
- Extraer de `ProfileByScope` y renderizar en `ContactDetail` antes de los Tabs
- Añadir botón "Enviar por WhatsApp" cuando `canal === 'whatsapp'`
- Diálogo de confirmación + llamada a `send-whatsapp`

#### 3. Mejorar jerarquía visual
- Añadir badges de resumen en los headers de cada `CollapsibleCard` (ej: "📈 +15%" en métricas, "🔴 2 alertas")
- Usar colores de borde más diferenciados por tipo de sección
- Iconos consistentes en cada header

#### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/StrategicNetwork.tsx` | Refactorizar `ProfileByScope` para usar `CollapsibleCard`, mover próxima acción a `ContactDetail`, añadir botón enviar WA |

Un solo archivo principal. Se reutiliza `CollapsibleCard` existente sin crear componentes nuevos.

