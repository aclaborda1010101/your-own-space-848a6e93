
El usuario:
1. Quiere que termine la integración pendiente de `ContactDetail.tsx` (tabs con WhatsAppTab/EmailTab/PlaudTab/ProfileKnownData/SuggestedResponses + perfil ProfileByScope) — eso quedó a medias.
2. Ha subido `Jarvis.zip` con un nuevo `index.css` y `tailwind.config.ts` rediseñados que quiere reemplazar enteros.

Necesito explorar el zip antes de hacer nada.

## Plan

### Fase 1 — Aplicar nuevo diseño visual
1. Descomprimir `user-uploads://Jarvis.zip` en `/tmp/jarvis-design/`.
2. Identificar `index.css` y `tailwind.config.ts` dentro del zip.
3. **Reemplazar completamente** `src/index.css` con el del zip.
4. **Reemplazar completamente** `tailwind.config.ts` con el del zip.
5. Si el zip incluye otros assets (fuentes, imágenes), copiarlos a `src/assets/` o `public/` según corresponda.
6. Cache-bust en `src/main.tsx` para forzar recompilado.

### Fase 2 — Terminar `ContactDetail.tsx`
7. Cargar contacto + threads Plaud + recordings Plaud (queries existentes en la página vieja).
8. Estructurar layout final:
   - **Header glass**: avatar grande, nombre serif, badges, botones acción (WhatsApp/Llamar/Recordatorio).
   - **3 HeadlineCard** arriba (ya están).
   - **PodcastPlayer** (ya está, con 3 formatos: informativo / narrativo / diálogo).
   - **Tabs principales** con todo el detalle:
     - "Resumen" → ProfileByScope + ConversationTimeline + notas.
     - "WhatsApp" → WhatsAppTab + SuggestedResponses.
     - "Email" → EmailTab.
     - "Plaud" → PlaudTab.
     - "Datos conocidos" → ProfileKnownData.
9. Mantener estilo glassmorphism nuevo en toda la página.

### Fase 3 — Verificación
10. Typecheck mental: imports, props correctos para cada componente legacy.
11. Confirmar al usuario archivos modificados.

### Lo que NO se toca
- Lógica de podcast (ya correcta).
- Edge functions backend (ya correctas).
- Página `RedEstrategica.tsx` (al usuario le gusta).
- Otros módulos de la app.
