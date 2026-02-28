

## Diagnóstico: Pantalla blanca es problema de caché, no de código

He probado la app directamente en el navegador y **carga perfectamente** — muestra la página de login. El código actual es correcto.

**Causa real**: El preview iframe del usuario está sirviendo una versión cacheada antigua (pre-fixes) que no tiene el código corregido. Es un problema de caché del navegador/iframe, no del código.

**Solución en 2 partes**:

### 1. Añadir fallback visual en `index.html` (no depende de React)
Mostrar un loader/texto dentro de `<div id="root">` que sea visible inmediatamente mientras React carga. Si React falla silenciosamente, el usuario al menos verá "Cargando..." en vez de blanco total.

```html
<div id="root">
  <div style="min-height:100vh;display:flex;align-items:center;justify-content:center;background:#141b2d;color:#fff;font-family:sans-serif">
    <p>Cargando JARVIS...</p>
  </div>
</div>
```

### 2. Añadir Error Boundary global en `App.tsx`
Captura crashes de React y muestra un mensaje en vez de pantalla blanca, con botón para recargar.

### Archivos a modificar:
| Archivo | Cambio |
|---------|--------|
| `index.html` | Fallback visual dentro de `#root` |
| `src/App.tsx` | Envolver en ErrorBoundary con UI de fallback |

Esto garantiza que **nunca** se vea una pantalla completamente blanca, independientemente del estado de caché.

