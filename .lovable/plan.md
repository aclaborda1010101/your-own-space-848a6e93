

## Diagnostico real del problema

He investigado a fondo y encontrado **dos problemas distintos**:

### Hallazgo 1: La URL publicada SI carga la pagina de login

Cuando accedi a `https://pure-logic-flow.lovable.app` directamente, la pagina de login **renderiza correctamente**. Esto significa que el problema de "Cargando JARVIS..." ya esta corregido con los cambios anteriores, **pero necesitas publicar (Update) los cambios mas recientes**. La version live probablemente esta sirviendo un build antiguo.

### Hallazgo 2: BUG CRITICO en produccion - `react-markdown` marcado como `external`

En `vite.config.ts` linea 36:
```
build: {
  rollupOptions: {
    external: ['react-markdown']
  }
}
```

Esto le dice a Vite que **NO incluya** `react-markdown` en el bundle de produccion. Sin embargo, `AgentChatFloat.tsx` (que se carga en TODAS las paginas protegidas via `AppLayout`) importa `react-markdown` directamente. 

**Resultado**: Despues de hacer login, al cargar el dashboard u otra pagina protegida, el navegador intenta importar `react-markdown` desde una URL externa que no existe, provocando un crash silencioso que deja la app colgada en el spinner de carga.

Otros archivos afectados: `OpenClawChat.tsx`, `PotusCompactChat.tsx`.

### Plan de correccion

#### 1. Eliminar `react-markdown` de rollup externals (`vite.config.ts`)
Quitar la configuracion `external: ['react-markdown']` para que Vite lo incluya en el bundle de produccion como cualquier otra dependencia.

#### 2. Eliminar el link al manifest PWA (`index.html`)
Quitar `<link rel="manifest" href="/manifest.webmanifest" />` para evitar que Chrome intente registrar un SW o cachear la app como PWA, fuente recurrente de los problemas de cache.

#### 3. Publicar los cambios
Despues de aplicar los cambios, el usuario debe hacer click en "Update" para desplegar la version corregida.

### Archivos a modificar
- `vite.config.ts` -- eliminar `external: ['react-markdown']`
- `index.html` -- eliminar `<link rel="manifest">` 

