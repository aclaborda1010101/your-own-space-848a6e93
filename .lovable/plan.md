
# Anadir boton "Vincular contacto" en la pestana Contactos del proyecto

## Problema

La pestana "Contactos" del detalle de proyecto muestra "Sin contactos vinculados" cuando no hay ninguno, pero no ofrece ninguna forma de anadir contactos. El boton o mecanismo para vincular un contacto no existe en la UI.

## Solucion

Anadir un boton "Vincular contacto" que abra un Dialog con:
1. Un selector/buscador de contactos existentes (cargados desde `people_contacts`)
2. Un selector de rol (usando `PROJECT_ROLES` ya definido en el hook)
3. Boton de confirmar que llame a `addContact(projectId, contactId, role)`

## Cambios en `src/pages/Projects.tsx`

### En el componente `ProjectDetail` (lineas 200-210):

Anadir estados para el dialog de vincular contacto:
- `addContactOpen` (boolean)
- `allContacts` (lista de contactos del usuario, cargada desde `people_contacts`)
- `selectedContactId` (string)
- `selectedRole` (string)
- `contactSearch` (string para filtrar)

Cargar los contactos del usuario en el `useEffect` existente (linea 211-223).

### En la pestana "Contactos" (lineas 362-384):

- Anadir un boton "Vincular contacto" arriba de la lista (como ya existe en Timeline con "Anadir evento")
- Mostrar el boton tanto cuando hay contactos como cuando no hay (reemplazar el mensaje vacio por un estado vacio con CTA)

### Anadir un Dialog de vinculacion:

- Input de busqueda para filtrar contactos por nombre
- Lista de contactos filtrados para seleccionar
- Select de rol con `PROJECT_ROLES`
- Boton confirmar que llame a `addContact` y recargue la lista

## Archivo a modificar

| Archivo | Cambio |
|---------|--------|
| `src/pages/Projects.tsx` | Anadir estados, cargar contactos, boton + dialog de vincular contacto en la tab Contactos |

## Sin cambios de base de datos

Las funciones `addContact` y `fetchProjectContacts` ya existen en `useProjects`. Solo falta la UI para invocarlas.
