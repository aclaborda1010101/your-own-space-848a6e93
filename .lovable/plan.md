

## Diagnóstico

El botón **"Regenerar"** solo aparece cuando el estado del RAG es `failed`, `completed` o `cancelled`. Tus dos RAGs están en estado **`post_processing`**, que no está en esa lista, por eso solo ves "Eliminar".

**Estados actuales:**
- Regulación alarmas → `post_processing` (0 fuentes, 0 chunks)
- Conducta hijo → `post_processing` (80 fuentes, 34 chunks)

## Plan

Añadir `post_processing` a la condición que muestra el botón "Regenerar" en `src/pages/RagArchitect.tsx`. Cambiar:

```
["failed", "completed", "cancelled"].includes(selectedRag.status)
```

por:

```
["failed", "completed", "cancelled", "post_processing"].includes(selectedRag.status)
```

Es un cambio de una línea. Así podrás regenerar los RAGs que se quedaron atascados en post-procesamiento.

