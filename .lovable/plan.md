
# Fix: fetchAllMessages solo devuelve 1000 mensajes (bug de paginacion)

## Causa raiz

En `supabase/functions/contact-analysis/index.ts`, linea 268:

```
const PAGE_SIZE = 3000;
```

Supabase tiene un limite por defecto de **1000 filas por query**. Cuando `fetchAllMessages` pide 3000 filas, Supabase devuelve solo 1000. Como `1000 < 3000`, el codigo interpreta que no hay mas paginas (`hasMore = false`) y para. Resultado: solo se procesan 1000 de 17,484 mensajes.

## Solucion

### 1. Corregir PAGE_SIZE en `fetchAllMessages` (linea 268)

Cambiar:
```typescript
const PAGE_SIZE = 3000;
```
Por:
```typescript
const PAGE_SIZE = 1000;
```

Asi cada pagina devuelve exactamente 1000 filas, Supabase las devuelve completas, y el bucle `while(hasMore)` continua pidiendo la siguiente pagina hasta que se agoten (18 paginas para 17,484 msgs).

### 2. Limpiar historical_analysis del contacto afectado

Ejecutar UPDATE para poner `historical_analysis = null` en el contacto `32f8bd4f-37ac-4000-b4b2-5efafb004927`, forzando reproceso completo con los 17,484 mensajes.

### 3. Redesplegar la edge function

## Impacto esperado

- `fetchAllMessages` devolvera los 17,484 mensajes reales
- Se generaran ~22 bloques trimestrales (800 msgs max/bloque)
- El resumen progresivo cubrira 2022-2026 completo
- La consolidacion final producira `evolucion_anual` con todos los anos

## Archivos a modificar

- `supabase/functions/contact-analysis/index.ts` — linea 268: `PAGE_SIZE = 3000` a `PAGE_SIZE = 1000`

## Nota

Es un cambio de una sola linea. El resto de la logica (bloques trimestrales, resumen progresivo, consolidacion) ya esta correctamente implementada — simplemente nunca recibia los datos completos.
