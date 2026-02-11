

# Fix del layout del Chat con voz

## Problema

La pagina de Chat tiene dos problemas de layout visibles en las capturas:

1. El selector de agente en el header se corta parcialmente (solo se ve la "S" del texto) porque el contenedor no gestiona bien el overflow con el sidebar.
2. El TopBar muestra la fecha y el saludo que ocupan espacio innecesario en la pagina de Chat - seria mejor un header mas compacto.
3. El contenedor principal no tiene `min-w-0` lo que causa que el flex no comprima correctamente el contenido.

## Cambios

### `src/pages/Chat.tsx`

1. Anadir `min-w-0` al contenedor principal `flex-1` para que el flexbox comprima correctamente el contenido cuando el sidebar esta visible.
2. Reducir el ancho del `SelectTrigger` de `w-[180px]` a `w-[160px]` y anadir `min-w-0` para que no se desborde.
3. Asegurar que el header del agente tenga `overflow-hidden` y `min-w-0` en los contenedores flex internos para que el texto se trunque en lugar de desbordar.
4. Mover el `BottomNavBar` dentro del contenedor principal (igual que en Dashboard) para evitar problemas de posicionamiento.

## Detalles tecnicos

```text
Antes:
<div class="flex flex-col flex-1 overflow-hidden">

Despues:
<div class="flex flex-col flex-1 overflow-hidden min-w-0">
```

Y en el header del selector de agente:
```text
Antes:
<div class="px-4 py-3 border-b flex items-center justify-between gap-3">
  <div class="flex items-center gap-3">
    <SelectTrigger class="w-[180px]">

Despues:
<div class="px-4 py-3 border-b flex items-center justify-between gap-3 min-w-0">
  <div class="flex items-center gap-3 min-w-0 overflow-hidden">
    <SelectTrigger class="w-[160px] shrink-0">
```

Esto garantiza que el contenido se adapte correctamente al espacio disponible sin importar si el sidebar esta expandido, colapsado o cerrado.

