

# Fix: Deteccion de formato CSV de backup WhatsApp

## Problema

El CSV que exporta tu herramienta de backup tiene 12 columnas sin headers:

```text
Col 0: Nombre del chat/grupo
Col 1: Fecha envio (yyyy-MM-dd HH:mm:ss)
Col 2: Fecha lectura
Col 3: Direccion (Entrante / Saliente / Notificacion)
Col 4: Telefono (+34...)
Col 5: Nombre del contacto (vacio en Saliente)
Col 6: Estado (Leido / Recibido)
Col 7: Contexto de respuesta
Col 8: Texto del mensaje
Col 9: Archivo media
Col 10: Tipo media
Col 11: Tamano media
```

El parser actual asume que las columnas son `fecha(0), remitente(1), mensaje(2)`, por lo que toma el nombre del grupo como "fecha", la fecha como "remitente" y la fecha de lectura como "mensaje". Resultado: detecta mal al interlocutor.

## Solucion

Modificar `parseCSVToWhatsAppText` en `src/lib/whatsapp-file-extract.ts` para auto-detectar este formato de backup.

### Deteccion automatica

Analizar las primeras filas del CSV buscando indicadores:
- Columna con valores "Entrante" / "Saliente" / "Notificacion" (columna de direccion)
- Columna con formato de fecha `yyyy-MM-dd HH:mm:ss`
- Columna con numeros de telefono (+34...)

Si se detecta este patron, usar el mapeo correcto de columnas.

### Mapeo para formato backup

- **Fecha**: columna 1
- **Remitente**: columna 5 (nombre del contacto). Si esta vacio y direccion es "Saliente", es un mensaje del usuario
- **Mensaje**: columna 8. Si esta vacio, usar el tipo de media (col 10) como placeholder (ej: "[Imagen]")
- **Filtrar**: Ignorar lineas con direccion "Notificacion" (mensajes del sistema)
- **Chat/grupo**: columna 0, util para agrupar por conversacion

### Salida

Convertir cada fila al formato WhatsApp estandar:
```
2024-03-18 23:01:31 - Javier Marin Hernandez: No se han dado cuenta que...
2024-03-18 23:03:33 - Javier Marin Hernandez: Y me cambian a la rubia por esta...
2024-03-18 23:04:52 - [Yo]: Mensaje saliente aqui
```

### Mensajes salientes

Para las filas con "Saliente", usar un marcador como "Yo" que luego sera reconocido por `parseWhatsAppSpeakers` al comparar con `my_identifiers`. Tambien se anadira "yo" como identificador por defecto en la logica de deteccion.

## Cambios tecnicos

### Archivo: `src/lib/whatsapp-file-extract.ts`

1. **Nueva funcion `detectBackupCSVFormat`**: Analiza las primeras 10 filas para determinar si es el formato de backup (busca "Entrante"/"Saliente" en alguna columna)
2. **Nueva funcion `parseBackupCSVToWhatsAppText`**: Convierte el formato de backup al formato WhatsApp estandar usando el mapeo correcto de columnas
3. **Actualizar `parseCSVToWhatsAppText`**: Llamar primero a `detectBackupCSVFormat`; si coincide, usar `parseBackupCSVToWhatsAppText`; si no, usar la logica actual como fallback

### Archivo: `src/pages/DataImport.tsx`

4. **Actualizar `parseWhatsAppSpeakers`**: Anadir "yo" a la lista de `myIdentifiers` por defecto para que los mensajes salientes marcados como "Yo" se cuenten correctamente

