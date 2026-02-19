

# Simplificar pestana Email: quitar tabla de emails, mantener ultima sincronizacion

## Resumen

La pestana Email ya muestra la ultima sincronizacion por cuenta (lineas 1974-1978). Solo hay que eliminar la tabla de emails recientes y el estado/funcion asociados, y anadir un texto explicativo sobre el proposito de la sincronizacion.

## Cambios en `src/pages/DataImport.tsx`

### 1. Eliminar estado y funcion `emailList` / `fetchRecentEmails`
- Quitar `const [emailList, setEmailList] = useState<any[]>([])` (linea 1013)
- Quitar la funcion `fetchRecentEmails` (lineas 1016-1025)
- Quitar la llamada a `fetchRecentEmails()` en el useEffect (linea 1037)
- Quitar `await fetchRecentEmails()` del handleEmailSync (linea 1051)

### 2. Eliminar bloque de tabla de emails recientes
- Quitar todo el bloque JSX de "Ultimos X emails" con la tabla (lineas 1997-2028)

### 3. Anadir texto explicativo
- Debajo del boton de sincronizar, anadir un parrafo que explique: "Los emails sincronizados se usan internamente para generar alertas sobre correos importantes, sugerencias de respuesta y vincular contactos automaticamente."

### Lo que se mantiene (ya funciona)
- Las cuentas configuradas con su proveedor y badge activo/inactivo
- La fecha de **ultima sincronizacion** por cuenta (ya esta en linea 1976)
- El boton "Sincronizar Emails" con loading y toasts

## Archivo a modificar

Solo `src/pages/DataImport.tsx`

