

# Fix: Desactivar la higienización agresiva de terminología técnica

## Problema

El archivo `supabase/functions/generate-document/index.ts` contiene un `CLIENT_DICTIONARY` (líneas 973-990) y una función `translateForClient` (línea 992) que reemplaza términos técnicos válidos por paráfrasis genéricas:

- `Supabase` → `Plataforma de datos`
- `RAG` → `Base de conocimiento especializada`
- `LLM` → `Motor de inteligencia artificial`
- `scraping` → `Monitorización automática de fuentes`
- `webhook` → `Notificación automática`
- `edge function(s)` → `Procesamiento en la nube`
- `embeddings` → `Análisis semántico`
- etc.

Esta función se invoca en **dos sitios**:
1. Dentro de `sanitizeTextForClient()` (línea 1050) — aplicada a todos los campos de texto en propuestas (step 100) y resúmenes (step 101)
2. Directamente en el pipeline principal (línea 1621) para contenido en modo cliente
3. En el renderizado markdown genérico (línea 2149)

Además, `sanitizeTextForClient` también elimina menciones de Lovable y generaliza nombres de modelos AI (Claude → "Motor de IA", etc.), lo cual también es excesivo para documentos técnicos.

## Solución

### 1. Vaciar el `CLIENT_DICTIONARY` (líneas 973-990)
Eliminar todas las entradas del diccionario. Dejarlo vacío (`{}`) para que `translateForClient` no haga nada.

### 2. Eliminar las regex de "Lovable stripping" (líneas 1028-1032)
Son las que borran menciones de Lovable del documento. Para documentos técnicos internos, estas menciones son válidas.

### 3. Eliminar las regex de generalización de modelos AI (líneas 1034-1043)
Las que convierten "Claude", "Gemini", "OpenAI" en "Motor de IA". En documentos técnicos, el nombre del modelo es información relevante.

### 4. Conservar la limpieza legítima
Lo que SÍ se mantiene en `sanitizeTextForClient`:
- Strip de `[[INTERNAL_ONLY]]` bloques (líneas 1010-1013) ✓
- Strip de changelog (línea 1016) ✓
- Strip de `[[NO_APLICA:*]]` (línea 1019) ✓
- Procesamiento de `[[PENDING:*]]` tags (líneas 1022-1023) ✓
- Strip de `[HIPÓTESIS]` (línea 1026) ✓
- Dedup y bad phrases (líneas 1046-1047) ✓

## Archivo tocado

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/generate-document/index.ts` | Vaciar `CLIENT_DICTIONARY`, eliminar regex de Lovable stripping y AI model generalization de `sanitizeTextForClient` |

Requiere redespliegue de la edge function `generate-document`.

