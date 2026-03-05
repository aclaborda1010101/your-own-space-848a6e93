

## Plan: Auditoría de páginas y diagnóstico del menú viejo persistente

### Problema del menú viejo al iniciar sesión

Tras analizar el código, hay dos causas probables:

**Causa 1: PWA Service Worker sirve código viejo.** `vite-plugin-pwa` con Workbox cachea agresivamente todos los assets. Cuando despliegas cambios al sidebar, el SW puede seguir sirviendo el bundle anterior hasta que se active el nuevo SW. El guard `runtimeFreshness.ts` solo fuerza reload en el dominio publicado (no preview) y solo si detecta cambio de `BUILD_ID`. Si el SW cachea el HTML y los chunks JS, el usuario ve el sidebar antiguo hasta que el SW se actualice.

**Causa 2: `Sidebar.tsx` (viejo) sigue existiendo.** Aunque `AppLayout.tsx` importa `SidebarNew`, el archivo `Sidebar.tsx` con un menú completamente diferente (secciones "Hoy", "Progreso", etc.) sigue en el proyecto. No se usa activamente, pero su presencia es confusa.

**Solución propuesta (2 partes):**

1. **Eliminar `Sidebar.tsx`** — No tiene ningún import activo. Es dead code.

2. **Forzar limpieza de SW al login** — En `Login.tsx`, después de autenticación exitosa, ejecutar limpieza de caches y SW antes de navegar al dashboard. Esto garantiza que cada login carga código fresco.

### Inventario de páginas

```text
PÁGINA                  RUTA EN App.tsx          EN SIDEBAR    ESTADO
─────────────────────── ──────────────────────── ──────────── ─────────
Dashboard               /dashboard               Sí           ACTIVA
Chat                    /chat                     Sí           ACTIVA
ChatSimple              /chat-simple              No           SOSPECHOSA
Communications          /communications           Sí           ACTIVA
Tasks                   /tasks                    Sí           ACTIVA
Calendar                /calendar                 Sí           ACTIVA
Health                  /health                   Sí           ACTIVA
Sports                  /sports                   Sí           ACTIVA
Settings                /settings                 Sí           ACTIVA
Projects                /projects                 Sí           ACTIVA
ProjectWizard           /projects/wizard/:id      Sí (indirecto) ACTIVA
PatternDetectorPage     /projects/detector        Sí           ACTIVA
RagArchitect            /rag-architect             Sí           ACTIVA
RagEmbed                /rag/:ragId/embed          No           ACTIVA (embed público)
AuditoriaIA             /auditoria-ia              Sí           ACTIVA
AINews                  /ai-news                   Sí           ACTIVA
Nutrition               /nutrition                 Sí           ACTIVA
Finances                /finances                  Sí           ACTIVA
AgustinState            /agustin/state             Sí           ACTIVA
Content                 /content                   Sí           ACTIVA
Bosco                   /bosco                     Sí           ACTIVA
BoscoAnalysis           /bosco/analysis            Sí           ACTIVA
Coach                   /coach                     Sí           ACTIVA
English                 /english                   Sí           ACTIVA
AICourse                /ai-course                 Sí           ACTIVA
DataImport              /data-import               Sí           ACTIVA
StrategicNetwork        /strategic-network         No (desde Dashboard) ACTIVA
BrainsDashboard         /brains-dashboard          No           SOSPECHOSA
Onboarding              /onboarding                No (wizard)  ACTIVA
CalibrationDashboard    /calibracion-scoring       No           SOSPECHOSA
PublicQuestionnaire     /audit/:auditId/...        No (público)  ACTIVA
Login                   /login                     No (auth)    ACTIVA
Install                 /install                   No (PWA)     ACTIVA
Index                   / (redirect)               No           ACTIVA (redirect)
NotFound                * (404)                    No           ACTIVA
OAuthGoogle             /oauth/google              No (auth)    ACTIVA
OAuthGoogleCallback     /oauth/google/callback     No (auth)    ACTIVA

── ARCHIVOS SIN RUTA (dead code) ──
Logs                    /logs                      No           NO EN SIDEBAR
Analytics               /analytics                 No           NO EN SIDEBAR
Challenges              /challenges                No           NO EN SIDEBAR
StartDay                /start-day                 No           NO EN SIDEBAR

── COMPONENTES LAYOUT MUERTOS ──
Sidebar.tsx (viejo)     N/A (no importado)         N/A          DEAD CODE
```

**Páginas sospechosas** (tienen ruta pero no están en ningún menú ni enlazadas visiblemente):
- `ChatSimple` — `/chat-simple`: parece un chat alternativo sin usar
- `BrainsDashboard` — `/brains-dashboard`: no enlazado desde sidebar
- `CalibrationDashboard` — `/calibracion-scoring`: no enlazado desde sidebar
- `Logs` — `/logs`: tiene ruta pero no enlace
- `Analytics` — `/analytics`: tiene ruta pero no enlace
- `Challenges` — `/challenges`: tiene ruta pero no enlace
- `StartDay` — `/start-day`: tiene ruta pero no enlace

### Siguiente paso

Tú decides qué hacer con las páginas sospechosas. Por ahora, como pediste solo inventario, no se borra nada de páginas. Lo que sí propongo implementar ya:

1. **Eliminar `src/components/layout/Sidebar.tsx`** (dead code confirmado, 0 imports)
2. **Limpiar caches/SW en login** — añadir en `Login.tsx` una función que limpie Service Workers y caches antes de navegar al dashboard, para evitar que el menú viejo persista

