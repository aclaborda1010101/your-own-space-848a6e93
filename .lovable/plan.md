

# Filtrar contactos: solo mostrar los que tengan vinculacion

## Problema actual
La Red de Contactos muestra todos los contactos importados (CSV, VCF, etc.), incluso los que no tienen ningun mensaje de WhatsApp ni grabacion Plaud asociada. Esto satura la lista con contactos "vacios".

## Solucion
Agregar un filtro base en `filteredContacts` que excluya contactos sin vinculacion. Un contacto se considera "vinculado" si cumple al menos una de estas condiciones:

- `wa_message_count > 0` (tiene mensajes de WhatsApp)
- Aparece en algun hilo Plaud (`contactIsInThread`)
- Tiene emails vinculados (preparado para futuro, actualmente no hay campo)

## Cambio tecnico

### Archivo: `src/pages/StrategicNetwork.tsx`

En la funcion `filteredContacts` (linea ~1500), agregar una condicion base antes de los filtros existentes:

```text
const filteredContacts = contacts.filter(c => {
  // Solo mostrar contactos con alguna vinculacion (WhatsApp, Plaud o email)
  const hasWhatsApp = (c.wa_message_count || 0) > 0;
  const hasPlaud = contactHasPlaud(c);
  if (!hasWhatsApp && !hasPlaud) return false;

  // ... resto de filtros existentes sin cambios
});
```

Esto reducira la lista a solo los contactos que tienen interacciones reales, manteniendo toda la funcionalidad de busqueda, filtros de categoria, favoritos y vistas (top100, active, etc.) intacta.
