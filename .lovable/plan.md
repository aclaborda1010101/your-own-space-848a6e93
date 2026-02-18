

# Fix: Detección de CSV backup WhatsApp

## Problema

El parser `tryParseBackupCSV` tiene dos bugs que provocan que no detecte correctamente el formato:

1. **Header no se salta**: La primera fila del CSV es `Sesion de chat, Fecha del mensaje, ..., Tipo, ...`. Al no saltarla, se procesa como datos y puede generar contactos basura.

2. **Tilde en "Notificacion"**: El CSV real usa `Notificación` (con tilde), pero el codigo compara con `Notificacion` (sin tilde). Resultado: las notificaciones del sistema no se filtran y su texto aparece como nombre de contacto detectado (ej: "con poder notarial otorgado el...").

## Solucion

Modificar `tryParseBackupCSV` en `src/lib/whatsapp-file-extract.ts` (2 cambios simples):

### Cambio 1: Normalizar acentos en comparaciones de direccion

Crear una funcion auxiliar que elimine tildes antes de comparar:

```
function stripAccents(s: string): string {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}
```

Usar `stripAccents(direction)` en las tres comparaciones (lineas 105 y 122).

### Cambio 2: Detectar y saltar la fila de headers

En la fase de deteccion (linea 96) y en la fase de parsing (linea 116), saltar la primera fila si parece un header. Se detecta como header si `cols[3]` no es un valor de direccion valido (ej: contiene "Tipo") o si `cols[1]` no matchea el formato de fecha `yyyy-MM-dd`.

## Archivo a modificar

- `src/lib/whatsapp-file-extract.ts` -- funcion `tryParseBackupCSV` (lineas 91-148)
