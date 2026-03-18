

# Fix: POTUS no encuentra contactos por nombre simple ni mantiene contexto WhatsApp

## Problema

Cuando el usuario dice "Mama" como respuesta a "¿con qué nombre la tienes guardada?", falla porque:
1. `detectsWhatsAppIntent("Mama")` devuelve `false` (no tiene triggers como "whatsapp", "mensaje", etc.)
2. `extractContactNames("Mama")` devuelve `[]` (solo captura nombres precedidos por "con/de/a")
3. No hay memoria de que el turno anterior era sobre WhatsApp

## Cambios en `supabase/functions/potus-core/index.ts`

### 1. Mejorar `extractContactNames` para mensajes cortos
Si no se encuentran nombres con los patrones regex y el mensaje tiene 1-3 palabras, tratar el mensaje completo como nombre de contacto candidato. Excluir stop words comunes.

### 2. Detectar intención WhatsApp desde historial de conversación
Nueva funcion `detectsWhatsAppIntentFromHistory` que revise los `messages` recientes (los últimos 3 del usuario). Si alguno contenía triggers de WhatsApp, heredar la intención al turno actual.

### 3. Pasar el historial de mensajes a `getWhatsAppContext`
Cambiar la firma de `getWhatsAppContext` para recibir también los `messages` del cliente. Usar `detectsWhatsAppIntentFromHistory` en lugar de solo `detectsWhatsAppIntent`.

### 4. Alias familiares
Añadir "mama", "mamá", "papa", "papá", "madre", "padre" como términos que siempre se buscan como nombre de contacto cuando el contexto previo es WhatsApp.

## Detalle de cambios

```typescript
// extractContactNames - añadir fallback para mensajes cortos
function extractContactNames(message: string): string[] {
  // ... patrones existentes ...
  
  // Fallback: mensajes cortos sin match -> usar como nombre directo
  if (names.length === 0) {
    const words = message.trim().split(/\s+/);
    if (words.length <= 3) {
      const candidate = message.trim();
      const STOP = ["que","los","las","una","por","para","si","no","ok","sí","ya","hola","gracias"];
      if (candidate.length >= 2 && !STOP.includes(candidate.toLowerCase())) {
        names.push(candidate);
      }
    }
  }
  return [...new Set(names)];
}

// Nueva: detectar intención desde historial
function detectsWhatsAppIntentFromHistory(
  current: string, 
  history: Array<{role: string; content: string}>
): boolean {
  if (detectsWhatsAppIntent(current)) return true;
  const recentUser = history.filter(m => m.role === 'user').slice(-3);
  return recentUser.some(m => detectsWhatsAppIntent(m.content));
}

// getWhatsAppContext: recibir history, usar nueva detección
async function getWhatsAppContext(supabase, userId, userMessage, history) {
  if (!detectsWhatsAppIntentFromHistory(userMessage, history || [])) return "";
  // ... resto igual ...
}
```

**Archivo**: `supabase/functions/potus-core/index.ts` (deploy)

