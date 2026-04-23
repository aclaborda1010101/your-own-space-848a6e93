

## Por qué Hiba se ve "vieja" / "nada pendiente"

### Estado real de los datos (verificado en BD)

Hay **una sola** Hiba (`4902796c…`) y SÍ tiene todo generado:

- `wa_message_count`: **197** mensajes vinculados.
- `personality_profile`: **17 KB** (perfil completo).
- `historical_analysis`: 2.4 KB.
- `contact_headlines.payload` (lo que pinta la pantalla):
  - **Salud**: 8/10 "Fuerte" 🤝
  - **Pendiente**: "Reunión de informática y cañas" — 24 abr 2026 — `freshness_status: active`
  - **Tono**: Colaborativo. Topics: Clases IA 60% / Agenda 25% / Personal 15%.

Generado el **22 abr 2026 21:08** sobre 197 mensajes. Es decir: el backend ya hizo el trabajo.

### Por qué la UI no lo refleja

El frontend lee desde `useContactHeadlines → get-contact-headlines` y en local pinta lo que devolvió la primera vez. Una vez ejecutado correctamente el `link-contact-history` + `contact-analysis`, el cliente NO se entera porque:

1. `AddToNetworkDialog` invocó `link-contact-history`, pero no refresca la ficha del contacto al volver.
2. `ContactDetail` solo recarga headlines en el primer `mount`. Si abriste la ficha **antes** de que terminara el análisis, sigues viendo el `payload` viejo (vacío) en memoria + el render cacheado por React.
3. El service worker (`/sw.js`) cachea `/red-estrategica` y la ficha → tras un análisis backend, recarga normal sigue mostrando lo anterior hasta hard-refresh.

### Solución (sin tocar backend, todo está bien en BD)

**1. `src/pages/ContactDetail.tsx` — Auto-refresh tras montar la ficha**

En el efecto de carga inicial, además de `load()`, **forzar** `refreshHeadlines()` cuando:
- `wa_message_count > 0` y
- el `payload.pending.title` está vacío o `freshness_status === 'stale'`

Pasar `force: true` a `useContactHeadlines` la primera vez por contacto que cumpla esa condición. Garantiza que Hiba (y cualquier contacto recién vinculado) regenere headlines al abrir la ficha.

**2. `src/pages/ContactDetail.tsx` — Realtime sobre `people_contacts`**

Suscribirse a cambios de la fila del contacto (`postgres_changes` en `people_contacts` filtrando por `id`). Cuando cambie `wa_message_count` o `personality_profile`:
- Llamar `load()` (recarga `personality_profile`, scores, ai_tags).
- Llamar `refreshHeadlines(true)` para invalidar la cache de headlines.

Así, mientras `contact-analysis` esté corriendo en background, la ficha se actualiza sola sin que el usuario tenga que recargar.

**3. `src/components/contact/AddToNetworkDialog.tsx` — Polling tras link**

Tras `link-contact-history` exitoso con `linked_messages > 0`, navegar a la ficha del contacto resuelto (`target_contact_id` que devuelve la edge function) **con un flag** `?refresh=1`. La ficha lo detecta y dispara `refresh: true` en headlines + `load()`.

**4. Forzar refresh para Hiba ahora mismo (one-shot, sin código)**

En la ficha de Hiba pulsa **"Reanalizar perfil"** (botón ya existente, llama a `contact-analysis` con `include_historical:false`). Tras 30-60 s y con el cambio del paso 2 desplegado, verás:
- Pendiente: "Reunión de informática y cañas — 24 abr"
- Salud 8/10 Fuerte
- Topics: Clases IA / Agenda / Personal

### Diagnóstico técnico (resumen)

```text
BD       → Hiba ✅ (197 msgs, profile 17KB, headlines actualizados 22-abr)
Edge fn  → get-contact-headlines devuelve el payload bueno
Cliente  → muestra payload obsoleto en memoria, no re-fetch al cambiar
           wa_message_count en BD → "pantalla vieja"
```

### Archivos a editar

- `src/pages/ContactDetail.tsx` — auto-refresh inicial condicional + suscripción realtime a `people_contacts`.
- `src/components/contact/AddToNetworkDialog.tsx` — pasar `?refresh=1` al navegar tras link.
- `src/hooks/useContactHeadlines.ts` — aceptar trigger externo `forceOnMount` (opcional, parametrizable).

Sin cambios de backend ni migraciones. Todo el problema es de sincronización cliente↔BD.

