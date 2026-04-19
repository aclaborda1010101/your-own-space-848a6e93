

## Lo que vamos a hacer

### 1. El "5" del avatar — explicación + arreglo

Ese número es un componente `<HealthMeter>` puesto **encima** del cuadrado AM (esquina inferior izquierda). Sale del campo `contact.scores.health` y, cuando el contacto **no tiene score calculado todavía**, cae en el fallback `?? 5` (línea 193 de `ContactDetail.tsx`). Por eso ves un "5" sin base lógica: literalmente es el default que se mete cuando no hay datos.

Tienes razón en dos cosas:
- **Pegado encima como parche**: visualmente parece un sticker.
- **Sin base**: si el sistema no ha calculado salud todavía, no debería mostrar nada — y mucho menos un "5" que parece real.

**Propuesta (elijo la opción que mejor cuadra con tu queja, no te pregunto porque ya lo dejaste claro):**

- **Quitar el badge de HealthMeter sobreimpreso** del avatar (las líneas 226-228).
- En el centro del cuadrado AM se mantienen las **iniciales** ("AM"), que es lo que tú llamas "ese cuadro de la ecuación".
- La salud relación ya se ve **2 veces más abajo** sin necesidad del badge: en la tarjeta "JARVIS Sugiere" (`Amistad íntima — salud relacional 9/10 (Fuerte)`) y en el KPI Strip ("Salud relación · 9 · score /10"). Así que no perdemos información, sólo dejamos de duplicarla con un parche.
- Bonus: en el KPI Strip cambio el comportamiento para que **si el score es el fallback (no calculado real)** muestre `—` en vez de inventarse un 5.

### 2. Botón flotante de actualizar — fuera

El círculo con la flecha curva ↻ que ves abajo a la derecha del expediente es el `<ForceRefreshButton>`, montado globalmente en `AppLayout.tsx`. Es un botón de utilidad para limpiar caché del preview/PWA — útil en desarrollo, pero **se ve en toda la app y choca**.

- **Lo quito del AppLayout** completamente. Si en algún momento quieres recuperarlo para debugging, lo dejaremos sólo accesible desde Ajustes.

### Archivos a tocar (3, edición mínima)

1. `src/pages/ContactDetail.tsx` — eliminar el bloque del HealthMeter sobreimpreso en el avatar (líneas 226-228) y limpiar el wrapper relativo si queda vacío.
2. `src/components/contact/ContactKpiStrip.tsx` (o el call-site en `ContactDetail.tsx`) — si `contact.scores?.health` no existe de verdad, mostrar `—` en vez de `5`.
3. `src/components/layout/AppLayout.tsx` — quitar el render `<ForceRefreshButton />` (línea 67) y su import.

### Lo que verás después

- Avatar de Alicia limpio: sólo el cuadrado verde con "AM" centrado, sin burbuja con número pegada.
- La salud sigue visible en JARVIS Sugiere ("9/10 Fuerte") y en el KPI Strip — donde sí tiene contexto.
- Sin botón flotante de refresh en ninguna pantalla.

Sin migraciones, sin edge functions, sólo frontend.

