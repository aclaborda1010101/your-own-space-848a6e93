

## Plan: Búsqueda fuzzy de contactos en JARVIS WhatsApp search

### Problema
La búsqueda de contactos en `search_whatsapp_messages` usa `ilike` (substring exacto). Si el usuario escribe "Alvaro Benavides" pero el contacto se llama "Álvaro Benavides" (con tilde), o tiene cualquier errata, no lo encuentra y devuelve error.

### Solución
Usar la extensión `pg_trgm` (ya instalada) para búsqueda fuzzy con `similarity()`. Cambiar la lógica de resolución de contacto:

1. **Fallback fuzzy**: Si `ilike` no encuentra resultados, hacer una segunda query usando `similarity(name, 'término') > 0.3` ordenado por similitud.
2. **Normalización**: Hacer `unaccent`-style stripping antes de buscar (quitar tildes/acentos) en el edge function, o usar la función `similarity()` de pg_trgm que ya es tolerante a variaciones.

### Cambio en `jarvis-agent/index.ts`

En `executeSearchWhatsAppMessages`, reemplazar el bloque de resolución de contacto (líneas 364-378):

```typescript
if (args.contact_name) {
  const term = `%${args.contact_name}%`;
  // Try exact ilike first
  let { data: contacts } = await sb.from("people_contacts")
    .select("id, name")
    .eq("user_id", userId)
    .ilike("name", term)
    .limit(5);

  // Fallback: fuzzy search with pg_trgm similarity
  if (!contacts || contacts.length === 0) {
    const { data: fuzzyContacts } = await sb.rpc("search_contacts_fuzzy", {
      p_user_id: userId,
      p_search_term: args.contact_name,
      p_limit: 5
    });
    contacts = fuzzyContacts;
  }

  if (contacts && contacts.length > 0) {
    contactIds = contacts.map((c: any) => c.id);
    for (const c of contacts) contactNames[c.id] = c.name;
  } else {
    return JSON.stringify({ success: false, error: `No se encontró contacto "${args.contact_name}".` });
  }
}
```

### Nueva función SQL `search_contacts_fuzzy`

```sql
CREATE OR REPLACE FUNCTION public.search_contacts_fuzzy(
  p_user_id uuid,
  p_search_term text,
  p_limit integer DEFAULT 5
)
RETURNS TABLE(id uuid, name text)
LANGUAGE sql STABLE
AS $$
  SELECT pc.id, pc.name
  FROM public.people_contacts pc
  WHERE pc.user_id = p_user_id
    AND similarity(lower(pc.name), lower(p_search_term)) > 0.25
  ORDER BY similarity(lower(pc.name), lower(p_search_term)) DESC
  LIMIT p_limit;
$$;
```

Esto usa `pg_trgm.similarity()` que es tolerante a tildes, erratas y variaciones. Un threshold de 0.25 es suficiente para que "Alvaro Benavides" matchee con "Álvaro Benavides".

### Archivos
- **SQL**: crear función `search_contacts_fuzzy`
- **Editar**: `supabase/functions/jarvis-agent/index.ts` (fallback fuzzy en resolución de contacto)

