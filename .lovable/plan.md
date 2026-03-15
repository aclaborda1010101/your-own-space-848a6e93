

# Plan: Indicador de sincronización y estado de actualización en WhatsApp Live

## Problema
El panel actual muestra que el webhook responde, pero no queda claro si los datos están al día. No hay feedback visual de "todo está sincronizado" o "hay algo pendiente".

## Solución
Mejorar el panel WhatsApp Business Live con:

1. **Timestamp de última comprobación** -- mostrar "Datos actualizados a las HH:MM" junto al botón de refresh, para que sepas cuándo fue la última vez que se consultó
2. **Barra de estado global** -- un banner resumen tipo "✓ Todo sincronizado" (verde) o "⚠ Sin actividad en X horas" (amarillo) que dé confianza de un vistazo
3. **Detalle de cobertura** -- en la tarjeta de contactos vinculados, añadir "de X contactos totales" para saber si hay contactos sin vincular wa_id
4. **Auto-refresh al entrar** -- ya existe, pero añadir un indicador de "Actualizado hace X min" que se actualice en tiempo real

## Cambios en `src/pages/DataImport.tsx`

### Estado adicional
- `waLastChecked: Date | null` -- timestamp de cuándo se cargaron las stats por última vez
- `waTotalContacts: number` -- total de contactos (para mostrar "X de Y vinculados")

### En `loadWaLiveStats`
- Al terminar la carga, guardar `setWaLastChecked(new Date())`
- Añadir query adicional: `people_contacts` count total del user (sin filtro wa_id) para comparar contra vinculados

### En la UI del panel Live
- **Banner de estado global** arriba del todo:
  - Verde: "✓ Sincronización activa" si último mensaje < 24h Y webhook OK
  - Amarillo: "⚠ Sin actividad en las últimas X horas" si último mensaje > 24h
  - Gris: "Sin datos aún" si no hay mensajes
- **"Actualizado hace X min"** junto al botón refresh, usando `waLastChecked` con un interval que re-renderiza cada minuto
- **Tarjeta de contactos**: cambiar de solo "Contactos vinculados" a "X de Y contactos" con una mini barra de progreso (Progress component ya existe en el proyecto)
- **Webhook status**: integrar dentro del banner global en vez de ser un botón separado, o dejarlo como está pero que el banner global lo tenga en cuenta

### Componentes existentes utilizados
- `Progress` de `src/components/ui/progress.tsx` para la barra de cobertura de contactos
- `Badge` de `src/components/ui/badge.tsx` para el estado global

No se necesitan cambios de backend ni de base de datos.

