
The user wants a button on the Strategic Network page to refresh "novedades" (updates/headlines) for all favorite contacts at once. There's already a `contact-profiles-refresh` edge function that does something similar for personality profiles, and a `get-contact-headlines` function that generates headlines per contact.

Let me check what exists for headlines refresh and favorites.

The right approach: create a bulk refresh action on `/red-estrategica` that iterates favorite/strategic contacts and calls `get-contact-headlines` with `force=true` for each.

## Plan: Botón "Actualizar novedades" en Red Estratégica

### Qué hace
Botón en la cabecera de `/red-estrategica` que regenera las "novedades" (headlines: salud, pendientes, temas/tono) de todos los contactos marcados como **favoritos** o **en red estratégica**, en segundo plano.

### Cambios

**1. Nueva edge function `contact-headlines-refresh`**
- Lee `people_contacts` del usuario donde `is_favorite = true` OR `in_strategic_network = true`
- Para cada uno (límite 25 por ejecución para evitar timeouts), invoca `get-contact-headlines` con `force: true`
- Procesa en lotes con pequeño delay (1.5s) para no saturar el LLM gateway
- Devuelve `{ refreshed, errors, total }`

**2. UI en `src/pages/RedEstrategica.tsx`**
- Botón **"Actualizar novedades"** (icono `RefreshCw`) junto a los KPIs/buscador de la cabecera
- Estado `refreshing` → spinner + texto "Actualizando X de Y..."
- Toast con resultado: `"Novedades actualizadas en N contactos"` o errores
- Al terminar, recarga la lista (`load()`) para reflejar cambios de salud

**3. Sin cambios de schema** — todo se apoya en tablas existentes (`people_contacts`, `contact_headlines`).

### Flujo
```text
[Usuario] → click "Actualizar novedades"
    ↓
[Frontend] supabase.functions.invoke("contact-headlines-refresh")
    ↓
[Edge fn] for each favorito (≤25):
    invoke get-contact-headlines { contactId, force:true }
    ↓
[Edge fn] regenera con LLM + upsert en contact_headlines
    ↓
[Frontend] toast resultado + reload
```

### Notas
- Se reutiliza la lógica ya probada de `get-contact-headlines` (no se duplica prompt).
- Limitar a 25 evita timeout del edge runtime y coste LLM excesivo. Si hay más favoritos, el botón muestra "Procesados los 25 más antiguos".
- Tras la aprobación se implementa, se despliega la función y se prueba desde la UI.
