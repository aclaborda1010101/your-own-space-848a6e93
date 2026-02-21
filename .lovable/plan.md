
# Fix: Analisis historico no se reprocesa (datos antiguos cacheados)

## Diagnostico

El campo `historical_analysis` ya tiene datos guardados de un intento anterior (fallido):
- `mensajes_totales: 1000` (deberian ser 17,484)
- `duracion_relacion: "0 anos y 1 meses"` (deberian ser ~4 anos)
- `last_updated: 2026-02-21` (hoy)
- `last_message_date: 2022-09-07` (solo llego hasta septiembre 2022)

El codigo en linea 393-398 tiene un guard que dice: "si el analisis fue actualizado hace menos de 30 dias, no reprocesar". Como `last_updated` es de hoy, el sistema devuelve los datos viejos sin tocarlos.

## Solucion

### 1. Deteccion de analisis incompleto (lineas 393-408)

Agregar validacion: si `existingAnalysis.mensajes_totales` difiere del total real en mas de un 20%, forzar reprocesamiento completo ignorando el cache de 30 dias.

```
// Pseudocode
const totalReal = allMessages.length;
const totalPrevio = existingAnalysis.mensajes_totales;
const diffPct = Math.abs(totalReal - totalPrevio) / totalReal;

if (diffPct > 0.2) {
  // Forzar reproceso completo - el analisis anterior es incompleto
  existingAnalysis = null; // bypass cache
}
```

### 2. Limpiar datos viejos para Carls Primo

Ejecutar un UPDATE para poner `historical_analysis = null` en el contacto `32f8bd4f-37ac-4000-b4b2-5efafb004927`, forzando que el proximo analisis sea completo.

### 3. Agregar logging de bloques

Agregar console.log en el bucle de bloques para verificar en los logs que se procesan todos los bloques (actualmente linea 412 ya lo hace, pero agregar log por cada bloque completado).

## Archivos a modificar

- `supabase/functions/contact-analysis/index.ts` — lineas 389-408: agregar deteccion de analisis incompleto
- DB: limpiar historical_analysis del contacto afectado

## Impacto

Tras este cambio, al lanzar un nuevo analisis de Carls Primo:
- Se detectara que 1000 != 17484 (diff > 20%)
- Se forzara reproceso completo
- Los 17,484 mensajes se dividiran en ~22 bloques de 800
- El resumen progresivo cubrira 2022-2026
- La consolidacion final producira evolucion_anual con todos los anos
