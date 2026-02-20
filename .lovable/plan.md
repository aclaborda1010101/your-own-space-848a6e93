

# Fix: Cargar todos los contactos (mas de 1000)

## Problema

Supabase tiene un limite por defecto de 1000 filas por consulta. Aunque el codigo ya dice `.limit(5000)`, Supabase ignora valores mayores a 1000. Con 1141 contactos, solo se muestran los primeros 1000.

## Solucion

Reemplazar la consulta simple por una funcion que cargue contactos en lotes usando `.range()` de Supabase.

## Cambio tecnico

**Archivo:** `src/pages/StrategicNetwork.tsx`

En la funcion `fetchData` (linea ~1438-1441), reemplazar:

```text
supabase.from('people_contacts').select('*').order('name').limit(5000)
```

Por una funcion que haga fetch paginado:

```typescript
async function fetchAllContacts() {
  const pageSize = 1000;
  let allData: any[] = [];
  let from = 0;
  let done = false;
  while (!done) {
    const { data, error } = await supabase
      .from('people_contacts')
      .select('*')
      .order('name')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    if (data) allData = allData.concat(data);
    if (!data || data.length < pageSize) done = true;
    from += pageSize;
  }
  return { data: allData, error: null };
}
```

Luego usar `fetchAllContacts()` en el `Promise.all` en lugar de la consulta directa. Es un cambio localizado en la funcion `fetchData`.

## Resultado esperado

Se cargaran los 1141 contactos (y cualquier cantidad futura) sin estar limitado a 1000.

