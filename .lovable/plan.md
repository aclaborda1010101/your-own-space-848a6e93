
# Mejorar conversaciones y sugerencias en Brain Dashboard

## Problema actual

1. **Conversaciones**: Solo muestran el texto del `summary` (que a veces es transcripcion cruda), sin un titulo claro tipo "Reunion de trabajo con clientes mexicanos"
2. **Sugerencias**: Solo muestran el tipo (Tarea, Evento...) y un titulo corto, pero no se pueden expandir para ver los detalles ni entender a que obedecen antes de aceptar/rechazar

## Solucion

### 1. Conversaciones con titulo

- El campo `metadata.title` ya existe en `conversation_embeddings` y contiene titulos como "Reunion de trabajo y comida de negocios con clientes mexicanos"
- Modificar la query para incluir `metadata`
- Mostrar `metadata.title` como encabezado en negrita de cada conversacion
- Debajo, mantener el `summary` como texto secundario (truncado a 2 lineas)

### 2. Sugerencias expandibles con detalle

- Cada sugerencia tiene en su campo `content` (JSONB):
  - `content.label`: titulo corto (ej: "Implementar sistema de seguimiento de llamadas")
  - `content.data.description`: descripcion detallada
  - `content.data.category`, `content.data.priority`: metadata adicional
- Hacer cada sugerencia expandible (click para ver/ocultar detalles)
- Al expandir, mostrar:
  - Descripcion completa
  - Prioridad y categoria si existen
  - Botones de Aceptar / Rechazar mas visibles
- Al aceptar una tarea, se crea en la tabla `tasks` (logica ya implementada en el ultimo cambio)

## Detalles tecnicos

### Archivo a modificar: `src/pages/BrainDashboard.tsx`

**Cambio 1 - Query de conversaciones**: Anadir `metadata` al SELECT

```text
.select("id, date, brain, summary, people, transcription_id, metadata")
```

**Cambio 2 - Render de conversaciones**: Mostrar titulo desde metadata

```text
// Extraer titulo
const title = (conv.metadata as any)?.title;

// Render
<p className="text-sm font-medium text-foreground">{title || "Conversacion"}</p>
<p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{conv.summary}</p>
```

**Cambio 3 - Sugerencias expandibles**: Usar estado local para controlar que sugerencia esta expandida

```text
const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
```

Cada sugerencia sera clickeable para expandir/colapsar. Al expandir se muestran:
- `content.data.description` completa
- Badges de prioridad y categoria
- Botones de accion (Aceptar / Rechazar) mas prominentes

### Sin cambios de esquema

No se necesitan migraciones. Los datos (`metadata.title`, `content.data`) ya existen en la base de datos.
