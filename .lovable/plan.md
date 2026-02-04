

## Objetivo
Añadir el acceso al módulo de **Contenido** (`/content`) en la navegación de la aplicación, ya que actualmente la ruta existe pero no hay forma de acceder a ella desde el menú lateral ni desde el dashboard.

## Problema identificado
- La página `/content` existe (`src/pages/Content.tsx`) con funcionalidad completa de generación de contenido, stories, banco de contenido, etc.
- El hook `useJarvisPublications` y la Edge Function `jarvis-contenidos` están implementados
- **Sin embargo**, el módulo no aparece en:
  - `SidebarNew.tsx` (navegación lateral desktop)
  - `BottomNavBar.tsx` (solo tiene 5 items fijos para móvil)
  - No hay acceso directo desde el Dashboard

## Cambios propuestos

### 1. Añadir "Contenido" al Sidebar lateral (`SidebarNew.tsx`)
Añadir el módulo de Contenido en la sección de **Módulos** junto a Noticias IA, Nutrición, Finanzas y Bosco:

```typescript
import { PenLine } from "lucide-react"; // Nuevo icono

const moduleItems = [
  { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
  { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition" },
  { icon: Wallet, label: "Finanzas", path: "/finances" },
  { icon: Baby, label: "Bosco", path: "/bosco" },
  { icon: PenLine, label: "Contenido", path: "/content" }, // ← Nuevo
];
```

### 2. Añadir acceso rápido desde el Dashboard (opcional pero recomendado)
Podríamos añadir una tarjeta de "Contenido" en las Quick Actions del Dashboard para acceso rápido en móvil, dado que el BottomNavBar tiene espacio limitado.

## Archivos a modificar
- `src/components/layout/SidebarNew.tsx` - Añadir enlace a Contenido en moduleItems

## Resultado esperado
- El módulo de Contenido será visible en el menú lateral (desktop)
- Los usuarios podrán acceder a `/content` directamente desde la navegación
- Consistencia con la arquitectura de "módulos expertos especializados" documentada en la memoria del proyecto

