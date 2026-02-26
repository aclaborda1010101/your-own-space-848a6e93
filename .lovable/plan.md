

## Diagnosis: Duplicate Sidebar Instances Causing Visual Glitches

### Root Cause

6 pages render their **own** `SidebarNew` + `TopBar` + `useSidebarState()` internally, while **also** being wrapped in `<ProtectedPage>` which includes `<AppLayout>` (which already renders `SidebarNew` + `TopBar`). This creates **two overlapping sidebars** on these pages:

1. `Communications.tsx`
2. `BrainsDashboard.tsx`
3. `BoscoAnalysis.tsx`
4. `Bosco.tsx`
5. `Content.tsx`
6. `StartDay.tsx`

When you navigate to one of these pages, you get:
- AppLayout's sidebar (from `ProtectedPage` wrapper)
- The page's own sidebar (rendered inside the page component)

These two sidebars have **independent state** (`useSidebarState` creates a new `isOpen`/`isCollapsed` per instance), so collapsible sections (Proyectos, Bosco, Formación, Datos) appear/disappear inconsistently. The second sidebar can overlay or conflict with the first, making submenus seem to vanish.

### Fix

Remove the duplicate `SidebarNew`, `TopBar`, `useSidebarState`, and `BottomNavBar` from all 6 pages. Each page should become a pure content container, since `AppLayout` already provides the full navigation shell.

For each of the 6 files:
- Remove `import { SidebarNew }` and `import { TopBar }` and `import { useSidebarState }`
- Remove the `useSidebarState()` hook call
- Remove the `<SidebarNew ... />` JSX
- Remove the `<TopBar ... />` JSX
- Remove the wrapping `<div className="min-h-screen bg-background">` (AppLayout provides this)
- Keep only the page's main content, wrapped in a simple container like `<main className="p-4 lg:p-6">`

### Files Modified

| File | Change |
|------|--------|
| `src/pages/Communications.tsx` | Remove duplicate SidebarNew, TopBar, useSidebarState; simplify to content-only |
| `src/pages/BrainsDashboard.tsx` | Same |
| `src/pages/BoscoAnalysis.tsx` | Same |
| `src/pages/Bosco.tsx` | Same (has two render paths, both with duplicate sidebar) |
| `src/pages/Content.tsx` | Same |
| `src/pages/StartDay.tsx` | Same |

### Technical Details

The `AppLayout` component (line 16-76) already handles:
- `SidebarNew` with proper state management
- `TopBar` with menu toggle
- `BottomNavBar` for mobile
- `PotusStatusBar` for JARVIS voice
- Content area with proper sidebar offset (`lg:pl-20` / `lg:pl-72`)

Each page just needs to render its content as `children` of `AppLayout`. No sidebar/topbar/layout logic needed inside individual pages.

### Impact

- Fixes the "disappearing submenus" bug permanently
- Eliminates duplicate sidebar state management
- Reduces bundle size slightly (fewer imports per page)
- Ensures consistent navigation behavior across all routes

