

# Fix: "No es esta persona" debe abrir selector de contactos

## Problema actual

Cuando hay un "Posible match" en la Red de Contactos Mencionados, el boton "No es esta persona" llama a `onIgnoreContact`, que marca la mencion como ignorada permanentemente. El usuario pierde la oportunidad de vincular con otro contacto.

## Solucion

Cambiar el comportamiento del boton "No es esta persona" (linea 913-916) para que en vez de ignorar, abra el mismo Popover/Combobox de busqueda de contactos que ya existe en el caso sin match (lineas 920-953).

## Cambio concreto

En `src/pages/StrategicNetwork.tsx`, dentro del bloque `potentialMatch && !existingLink` (lineas 907-917):

**Antes:**
```
<Button variant="outline" ...> Vincular con {potentialMatch.name} </Button>
<Button variant="ghost" ... onClick={() => onIgnoreContact(contactId, c.nombre)}>
  No es esta persona
</Button>
```

**Despues:**
```
<Button variant="outline" ...> Vincular con {potentialMatch.name} </Button>
<Popover open={linkingName === c.nombre && linkSearchOpen} onOpenChange={...}>
  <PopoverTrigger asChild>
    <Button variant="ghost" ... onClick={() => { setLinkingName(c.nombre); setLinkSearchOpen(true); }}>
      No es esta persona
    </Button>
  </PopoverTrigger>
  <PopoverContent>
    <Command> ... lista de contactos para buscar y seleccionar ... </Command>
  </PopoverContent>
</Popover>
```

Es reutilizar el mismo patron de Popover+Command que ya existe en las lineas 920-953 para el caso sin match. El boton cambia de "ignorar" a "abrir buscador de contactos".

## Archivo a modificar

- `src/pages/StrategicNetwork.tsx` — lineas 908-917: reemplazar el boton "No es esta persona" por un Popover con buscador de contactos

## Sin cambios de base de datos

No se necesitan cambios en tablas ni edge functions.
