

# Fix: Error "Invalid time value" en importacion de backup

## Problema

Al importar un backup WhatsApp (XLSX), la funcion `storeContactMessages` en `DataImport.tsx` (linea 541) hace:

```
new Date(m.messageDate).toISOString()
```

Cuando `messageDate` viene en formato `"2026-01-21 06:07:27"` (sin la `T` separadora ISO), `new Date()` puede no parsearlo correctamente en algunos navegadores, produciendo un `Date` invalido y lanzando `RangeError: Invalid time value` al llamar `.toISOString()`.

## Solucion

Envolver la conversion de fecha en un try-catch y normalizar el formato antes de parsear:

### Cambio en `src/pages/DataImport.tsx` (linea 541)

Reemplazar:
```typescript
message_date: m.messageDate ? new Date(m.messageDate).toISOString() : null,
```

Por una version segura que:
1. Reemplace el espacio entre fecha y hora por `T` para cumplir ISO 8601
2. Use try-catch para que una fecha invalida no rompa toda la importacion
3. Si la fecha no se puede parsear, guarde `null` en vez de fallar

```typescript
message_date: (() => {
  if (!m.messageDate) return null;
  try {
    const normalized = m.messageDate.replace(' ', 'T');
    const d = new Date(normalized);
    return isNaN(d.getTime()) ? null : d.toISOString();
  } catch { return null; }
})(),
```

### Archivo modificado

1. `src/pages/DataImport.tsx` - linea 541, proteger conversion de fecha

