# RAG External Worker — Playwright + PyMuPDF

Worker externo para procesar jobs `EXTERNAL_SCRAPE` que el edge function no puede manejar (PDFs pesados, sitios con JS/cookies).

## Variables de entorno requeridas

| Variable | Descripción |
|----------|-------------|
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Anon key del proyecto |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (secreto) |
| `WORKER_ID` | Identificador del worker (opcional) |
| `POLL_INTERVAL` | Segundos entre polls (default: 5) |

## Deploy en Railway

1. Crear nuevo proyecto en [Railway](https://railway.app)
2. Conectar este repositorio o subir la carpeta `scripts/external-worker/`
3. Configurar las variables de entorno en Railway
4. Railway detectará el `Dockerfile` automáticamente
5. El worker empezará a hacer polling inmediatamente

## Deploy con Docker local

```bash
cd scripts/external-worker
docker build -t rag-worker .
docker run -e SUPABASE_URL=https://xxx.supabase.co \
           -e SUPABASE_ANON_KEY=eyJ... \
           -e SUPABASE_SERVICE_ROLE_KEY=eyJ... \
           rag-worker
```

## Qué hace

1. **Poll**: Cada 5s consulta `rag-architect` por jobs `EXTERNAL_SCRAPE` pendientes
2. **PDF**: Si la URL es `.pdf`, descarga y extrae texto con PyMuPDF (OCR-ready)
3. **Web**: Si es una página web, renderiza con Playwright (Chromium headless), acepta cookies, y extrae texto limpio
4. **Report**: Envía el texto extraído de vuelta via `external-worker-complete` o reporta errores via `external-worker-fail`

## Monitorización

El worker se muestra en la **Consola de Ingestión** del RAG Architect en la sección "Worker Externo (Scraping)".
