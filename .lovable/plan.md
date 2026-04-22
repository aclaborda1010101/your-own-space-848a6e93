

## Fix: "no se pudo crear el contacto"

### Causa real (vista en logs de Postgres)

```
ERROR: new row for relation "people_contacts" violates check constraint
"people_contacts_category_check"
```

La tabla `people_contacts` tiene un CHECK constraint que solo permite estas categorías:

```
'profesional' | 'personal' | 'familiar' | 'pendiente'
```

En el insert nuevo estaba mandando `category: "manual"` → la base de datos rechaza la fila → toast de error.

### Cambio (1 línea)

**`src/components/contact/AddToNetworkDialog.tsx`** línea 195:

```diff
-  category: "manual",
+  category: "pendiente",
```

`pendiente` es la categoría correcta para contactos creados manualmente sin clasificar todavía. Más tarde puedes editarla desde la ficha del contacto.

### Por qué no fallaba con contactos importados

Los flujos de WhatsApp/Mac importan con `category` calculada (profesional/personal/familiar) o sin pasar el campo (entonces aplica el default `'profesional'`). Solo el flujo nuevo de "crear manual" mandaba un valor inválido.

### Verificación tras aplicar

1. Abrir `/red-estrategica` → botón **Añadir** → "Crear contacto nuevo".
2. Nombre: `Test Manual`, Teléfono: `+34600111222`.
3. Debe aparecer el toast verde "Test Manual creado y añadido a tu red" y el contacto en la lista.

