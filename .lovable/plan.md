
# Reestructuracion Completa del Menu Lateral JARVIS

## Resumen

Reorganizar el sidebar desde una lista plana a una jerarquia clara con PLAUD como seccion desplegable, badges numericos en JARVIS y Tareas, y secciones tematicas opcionales bajo un separador.

## Nueva estructura del menu

```text
Dashboard
JARVIS (con badge de sugerencias pendientes)
PLAUD (desplegable)
  ├── Transcripciones      --> /inbox
  ├── Profesional          --> /contacts?brain=professional
  ├── Personal             --> /contacts?brain=personal
  ├── Familiar             --> /contacts?brain=family
  └── Proyectos e Ideas    --> /projects
Calendario                 --> /calendar
Tareas (con badge de vencidas)
Comunicaciones
Ajustes

--- separador ---
(Solo si activadas en Ajustes)
Deportes, Nutricion, Finanzas, Salud, Noticias IA, Contenido

--- separador ---
Formacion (desplegable: Coach, Ingles, Curso IA)
```

## Cambios por fichero

### 1. `src/components/layout/SidebarNew.tsx` -- Reestructuracion completa

- **Items principales**: Dashboard, JARVIS, PLAUD (collapsible), Calendario, Tareas, Comunicaciones, Ajustes
- **PLAUD**: Seccion desplegable (Collapsible) con 5 sub-items indentados y fondo ligeramente distinto
- **Badges**: Query de sugerencias pendientes para badge en JARVIS; query de tareas vencidas para badge en Tareas
- **Eliminar**: Bosco, Proyectos y Contactos como items independientes (ahora viven dentro de PLAUD)
- **Secciones tematicas opcionales**: Deportes, Salud, Nutricion, Finanzas, Noticias IA, Contenido -- bajo separador, controladas por toggles
- **Formacion**: Se mantiene como desplegable al final

### 2. `src/pages/Contacts.tsx` -- Soporte para filtro por query param `brain`

- Leer `useSearchParams` para obtener `brain` (professional/personal/family)
- Si hay filtro, mostrar solo contactos de ese cerebro (mapear "family" a "bosco" en la query)
- Si no hay filtro, mostrar todos con tabs como ahora

### 3. `src/hooks/useUserSettings.tsx` -- Limpiar SectionVisibility

- Eliminar `bosco`, `projects`, `contacts` del tipo `SectionVisibility` (ya no son toggleables individualmente)
- Mantener: content, finances, nutrition, ai_news, sports, health, communications, academy

### 4. `src/components/settings/SectionVisibilityCard.tsx` -- Actualizar toggles

- Eliminar toggles de Bosco, Proyectos y Contactos
- Mantener toggles de las secciones tematicas opcionales

### 5. `src/App.tsx` -- Anadir ruta /calendar

- Verificar que todas las rutas (/inbox, /projects, /contacts, /calendar, /tasks) estan registradas (ya lo estan)

## Detalles tecnicos

### Badges numericos en el sidebar

```text
JARVIS: SELECT count(*) FROM suggestions WHERE status = 'pending' AND user_id = auth.uid()
Tareas: SELECT count(*) FROM tasks WHERE completed = false AND due_date < now() AND user_id = auth.uid()
```

Se usan queries ligeras con useQuery en el sidebar, con refetch cada 60 segundos.

### PLAUD sub-items con fondo diferenciado

Los sub-items de PLAUD se renderizan dentro de un CollapsibleContent con clase `bg-sidebar-accent/30 rounded-lg` para distinguirlos visualmente.

### Mapping de "family" a "bosco"

En Contacts.tsx, cuando `brain=family`, se filtra por `brain === "bosco"` en la base de datos (que es el valor almacenado).
