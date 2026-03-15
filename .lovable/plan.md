

# Fix: Webhook no responde desde el navegador

## Problema
El GET de verificación del webhook (línea 243) devuelve la respuesta **sin headers CORS**. El navegador bloquea la respuesta por política de mismo origen. Meta sí puede verificarlo (no usa CORS), pero tu botón "Verificar conexión" desde la app web falla.

## Solución

### Opción A (recomendada): Añadir CORS headers al GET del webhook
En `supabase/functions/whatsapp-webhook/index.ts`, línea 243, cambiar:
```typescript
return new Response(challenge, { status: 200 });
```
por:
```typescript
return new Response(challenge, { status: 200, headers: corsHeaders });
```

Y lo mismo en la línea 245 (Forbidden):
```typescript
return new Response("Forbidden", { status: 403, headers: corsHeaders });
```

### Archivo tocado
| Archivo | Cambio |
|---------|--------|
| `supabase/functions/whatsapp-webhook/index.ts` | Añadir `corsHeaders` a las respuestas GET (2 líneas) |

Después hay que redesplegar la edge function.

