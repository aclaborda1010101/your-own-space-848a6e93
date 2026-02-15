

# Arreglar visualizacion de tarjeta de tarea

## Problema

El componente PomodoroTimer se renderiza DENTRO de la tarjeta de tarea en vez de flotar sobre toda la pantalla. Esto ocurre porque SwipeableTask aplica CSS `transform` al contenedor padre, y en CSS cuando un elemento padre tiene `transform`, los hijos con `position: fixed` se posicionan relativo al padre transformado en vez del viewport. Ademas, el `overflow-hidden` del contenedor exterior corta el contenido del timer.

El resultado es que el timer de Pomodoro aparece encima del titulo de la tarea, tapandolo y rompiendo el layout visual de la tarjeta.

## Solucion

Mover el renderizado del PomodoroTimer fuera del arbol de SwipeableTask usando un portal de React (`createPortal`). Asi el timer se renderiza directamente en el `document.body`, escapando completamente del contexto de transformacion CSS.

## Seccion tecnica

### Archivo: `src/components/pomodoro/PomodoroButton.tsx`

- Importar `createPortal` de `react-dom`
- Envolver el renderizado de `PomodoroTimer` en un portal hacia `document.body`
- De esta forma, aunque PomodoroButton este dentro de un SwipeableTask con `transform`, el timer siempre se posiciona respecto al viewport

Cambio concreto:

```typescript
import { createPortal } from "react-dom";

// En el return, cambiar:
{isOpen && (
  <PomodoroTimer ... />
)}

// Por:
{isOpen && createPortal(
  <PomodoroTimer ... />,
  document.body
)}
```

Esto es un cambio de 2 lineas que resuelve el problema sin modificar ni SwipeableTask ni PomodoroTimer.

