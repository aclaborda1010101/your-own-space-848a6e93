
# Plan: Restaurar Menu Completo + Corregir Barra de Navegacion Inferior

## Resumen

Hay dos problemas principales que resolver:

1. **Menu lateral incompleto**: La nueva version `SidebarNew.tsx` solo tiene 5 items (Dashboard, JARVIS, Comunicaciones, Salud, Deportes) cuando el usuario requiere 11 secciones completas
2. **Barra inferior redundante**: Se requiere simplificar a solo 3 items (Dashboard, JARVIS, Ajustes) dejando el resto de navegacion al sidebar

El error 404 de WHOOP ocurre cuando el OAuth redirige de vuelta a `/health` - esto NO es un error de ruta, sino que la integracion WHOOP aun no esta conectada (el backend funciona correctamente segun los logs de red que muestran `{"connected":false}`).

---

## Cambios Requeridos

### 1. Actualizar `SidebarNew.tsx` - Menu Completo

Anadir todas las secciones faltantes organizadas jerarquicamente:

```
MENU ESTRUCTURA:
==================
- Dashboard (principal)
- JARVIS (Chat)
- Comunicaciones
- Salud (WHOOP)
- Deportes
---[separador]---
- Noticias IA      ← FALTA
- Nutricion        ← FALTA
- Finanzas         ← FALTA
- Bosco            ← FALTA
---[separador]---
- Formacion (grupo colapsable):
  - Coach          ← FALTA
  - Ingles         ← FALTA
  - Curso IA       ← FALTA
---[separador]---
- Ajustes
```

**Implementacion**: Agregar los items faltantes al array `navItems` con sus iconos y rutas correspondientes, y crear una seccion `academyItems` con grupo colapsable usando el componente `Collapsible`.

### 2. Simplificar `BottomNavBar.tsx`

Reducir de 5 items (Inicio, Dia, Tareas, Agenda, Mas) a solo 3:

```
BARRA INFERIOR:
===============
| Dashboard | JARVIS | Ajustes |
```

**Cambios**:
- Eliminar: Dia (`/start-day`), Tareas (`/tasks`), Agenda (`/calendar`)
- Agregar: JARVIS (`/chat`)
- Mantener: Dashboard, boton Mas (que abre sidebar)
- Anadir: Ajustes directamente en la barra

---

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/layout/SidebarNew.tsx` | Agregar secciones faltantes + grupo Formacion colapsable |
| `src/components/layout/BottomNavBar.tsx` | Reducir a 3 items: Dashboard, JARVIS, Ajustes |

---

## Detalles Tecnicos

### SidebarNew.tsx - Items a agregar:

```typescript
// Nuevos imports necesarios
import { Newspaper, UtensilsCrossed, Wallet, Baby, GraduationCap, Brain as BrainIcon, Languages, Sparkles } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Items principales
const navItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: MessageSquare, label: "JARVIS", path: "/chat" },
  { icon: Mail, label: "Comunicaciones", path: "/communications" },
  { icon: Activity, label: "Salud", path: "/health" },
  { icon: Trophy, label: "Deportes", path: "/sports" },
];

// Modulos adicionales
const moduleItems = [
  { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
  { icon: UtensilsCrossed, label: "Nutricion", path: "/nutrition" },
  { icon: Wallet, label: "Finanzas", path: "/finances" },
  { icon: Baby, label: "Bosco", path: "/bosco" },
];

// Academia/Formacion
const academyItems = [
  { icon: Sparkles, label: "Coach", path: "/coach" },
  { icon: Languages, label: "Ingles", path: "/english" },
  { icon: BrainIcon, label: "Curso IA", path: "/ai-course" },
];
```

### BottomNavBar.tsx - Nueva estructura:

```typescript
const navItems = [
  { icon: LayoutDashboard, label: "Inicio", path: "/dashboard" },
  { icon: MessageSquare, label: "JARVIS", path: "/chat" },
  { icon: Settings, label: "Ajustes", path: "/settings" },
];
// Eliminar el boton "Mas" ya que todas las opciones estan en los 3 items principales
// O mantenerlo para acceso rapido al sidebar
```

---

## Resultado Visual Esperado

**Sidebar expandido:**
```
[JARVIS v2.0 Logo]
─────────────────
Dashboard           ★
JARVIS (Chat)
Comunicaciones
Salud
Deportes
─────────────────
Noticias IA
Nutricion
Finanzas  
Bosco
─────────────────
▼ Formacion
  - Coach
  - Ingles
  - Curso IA
─────────────────
Ajustes
[Usuario: agustin]
[Cerrar sesion]
```

**Barra inferior movil:**
```
┌─────────────────────────────────┐
│  Dashboard  │  JARVIS  │ Ajustes │
└─────────────────────────────────┘
```

---

## Notas sobre el Error 404 WHOOP

El "Error 404" que mencionas NO es un problema de rutas. Segun los logs de red:

- `POST /functions/v1/whoop-auth` → Status: 200 OK
- Respuesta: `{"connected":false}`

Esto significa que el backend funciona correctamente, pero la cuenta WHOOP aun no esta conectada. Al pulsar "Conectar WHOOP", te redirigira a la pagina de autorizacion de WHOOP, y una vez autorizado, volveras a `/health` con los datos sincronizados.
