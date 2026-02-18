

# Selector de contactos con busqueda

## Problema

El selector de contactos en la pagina de importacion WhatsApp es un `<Select>` dropdown estandar sin campo de texto. Con cientos de contactos, es imposible encontrar uno rapidamente.

## Solucion

Reemplazar el `<Select>` (lineas 739-756 de `DataImport.tsx`) por un **Combobox** con busqueda integrada usando los componentes `Popover` + `Command` (cmdk) que ya estan instalados.

El nuevo componente:
- Muestra un boton trigger que dice "Selecciona un contacto..." o el nombre del contacto seleccionado
- Al hacer clic, abre un popover con un campo de texto para escribir
- Filtra los contactos en tiempo real mientras escribes
- Al seleccionar uno, cierra el popover y actualiza el estado

## Cambios tecnicos

**Archivo: `src/pages/DataImport.tsx`**

1. Agregar imports de `Popover`, `PopoverContent`, `PopoverTrigger` y `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandItem`, `CommandGroup`
2. Agregar estado `contactSearchOpen` para controlar apertura del popover
3. Reemplazar el bloque `<Select>` (lineas 739-756) por:

```text
<Popover open={contactSearchOpen} onOpenChange={setContactSearchOpen}>
  <PopoverTrigger asChild>
    <Button variant="outline" className="w-full justify-between">
      {waSelectedContact
        ? existingContacts.find(c => c.id === waSelectedContact)?.name
        : "Buscar contacto..."}
      <ChevronsUpDown className="ml-2 h-4 w-4" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-full p-0">
    <Command>
      <CommandInput placeholder="Escribe para buscar..." />
      <CommandList>
        <CommandEmpty>No se encontro ningun contacto.</CommandEmpty>
        <CommandGroup>
          {existingContacts.map(c => (
            <CommandItem key={c.id} value={c.name} onSelect={() => {
              setWaSelectedContact(c.id);
              setContactSearchOpen(false);
            }}>
              <Check className={cn("mr-2 h-4 w-4",
                waSelectedContact === c.id ? "opacity-100" : "opacity-0")} />
              {c.name}
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

4. Agregar import de `ChevronsUpDown` de lucide-react

## Archivo a modificar

- `src/pages/DataImport.tsx` (unico archivo)
