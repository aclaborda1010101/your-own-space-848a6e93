

## Plan: Lector Profundo — Worker Externo + PDF + Fan-Out

### Situación actual

- **Alarmas RAG**: 279 fuentes en estado `NEW`, 0 procesadas. URLs incluyen PDFs del BOE (`boe.es/boe/dias/.../pdfs/...`), páginas del Ministerio del Interior, y sitios legales.
- **Job runner**: Los PDFs se marcan como `SKIPPED` (línea 149-161). Solo procesa `text/html`.
- **EXTERNAL_SCRAPE**: La infraestructura backend existe (poll/complete/fail en rag-architect, RPCs en DB), pero **no hay worker desplegado**. 17 jobs en DLQ.
- **Firecrawl**: API key configurada. Puede usarse como primera línea para scraping antes de derivar al worker externo.
- **Dominios protegidos**: Solo académicos (Nature, Springer...). Falta BOE, gobierno, AEPD, etc.

### Cambios a implementar

#### 1. Mejorar rag-job-runner: Firecrawl como primera línea + PDF nativo

**Archivo**: `supabase/functions/rag-job-runner/index.ts`

- Añadir dominios legales/gobierno a `PROTECTED_DOMAINS`: `boe.es`, `interior.gob.es`, `industria.gob.es`, `aepd.es`, `vlex.es`, `noticias.juridicas.com`, `studocu.com`
- En `handleFetch`, antes de hacer fetch directo, intentar **Firecrawl scrape** si la API key está disponible. Firecrawl maneja JavaScript rendering, cookies, y devuelve markdown limpio.
- Para URLs que terminan en `.pdf`: descargar el binario y extraer texto con un parser básico (regex sobre el stream de texto del PDF). Si falla o el contenido es < 250 palabras, derivar a `EXTERNAL_SCRAPE`.
- Resultado: la mayoría de URLs se procesarán sin worker externo. Solo las que bloqueen a Firecrawl irán al worker.

#### 2. Script del Worker Externo Python (Playwright + PDF)

**Archivo nuevo**: `scripts/external-worker/worker.py` + `requirements.txt` + `Dockerfile`

El worker será un script Python que:
1. Hace polling a `rag-architect` (`external-worker-poll`) cada 5 segundos
2. Usa **Playwright** (headless Chromium) para renderizar páginas con JS/cookies
3. Usa **PyMuPDF** (fitz) para extraer texto de PDFs descargados
4. Envía el texto extraído via `external-worker-complete`
5. En caso de error, reporta via `external-worker-fail`

Estructura:
```text
scripts/external-worker/
├── worker.py          # Loop principal: poll → scrape/PDF → complete
├── requirements.txt   # playwright, pymupdf, requests, beautifulsoup4
├── Dockerfile         # Python 3.11 + Playwright browsers
└── README.md          # Instrucciones para Railway/Render
```

El Dockerfile instalará los browsers de Playwright. Desplegable en Railway con un solo click.

#### 3. Ampliar PROTECTED_DOMAINS para dominios legales españoles

Se añaden ~15 dominios gubernamentales y legales que requieren rendering completo o bloquean scrapers básicos.

#### 4. Fan-Out para procesamiento masivo de chunks

**Archivo**: `supabase/functions/rag-job-runner/index.ts`

Actualmente el chunking se hace en un solo job. Con 2000+ chunks previstos, esto causará timeouts. Cambio:
- `handleChunk` procesará en lotes de 50 chunks max por invocación
- Si quedan más, se auto-encola un nuevo job `CHUNK` con offset
- Mismo patrón de self-kick ya usado en el discovery

#### 5. Reintentar fuentes bloqueadas

Crear un endpoint `retry-stale-sources` en rag-architect que:
- Resetee todas las fuentes `NEW` de un RAG a estado procesable
- Re-encole jobs `FETCH` para las 279 fuentes pendientes del RAG de alarmas
- Esto se puede disparar desde la UI (botón en RagIngestionConsole)

### Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/rag-job-runner/index.ts` | Firecrawl como 1ª línea, PDF básico, fan-out chunks, dominios legales |
| `supabase/functions/rag-architect/index.ts` | Endpoint `retry-stale-sources` |
| `scripts/external-worker/worker.py` | Worker Python completo (nuevo) |
| `scripts/external-worker/Dockerfile` | Container para Railway (nuevo) |
| `scripts/external-worker/requirements.txt` | Dependencias Python (nuevo) |
| `scripts/external-worker/README.md` | Instrucciones deploy (nuevo) |
| `src/components/rag/RagIngestionConsole.tsx` | Botón "Reprocesar fuentes pendientes" |

### Orden de ejecución

1. Mejorar `rag-job-runner` (Firecrawl + PDF + dominios + fan-out)
2. Crear endpoint `retry-stale-sources`
3. Crear scripts del worker externo Python
4. Añadir botón en la UI
5. Desplegar edge functions
6. Disparar reprocesamiento de las 279 fuentes del RAG de alarmas

