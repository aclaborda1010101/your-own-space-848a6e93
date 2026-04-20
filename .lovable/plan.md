
## Qué está pasando

He encontrado la causa principal de lo de Adolfo:

- El contacto que estás viendo ahora mismo es `Adolfo Alvaro Benito` (`0fcf...`) y su `last_contact` está en `2026-03-10`.
- Pero los WhatsApp más nuevos no están entrando ahí: están entrando en **otro contacto duplicado** llamado `AAB` (`069c...`) con el **mismo `wa_id` `34627460836`** y mensajes hasta `2026-03-27`.
- Por eso la app no “miente”: está leyendo bien el registro equivocado. El problema real es de **duplicados / enlace roto de mensajes**.
- Además, esto no es solo Adolfo: he visto **158 `wa_id` duplicados** en `people_contacts`, así que hay más casos iguales.
- La “raya blanca” muy probablemente viene de la combinación de:
  - líneas de 1px del layout (`TopBar` / `BottomNavBar`),
  - `backdrop-blur`,
  - y cabeceras sticky dentro del detalle del contacto.

## Plan de arreglo

### 1) Reparar Adolfo y los duplicados ya rotos en base de datos
Haré una migración de saneamiento que:

- detecte grupos de contactos con el mismo `wa_id`,
- elija un **contacto canónico** por grupo,
- mueva al canónico todos los registros relacionados de tablas con `contact_id`,
- recalcule:
  - `last_contact = max(contact_messages.message_date)`
  - `wa_message_count = count(contact_messages)`
- elimine los duplicados “fantasma”.

Para Adolfo, conservaré el contacto humano correcto (`Adolfo Alvaro Benito`) y moveré ahí los mensajes que ahora están en `AAB`, para que tu ruta actual siga funcionando.

### 2) Blindar el webhook para que no vuelva a pasar
Ahora mismo `evolution-webhook` resuelve contactos con `.maybeSingle()` sobre `wa_id` / `last9` / `phone_numbers`. Con duplicados, eso puede fallar o elegir mal y acabar creando o usando otro contacto.

Lo cambiaré para que:

- nunca asuma unicidad si hay varias filas,
- cargue varios candidatos,
- elija uno de forma determinista con prioridad:
  1. favorito / red estratégica,
  2. nombre humano válido frente a alias basura (`AAB`, número, etc.),
  3. más historial real,
  4. contacto más antiguo o más completo.
- si detecta duplicados claros del mismo número, los consolide o al menos escriba siempre en el canónico.

### 3) Añadir una reparación masiva reutilizable
Como hay bastantes contactos afectados, dejaré una vía segura para re-ejecutar la limpieza:

- migración de saneamiento inicial,
- y una edge function/admin repair para recalcular contactos dañados sin depender de importaciones manuales.

Así no nos quedamos parcheando contacto por contacto.

### 4) Corregir la UI del “último contacto” y del timeline
Después del merge, ajustaré la carga del detalle para que quede consistente:

- el KPI “Último contacto” debe reflejar el `last_contact` recalculado,
- la pestaña/resumen debe mostrar ya los mensajes recientes al estar todos bajo el mismo `contact_id`,
- revisaré si hace falta refrescar `contact_headlines` / timeline cache para que no siga enseñando contexto viejo.

### 5) Quitar la raya blanca / flicker visual
Haré una pasada visual en estas piezas:

- `TopBar` → línea holográfica de 1px inferior,
- `BottomNavBar` → línea superior + `bg-scanlines` + blur,
- `ConversationTimeline` → header sticky con blur,
- `ContactDetail` → capas blur ambientales.

La corrección será conservadora: quitar o aislar las líneas decorativas problemáticas, reducir blur donde provoque artefactos, y asegurar `overflow/z-index` para que no aparezcan parpadeos.

## Detalle técnico

Tablas con `contact_id` que tendré en cuenta en el merge:
- `contact_messages`
- `contact_headlines`
- `contact_headline_dismissals`
- `contact_podcasts`
- `contact_refresh_state`
- `emails`
- `interactions`
- `suggested_responses`
- `suggestions`
- `suggestion_feedback`
- `tasks`
- `contact_aliases`

Regla de recálculo final:
```text
last_contact = MAX(contact_messages.message_date)
wa_message_count = COUNT(contact_messages WHERE source IN whatsapp/whatsapp_backup según histórico)
```

## Resultado esperado

- Adolfo dejará de salir como “hace un mes” y pasará a mostrar la fecha real reciente.
- Los WhatsApp recientes dejarán de quedar partidos entre `Adolfo Alvaro Benito` y `AAB`.
- Los demás contactos duplicados por teléfono quedarán saneados.
- La raya blanca desaparecerá o quedará localizada y neutralizada en el layout.
