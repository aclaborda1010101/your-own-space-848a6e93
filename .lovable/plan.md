

# Contactos CRM completo dentro de PLAUD

## Que hay ahora

- En el sidebar, PLAUD tiene: Transcripciones, Profesional, Personal, Familiar, Proyectos e Ideas
- "Profesional", "Personal" y "Familiar" apuntan a `/contacts?brain=X` y muestran solo la lista de contactos filtrada por cerebro
- No hay una vista general de "Contactos" (todos juntos)
- No se pueden editar los contactos (company, role, relationship, brain...)
- No se muestran los hilos/conversaciones relacionados con cada contacto
- La tabla `conversation_embeddings` tiene una columna `people` (array de nombres) que permite vincular conversaciones a contactos

## Que vamos a hacer

### 1. Agregar "Contactos" al sidebar dentro de PLAUD

Nuevo item en `plaudItems` entre "Familiar" y "Proyectos e Ideas":
- Icono: `Users`
- Label: "Contactos"  
- Path: `/contacts` (sin filtro de brain = vista general)

### 2. Vista de detalle de contacto con hilos

Al hacer clic en un contacto, se abre un dialog/panel que muestra:
- **Cabecera**: nombre, empresa, rol, brain, tags
- **Campos editables**: empresa, rol, relacion, brain, email, telefono
- **Hilos detectados**: lista de conversaciones de `conversation_embeddings` donde el nombre del contacto aparece en el array `people`, ordenados por fecha

### 3. Edicion inline de contactos

Dentro del dialog de detalle:
- Formulario para editar: `company`, `role`, `relationship`, `brain`, `email`
- Boton de guardar que hace UPDATE a `people_contacts`
- Cambiar el brain reclasifica el contacto entre Profesional/Personal/Familiar

### 4. Vista filtrada por brain mejorada (Profesional/Personal/Familiar)

Las vistas filtradas (`/contacts?brain=professional`, etc.) siguen funcionando igual pero ahora:
- Cada contacto es clickable y abre el dialog de detalle con sus hilos
- Se pueden editar los datos del contacto desde ahi

## Detalles tecnicos

### Sidebar (`SidebarNew.tsx`)
Agregar un item mas a `plaudItems`:
```text
{ icon: Users, label: "Contactos", path: "/contacts" }
```

### Pagina Contacts (`src/pages/Contacts.tsx`)
Cambios principales:
- Agregar estado para contacto seleccionado
- Crear componente `ContactDetailDialog` con:
  - Query a `conversation_embeddings` filtrando por `people` que contenga el nombre del contacto (usando `cs` - contains en Supabase)
  - Formulario de edicion con campos: company, role, relationship, brain, email
  - Lista de hilos con fecha, summary y brain
- Hacer cada `ContactCard` clickable para abrir el dialog

### Query de hilos por contacto
```text
supabase
  .from("conversation_embeddings")
  .select("id, date, brain, summary, people, transcription_id")
  .contains("people", [contactName])
  .order("date", { ascending: false })
  .limit(50)
```

### Archivos a modificar
1. `src/components/layout/SidebarNew.tsx` - agregar item "Contactos" a plaudItems
2. `src/pages/Contacts.tsx` - agregar dialog de detalle con hilos y edicion

### Sin cambios de esquema
No se necesitan migraciones. Las tablas `people_contacts` y `conversation_embeddings` ya tienen toda la estructura necesaria.

