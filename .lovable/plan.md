
El usuario quiere rediseño completo de Red Estratégica:

1. **Listado** (`/red-estrategica`): grid/lista de contactos con estilo Holo Neon nuevo.
2. **Ficha de contacto** (`/red-estrategica/:contactId` o ruta propia): página dedicada con:
   - Arriba: resúmenes + titulares (HeadlineCards) destacados.
   - Podcast (que desapareció — recuperarlo).
   - Debajo: el resto de info (tabs WhatsApp/Email/Plaud/Perfil/Resumen).

Necesito investigar el estado actual primero: ¿qué rutas existen, qué componentes están en uso, y qué pasó con el podcast?

## Plan

### Fase 1 — Auditoría
1. Leer `src/pages/StrategicNetwork.tsx` (listado actual).
2. Leer `src/pages/ContactDetail.tsx` actual (ver si tiene podcast o se rompió).
3. Verificar rutas en `src/App.tsx` para confirmar la URL de la ficha.
4. Confirmar que `PodcastPlayer.tsx`, `HeadlineCard.tsx`, `useContactPodcast.ts` siguen existiendo.

### Fase 2 — Rediseño del listado
5. **`StrategicNetwork.tsx`** rediseño Holo:
   - Hero header (titular grande Space Grotesk + KPIs: total contactos, activos hoy, urgentes).
   - Filtros como pills HUD.
   - Grid responsivo de tarjetas glass con: avatar, nombre serif, sentiment dot, score, último contacto, badge urgencia.
   - Click → navega a la ficha.

### Fase 3 — Rediseño de la ficha
6. **`ContactDetail.tsx`** estructura:
   - **Header glass grande**: avatar 96px, nombre serif XL, company, badges (sentiment + tags), botones CTA (WhatsApp/Llamar/Recordatorio).
   - **Strip de 3 HeadlineCards** (titulares de IA: relación, oportunidades, riesgos).
   - **PodcastPlayer** restaurado y bien visible (con selector de formato: informativo/narrador/diálogo).
   - **ProfileByScope** (perfil personalidad/pipeline).
   - **Tabs principales** debajo: Resumen · WhatsApp · Email · Plaud · Datos.

### Fase 4 — Verificación
7. Confirmar imports/rutas; sin romper otras pantallas.

### Lo que NO se toca
- Edge functions del podcast.
- Lógica de contactos/threads/recordings.
- Otros módulos.
