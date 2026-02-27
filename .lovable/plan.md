

## Plan: Actualizar GEMINI_API_KEY

El secret `GEMINI_API_KEY` ya existe en tu proyecto. El plan es simple:

1. **Actualizar el secret `GEMINI_API_KEY`** con tu nueva clave válida de Google AI Studio
2. **Verificar** que la función `project-wizard-step` funciona correctamente llamándola después de la actualización

Tu nueva clave la puedes obtener en [Google AI Studio](https://aistudio.google.com/apikey) si aún no la tienes.

### Nota técnica
La función `project-wizard-step/index.ts` usa `GEMINI_API_KEY` con prioridad sobre `GOOGLE_AI_API_KEY`. Ambos secrets deben tener una clave válida, pero `GEMINI_API_KEY` es el que se usa directamente en esta función.

