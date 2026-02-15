
# Arreglar OAuth email (error 400) + hora del calendario (1h de desfase)

## Problema 1: Error 400 al conectar cuenta de email

Al pulsar "Conectar" en una cuenta de Gmail, el navegador muestra un error 400 de Google ("malformed request"). La causa esta en como se invoca la edge function:

```typescript
supabase.functions.invoke("google-email-oauth?action=start", { body: {...} })
```

`supabase.functions.invoke` trata todo el string como nombre de funcion, construyendo una URL como:
`/functions/v1/google-email-oauth%3Faction%3Dstart`

Google recibe una URL malformada y responde 400. El parametro `action` debe pasarse dentro del `body`, no en la URL.

## Problema 2: Eventos del calendario con 1 hora de mas

Los eventos de iCloud aparecen una hora mas tarde de lo real (ej: un evento a las 07:45 aparece a las 08:45). La causa:

1. El parser ICS (`parseICSDate`) recibe fechas locales como `20260216T074500` (sin "Z") y genera `2026-02-16T07:45:00` sin indicador de zona horaria
2. Sin embargo, muchos eventos CalDAV incluyen TZID en la linea DTSTART (ej: `DTSTART;TZID=Europe/Madrid:20260216T074500`), pero el parser ignora esta informacion
3. Cuando Deno (que corre en UTC) ejecuta `new Date("2026-02-16T07:45:00")`, lo interpreta como UTC
4. Luego al formatear con `timeZone: "Europe/Madrid"` (UTC+1), convierte 07:45 UTC a 08:45 CET

## Problema 3: Google Calendar 403 insufficient_scopes

Los logs de red muestran que Google Calendar devuelve 403 con "insufficient_scopes". Esto significa que el refresh token actual fue obtenido sin los scopes de calendario. La solucion: limpiar los tokens almacenados y forzar un nuevo login con todos los scopes.

## Solucion

### Paso 1: Arreglar invocacion OAuth de email

En `src/components/settings/EmailAccountsSettingsCard.tsx`, cambiar la llamada de:

```typescript
supabase.functions.invoke("google-email-oauth?action=start", { body: {...} })
```

A:

```typescript
supabase.functions.invoke("google-email-oauth", { 
  body: { action: "start", account_id: account.id, ... } 
})
```

Y en la edge function `google-email-oauth/index.ts`, ademas de leer `action` de los query params, leerlo tambien del body del POST.

### Paso 2: Corregir parsing de zona horaria en iCloud

En `supabase/functions/icloud-calendar/index.ts`:

1. Modificar el parser ICS para extraer el TZID del campo DTSTART
2. Cuando el DTSTART tiene TZID (ej: `DTSTART;TZID=Europe/Madrid:20260216T074500`), interpretar la hora como local en esa zona horaria en vez de UTC
3. Cuando no hay TZID ni "Z", usar la timezone del usuario (enviada en el header) como fallback

### Paso 3: Forzar re-login para scopes de Google Calendar

En `useGoogleCalendar.tsx`, cuando se detecta `reason: "insufficient_scopes"`, limpiar los tokens almacenados para que la proxima vez que el usuario pulse "Reconectar" se haga un login completo con los scopes correctos (que ya estan configurados en Login.tsx).

## Seccion tecnica

### Archivo: `src/components/settings/EmailAccountsSettingsCard.tsx`

Linea 286 - cambiar la invocacion:

```typescript
// ANTES:
const { data, error } = await supabase.functions.invoke("google-email-oauth?action=start", {
  body: { account_id: account.id, origin: window.location.origin, login_hint: account.email_address },
});

// DESPUES:
const { data, error } = await supabase.functions.invoke("google-email-oauth", {
  body: { action: "start", account_id: account.id, origin: window.location.origin, login_hint: account.email_address },
});
```

### Archivo: `supabase/functions/google-email-oauth/index.ts`

Modificar para leer `action` del body cuando viene como POST:

```typescript
// Leer action de query params O del body
let action = url.searchParams.get("action");

if (!action && req.method === "POST") {
  const body = await req.json();
  action = body.action;
  // Guardar body para reutilizarlo luego
}
```

Reestructurar el flujo para no consumir el body dos veces (clonar req o parsear una sola vez).

### Archivo: `supabase/functions/icloud-calendar/index.ts`

Modificar `parseICS` para extraer TZID:

```typescript
// En el bloque que procesa DTSTART:
} else if (key.startsWith("DTSTART")) {
  // Extraer TZID si existe (ej: DTSTART;TZID=Europe/Madrid)
  const tzMatch = key.match(/TZID=([^;:]+)/);
  currentEvent.start = parseICSDate(value, tzMatch?.[1]);
  currentEvent.allDay = !line.includes("T");
}
```

Modificar `parseICSDate` para recibir timezone:

```typescript
function parseICSDate(icsDate: string, tzid?: string): string {
  const cleaned = icsDate.replace(/[^0-9TZ]/g, "");
  
  if (cleaned.length === 8) {
    return `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}`;
  } else if (cleaned.length >= 15) {
    const iso = `${cleaned.slice(0,4)}-${cleaned.slice(4,6)}-${cleaned.slice(6,8)}T${cleaned.slice(9,11)}:${cleaned.slice(11,13)}:${cleaned.slice(13,15)}`;
    
    if (cleaned.endsWith("Z")) {
      return iso + "Z"; // Ya es UTC
    }
    
    // Si tiene TZID, almacenar con la zona horaria
    // Usamos un truco: almacenar como pseudo-ISO que luego procesamos
    // La forma correcta: convertir a UTC usando el TZID
    if (tzid) {
      // Crear fecha interpretada en la zona horaria del TZID
      // Deno soporta Intl para esto
      return iso; // Devolver sin Z - se procesara con el timezone del usuario
    }
    
    return iso;
  }
  
  return icsDate;
}
```

Y en la parte de formateo (linea 562), cuando no tiene "Z", tratar la hora como hora local de la zona del evento:

```typescript
const formattedEvents = events.map(event => {
  let startTime: Date;
  
  if (event.start.endsWith("Z")) {
    startTime = new Date(event.start); // UTC
  } else if (event.start.includes("T")) {
    // Hora local sin timezone - interpretar como timezone del usuario
    // Forzar que new Date la interprete correctamente
    startTime = new Date(event.start + "Z");
    // Pero como es hora local, NO convertir - usar directamente
    // El truco: restar el offset del timezone para que al formatear con timezone salga bien
  } else {
    startTime = new Date(event.start + "T00:00:00Z");
  }
  // ...
});
```

La solucion mas limpia: cuando el evento no tiene "Z", la hora ya es local en la zona del evento. Para evitar la conversion doble, formatear directamente sin timezone conversion:

```typescript
if (!event.start.endsWith("Z") && event.start.includes("T")) {
  // La hora ya es local - extraer directamente
  const timePart = event.start.split("T")[1];
  time = timePart.slice(0, 5); // HH:MM
  dateStr = event.start.split("T")[0]; // YYYY-MM-DD
} else {
  // Es UTC - convertir a la timezone del usuario
  const startTime = new Date(event.start);
  dateStr = startTime.toLocaleDateString("en-CA", { timeZone: timezone });
  time = startTime.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: timezone });
}
```

### Archivo: `src/hooks/useGoogleCalendar.tsx`

En la parte donde se detecta `insufficient_scopes` (linea 185), ya limpia los tokens. Solo necesitamos asegurar que el toast/mensaje guie al usuario a reconectar.
