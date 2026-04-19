

## Plan: Red Estratégica curada + maquetación arreglada

### Problema 1 — La página muestra TODOS los contactos
Hoy `/red-estrategica` carga todo `people_contacts` del usuario, así que el botón "Actualizar novedades" no tiene sentido (procesa los 25 más antiguos de cientos). El usuario quiere **una lista propia, curada**, de los contactos que él decide vigilar.

**Solución**: usar la columna existente `in_strategic_network` (ya está en la BD) como fuente única.
- La página solo lista contactos con `in_strategic_network = true`.
- Botón **"+ Añadir contacto"** abre un modal con buscador sobre todo `people_contacts`; al elegir uno se hace `update { in_strategic_network: true }`.
- En cada card un botón **"Quitar de la red"** (icono X) que pone el flag a `false`.
- Empty state cuando la red está vacía: "Aún no tienes contactos vigilados — añade los primeros".
- El botón **"Actualizar novedades"** ya filtra por `is_favorite OR in_strategic_network`, así que automáticamente actualizará solo los que el usuario haya añadido.

### Problema 2 — Maquetación rota de las cards
En el screenshot las tarjetas muestran:
- El anillo de salud (con número grande "7") + el label "SALUD /10" apilados verticalmente, ocupando toda la altura derecha.
- El chip "En riesgo de enfriarse" partido en 4 líneas verticales.
- El nombre del contacto queda comprimido y la badge de categoría se solapa.

Causa: el header de la card es `flex items-start gap-4` con tres bloques (avatar, info, salud) compitiendo por espacio en grid de 3 columnas a 1164px. El bloque de salud no tiene ancho fijo y los chips son demasiado largos.

**Solución de maquetación**:
- Mover el anillo de salud arriba a la derecha como elemento compacto (sin label "SALUD /10" debajo, el tooltip ya lo explica).
- Recencia como chip más corto: en lugar de "En riesgo de enfriarse" usar `"⚠ 45d"` con el detalle largo en tooltip. Tabla:
  - `≤7d` → `✓ 7d` (verde)
  - `8-30d` → `12d` (neutro)
  - `31-90d` → `⚠ 45d` (warning)
  - `>90d` → `💤 120d` (destructive)
  - `null` → `—` (muted)
- Dar `min-w-0` y `truncate` correctos al bloque info.
- Salud: ancho fijo `w-14`, sin label inferior.
- "Seguimiento recomendado" + "Redactar mensaje" se mantienen pero más compactos.

### Cambios concretos

1. **`src/pages/RedEstrategica.tsx`**
   - `load()` añade `.eq("in_strategic_network", true)` al query principal.
   - Nuevo estado `addOpen` + componente modal `<AddToNetworkDialog>` (Dialog de shadcn) con `Input` de búsqueda y resultados live de `people_contacts` (excluyendo los que ya están en la red).
   - Botón "+ Añadir" en la cabecera junto a "Actualizar novedades".
   - Función `removeFromNetwork(contactId)` con confirmación toast.
   - KPIs siguen funcionando sobre `rows` (que ahora es la red curada) — el copy se ajusta a "en tu red estratégica".
   - Empty state cuando `rows.length === 0` con CTA "Añadir primer contacto".

2. **`src/components/contact/ContactCard.tsx`**
   - Sustituir el chip "En riesgo de enfriarse" por chip corto `Xd` con icono y color.
   - Quitar el label "SALUD /10" (la información está en el tooltip).
   - Añadir prop opcional `onRemove?: () => void` que renderiza un botón `X` discreto en la esquina superior derecha.
   - Reescribir layout: avatar (56px) | info flex-1 min-w-0 | salud (40px) — sin que la salud crezca.

3. **Nuevo `src/components/contact/AddToNetworkDialog.tsx`**
   - Dialog de shadcn con buscador, lista de máx. 50 resultados, click → `update people_contacts set in_strategic_network=true`.
   - Cierra y refresca la lista.

### Sin cambios de schema
`in_strategic_network` ya existe. RLS sobre `people_contacts` ya filtra por `user_id`. Cero migraciones.

### Prueba
Tras implementar: añadir 2-3 contactos a la red, comprobar que aparecen, pulsar "Actualizar novedades" y verificar que las cards muestran el chip de recencia compacto sin romperse y el anillo de salud cabe en su columna.

