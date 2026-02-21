
# Fix: Cuestionario completado no permite generar radiografia

## Problema

Hay 3 bugs encadenados que causan el problema:

1. **`localResponses` no se sincroniza con el prop `responses`**: En `QuestionnaireTab`, `useState(responses)` solo captura el valor inicial. Cuando las respuestas se cargan desde la base de datos (via `loadExisting`), `localResponses` sigue vacio, asi que el contador muestra "0/12 respondidas" y el boton "Generar radiografia" queda deshabilitado.

2. **`saveResponses` destruye `_questions`**: Al guardar las respuestas del usuario, sobreescribe todo el campo `responses` en la base de datos, eliminando la key `_questions` que es necesaria para recargar las preguntas cuando no hay template.

3. **Sin feedback visual de guardado**: Las respuestas se guardan automaticamente al seleccionar cada opcion (lo cual esta bien), pero no hay indicacion visual de que se estan guardando, lo que confunde al usuario.

## Solucion

### 1. Sincronizar `localResponses` con el prop `responses` (`QuestionnaireTab.tsx`)

Anadir un `useEffect` que actualice `localResponses` cuando cambie el prop `responses`:

```tsx
useEffect(() => {
  setLocalResponses(responses);
}, [responses]);
```

### 2. Preservar `_questions` al guardar (`useBusinessLeverage.tsx`)

Modificar `saveResponses` para que incluya `_questions` en el JSON guardado, preservando el fallback:

```tsx
const saveResponses = useCallback(async (newResponses: Record<string, any>) => {
  setResponses(newResponses);
  if (responseId) {
    // Preserve _questions in the saved JSON
    const toSave = questionnaire
      ? { ...newResponses, _questions: questionnaire }
      : newResponses;
    await supabase.from("bl_questionnaire_responses")
      .update({ responses: toSave })
      .eq("id", responseId);
  }
}, [responseId, questionnaire]);
```

### 3. Mejorar la UI del boton de analisis (`QuestionnaireTab.tsx`)

- Mantener el boton "Generar radiografia" siempre visible (ya lo esta)
- Mostrar indicacion de progreso mas clara: "X/12 respondidas" ya existe, pero ahora funcionara correctamente con el sync de respuestas
- Anadir un pequeno texto explicativo cuando no estan todas respondidas

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/projects/QuestionnaireTab.tsx` | Anadir `useEffect` para sincronizar `localResponses` con prop `responses` |
| `src/hooks/useBusinessLeverage.tsx` | Modificar `saveResponses` para preservar `_questions` al guardar |

## Sin cambios de base de datos

No se requieren migraciones ni cambios de esquema.
