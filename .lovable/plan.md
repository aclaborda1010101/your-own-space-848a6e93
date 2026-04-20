

El usuario quiere un botón "Actualizar" en la fila de acciones del header del expediente del contacto (junto a Llamar / WhatsApp / Recordatorio), que dispare la actualización del perfil con los últimos WhatsApp/emails. Ya existe `refreshProfile()` en `ContactDetail.tsx` pero como botón aparte arriba — hay que **moverlo / replicarlo en la barra de acciones rápidas** para que sea consistente con los otros tres.

Voy a leer la zona exacta del header para confirmar dónde están los botones Llamar / WhatsApp / Recordatorio antes de proponer.

Confirmado por el contexto: en `ContactDetail.tsx` el header ya renderiza botones de "call/WhatsApp/reminder/refresh" pero el de refresh está separado visualmente. La queja es que **no aparece al mismo nivel ni con el mismo estilo** que los otros tres.

## Plan

### Cambio único: barra de acciones unificada en el header del contacto

En `src/pages/ContactDetail.tsx`, en la fila de botones del header (donde están **Llamar**, **WhatsApp**, **Recordatorio**), añadir como **cuarto botón** "Actualizar" con el mismo estilo (icono `RefreshCw` + label corto), que:

1. Llama a la función `refreshProfile()` que ya existe (invoca `contact-analysis` para ese contacto).
2. Muestra spinner mientras corre (`isRefreshing` ya existe).
3. Toast "Actualizando con últimos WhatsApp y emails…" → al terminar, recarga la ficha con `load()` para que se vean los nuevos hitos / mensajes / sentimiento.
4. Eliminar el botón duplicado de "Actualizar perfil" que está suelto arriba a la derecha (el que añadimos en la iteración anterior), para que **sólo exista uno** y esté integrado en la barra.

### Detalle de implementación

- Añadir `RefreshCw` al import de `lucide-react` si no está.
- Insertar el `<Button>` en el mismo contenedor flex que los otros tres, mismo `size`, mismo `variant`.
- El handler ya es `refreshProfile` (no se duplica lógica). Esa función ya invoca `contact-analysis` con el `contact_id`, que internamente reanaliza con los últimos `contact_messages` (WhatsApp) y emails cacheados.
- Quitar el botón flotante / suelto que estaba antes en el header.

### Archivos a tocar

Sólo **uno**:
- `src/pages/ContactDetail.tsx` — añadir el botón "Actualizar" en la fila de acciones, eliminar el botón duplicado, asegurar `disabled={isRefreshing}` y spinner.

Sin migraciones, sin edge functions nuevas (la lógica `contact-analysis` ya está creada y devuelve perfil refrescado con últimos WhatsApp + emails).

### Lo que verás después

En el expediente de cualquier contacto, en la cabecera verás cuatro botones uniformes en línea:

```text
[ 📞 Llamar ]  [ 💬 WhatsApp ]  [ ⏰ Recordatorio ]  [ 🔄 Actualizar ]
```

Al pulsar "Actualizar": spinner en el icono, toast informativo, y al terminar la ficha recarga con los últimos mensajes/correos integrados en perfil, hitos y timeline.

