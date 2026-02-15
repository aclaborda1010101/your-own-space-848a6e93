
# Persistencia de noticias y videos en castellano

## Problema 1: Las noticias desaparecen al cambiar de dia

Las noticias SI se guardan en base de datos (tabla `ai_news`), pero la pestana "Hoy" filtra por `isToday(parseISO(item.date))`. Si las noticias se generaron ayer y el usuario abre la app hoy, la pestana "Hoy" aparece vacia aunque las noticias sigan en la base de datos.

**Solucion**: Cambiar la logica de la pestana "Hoy" para que muestre las noticias de la ULTIMA actualizacion (el lote mas reciente), no solo las de hoy. Si no hay noticias de hoy pero hay de ayer u otro dia, mostrarlas igualmente con una etiqueta indicando cuando se generaron.

### Cambio en `src/pages/AINews.tsx`

Reemplazar los filtros `isToday`/`isYesterday` por logica basada en el lote mas reciente:

```typescript
// En vez de filtrar por isToday, obtener la fecha mas reciente
const latestDate = useMemo(() => {
  if (news.length === 0) return null;
  const nonVideoNews = news.filter(i => !i.is_video);
  if (nonVideoNews.length === 0) return null;
  return nonVideoNews.reduce((max, item) => 
    item.date > max ? item.date : max, nonVideoNews[0].date
  );
}, [news]);

const latestNews = useMemo(() => 
  news.filter(item => !item.is_video && item.date === latestDate),
  [news, latestDate]
);

const olderNews = useMemo(() => 
  news.filter(item => !item.is_video && item.date !== latestDate),
  [news, latestDate]
);
```

Mostrar en la pestana "Hoy" un indicador si las noticias no son de hoy: "Ultima actualizacion: ayer a las 14:30" para que el usuario sepa que debe actualizar.

## Problema 2: Videos deben ser en castellano

Los videos YA estan configurados solo con creadores hispanohablantes (Dot CSV, Jon Hernandez, Miguel Baena, Xavier Mitjana, etc.) en el edge function `ai-news`. Sin embargo, el filtro RSS actual (`RSS_FEEDS`) solo incluye creadores espanoles para videos, lo cual es correcto.

No se requiere cambio en el backend. Los videos que aparecen ya son de canales en espanol.

## Nota sobre Google Calendar

El usuario menciona que ya se habilito el scope de Google Calendar en `google-email-oauth`. Esto no requiere cambio de codigo adicional - solo reconectar la cuenta de Google desde la app para que pida el nuevo permiso.

## Seccion tecnica

### Archivo: `src/pages/AINews.tsx`

Cambios concretos:

1. **Lineas 157-161**: Reemplazar filtros `todayNews`/`yesterdayNews` por `latestNews`/`olderNews` basados en la fecha mas reciente del lote

2. **Lineas 302-322**: Actualizar la pestana "Hoy" para usar `latestNews` y `olderNews` en vez de `todayNews`/`yesterdayNews`. Anadir indicador de fecha de ultima actualizacion cuando no es hoy.

3. Mantener los filtros de videos sin cambios (ya estan bien separados en la pestana "Videos").

### Archivos modificados

- `src/pages/AINews.tsx` - Cambiar logica de filtrado temporal de noticias
