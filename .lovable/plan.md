
El usuario me da feedback masivo de la versión móvil + una petición funcional importante (chat omnisciente). Voy a planificarlo todo en un solo plan estructurado.

## Auditoría rápida necesaria

Antes de plantear, necesito confirmar:
- Estado actual del header del Dashboard (saludo, Jarvis Online, dot del clima).
- BottomNavBar actual vs el de la maqueta (Hoy · Tareas · JARVIS · Salud · Menú).
- PageHero ya creado pero no aplicado en todas las páginas.
- Estructura del chat POTUS (`potus-core`) — qué contexto recibe ya.

## Plan

### A. Sistema móvil — fixes globales

1. **BottomNavBar rediseño** según maqueta:
   - 5 items: Hoy · Tareas · **JARVIS (centro, círculo verde grande)** · Salud · Menú
   - "Menú" abre sheet a pantalla completa con TODO (Proyectos, Detector, Auditoría, Importar, Red Estratégica, OpenClaw, Ajustes…).
   - Eliminar items duplicados arriba.

2. **Regla global "no scroll horizontal en móvil"**:
   - Convertir todos los TabsList horizontales en `<Select>` cuando `isMobile`.
   - Helper component `<MobileTabsSelector>` reusable.

3. **Regla global "botones full-width en móvil"**:
   - Acción primaria: `w-full` en stack vertical.
   - Acción secundaria: `w-full` debajo, no al lado.

### B. Pantallas concretas

4. **Dashboard `/`**:
   - Saludo "Buenas tardes, Agustín" en UNA línea (truncate o `text-2xl` mobile).
   - "JARVIS Online" badge pequeño inline, no bloque.
   - Quitar dot de estado del widget de clima.
   - Botones Iniciar día / + / Calendario → `w-full` en stack vertical en móvil.

5. **Tareas**:
   - Input "Nueva tarea" con selector inline de tipo (Profesional · Personal · Privado) como pills compactos.
   - Lista de pendientes: cards verticales sin overflow horizontal.

6. **Calendario**:
   - Celdas día más cuadradas (`aspect-square`).
   - Punto debajo si hay tareas.
   - Tap → panel inferior con tareas del día.

7. **Salud**:
   - Recuperación: número GIGANTE (`text-7xl` serif italic) coloreado dinámicamente (rojo <34, amarillo 34-66, verde >66).
   - Mensaje italic debajo ("Estás en rojo. Prioriza descanso.").
   - Métricas circulares (Sueño/Esfuerzo/HRV) → reemplazar por anillos SVG con gradient + glow neon en lugar de cards planas.

8. **Proyectos (lista)**:
   - "Nuevo proyecto" full-width.
   - Quitar "Compartir" del header (compartir es por proyecto individual).

9. **Proyecto detalle**:
   - Header limpio: título grande, badge "Paso 4/4" debajo en línea propia, descripción MVP en otra.
   - **Nueva pestaña "Resumen"** como página principal (no acordeón), reemplaza acordeón actual.

10. **Detector de patrones (proyecto)**:
    - Botones Reanalizar / Nuevo análisis / Exportar Forge → full-width stack.
    - Tabs (Fuentes, Quality Gate, etc.) → `<Select>` en móvil.

11. **Auditoría IA**:
    - Lista: cards mismo ancho (`grid-cols-1` móvil estricto).
    - Detalle: tabs (Cuestionario, Radiografía, Plan por capas) → `<Select>`.
    - Header con título + sector apilados, color de acento.
    - Botones acción → full-width.

12. **Importar**:
    - WhatsApp/Email/Plaud cards: títulos en una línea (truncate o `text-base`), iconos consistentes.
    - Plaud: layout limpio, botones full-width.
    - Email/Gmail: corregir overflow del bloque.

13. **Red Estratégica**:
    - Filtros (Relación/Salud/Actividad) → `<Select>` o full-width pills.
    - **Ficha contacto**: 
      - Quitar "CP" raro junto a iniciales.
      - Cuadrar avatar+nombre+badges en grid limpio.
      - Strip "Confianza 80% · hace un mes" reordenado.
      - "Profesional · Histórico · Denso" sin overflow.
      - Tabs (Resumen/WhatsApp/Email/Plaud/Datos) → `<Select>` móvil.

### C. Chat omnisciente (petición funcional clave)

14. **`potus-core` enriquecimiento de contexto**:
    - Ya carga: tasks, whoop, profile, WhatsApp.
    - **Añadir**: contactos top (people_contacts con scores), proyectos activos (business_projects), patrones detectados recientes, tendencias salud 7d, sesiones coach recientes, Bosco insights.
    - **Cambiar system prompt**: de "asistente operativo" a "**sistema operativo personal omnisciente con inteligencia emocional**". Que pueda opinar sobre relaciones, dietas, cansancio, evolución de proyectos sin auto-censurarse como "secretario".
    - Detección de intent ampliada: si pregunta sobre persona X → cargar ficha de ese contacto. Si pregunta sobre proyecto Y → cargar resumen del proyecto. Si pregunta sobre salud → cargar histórico WHOOP.

15. **Memoria de personalidad**: 
    - Guardar regla en `mem://ia/potus-omnisciente-personal-os-v1` para que no se pierda.

### Orden de ejecución sugerido
1. BottomNavBar + MobileTabsSelector (infra)
2. Dashboard + Salud (visibles primero)
3. potus-core omnisciente
4. Tareas + Calendario
5. Proyectos + Detector + Auditoría
6. Importar + Red Estratégica fixes

### Lo que NO se toca
- Edge functions de podcast (recién arregladas).
- Lógica de WHOOP / Bosco / coach.
- Calendario lógica, solo estilo de celdas.

¿Apruebas? Si sí, arranco por la infra (BottomNav + MobileTabsSelector + potus-core omnisciente) y voy enviando lotes.
