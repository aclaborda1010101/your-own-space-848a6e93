

# Fix: Doble numero de mensajes (1000 vs 17484)

## Problema

El contacto "Carls Primo" tiene 17,484 mensajes en `contact_messages` y `wa_message_count = 17484`. Pero en la tab Perfil aparece "1000 (whatsapp)" porque la consulta en `ProfileKnownData` hace `.select('source')` sin limite, y Supabase aplica su limite por defecto de 1000 filas. Asi que devuelve solo 1000 filas y `data.length` da 1000.

## Solucion

**Archivo: `src/components/contacts/ContactTabs.tsx`**

En el componente `ProfileKnownData` (linea ~640), cambiar la query que cuenta mensajes:

**Antes:**
```typescript
const { data } = await supabase
  .from('contact_messages')
  .select('source')
  .eq('contact_id', contact.id);
if (data && data.length > 0) {
  const sources = [...new Set(data.map(m => m.source))];
  setMsgStats({ total: data.length, sources });
}
```

**Despues:**
```typescript
// 1. Contar total con count exact (sin traer filas)
const { count } = await supabase
  .from('contact_messages')
  .select('id', { count: 'exact', head: true })
  .eq('contact_id', contact.id);

// 2. Traer solo los sources distintos (pocas filas)
const { data: sourceData } = await supabase
  .from('contact_messages')
  .select('source')
  .eq('contact_id', contact.id)
  .limit(1000);

const sources = [...new Set(sourceData?.map(m => m.source) || [])];
if (count && count > 0) {
  setMsgStats({ total: count, sources });
}
```

Esto usa `count: 'exact'` para obtener el total real (17484) sin traer todas las filas, y solo trae los `source` para saber las fuentes (whatsapp, manual, etc).

Cambio minimo: solo se modifica la funcion `fetchMsgStats` dentro de `ProfileKnownData`.
