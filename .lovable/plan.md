

# Verificacion del Pipeline Completo: Proyecto → RAG → Patrones

No se necesitan cambios de codigo. Esto es una guia de comprobacion.

---

## Estado actual de la infraestructura

**Base de datos:** Las tablas `pattern_detection_runs`, `detected_patterns` existen y estan vacias (nunca se ha ejecutado el pipeline completo). Las columnas `linked_rag_id` y `auto_patterns` estan en `business_projects`.

**Edge functions:** `rag-architect` y `rag-job-runner` desplegadas y funcionando.

**Worker externo:** Los endpoints `external-worker-poll/complete/fail` responden correctamente (devuelven 401 sin service-role key, que es el comportamiento esperado).

**RAGs existentes:** Hay 2 RAGs completados pero ninguno vinculado a un proyecto (`project_id = null`).

---

## Test end-to-end recomendado

### Paso 1: Crear proyecto con RAG (UI)

1. Ve a `/projects`
2. Click "Nuevo proyecto"
3. Rellena nombre: "Test Pipeline E2E" y necesidad: "Analisis de inteligencia artificial aplicada a educacion infantil"
4. Activa el checkbox "Generar base de conocimiento (RAG)"
5. Verifica que aparece el campo de dominio (pre-rellenado con la necesidad)
6. Verifica que "Detectar patrones predictivos al completar" esta activado
7. Click "Crear proyecto"
8. Debe aparecer toast "RAG vinculado al proyecto"

### Paso 2: Verificar en base de datos

Tras crear, yo puedo ejecutar estas queries para confirmar:
- `business_projects` tiene `linked_rag_id` != null y `auto_patterns = true`
- `rag_projects` tiene el nuevo registro con `project_id` = id del proyecto
- `rag_jobs` tiene un job `DOMAIN_ANALYSIS` encolado

### Paso 3: Monitorizar construccion del RAG

1. Ve a `/rag-architect` y selecciona el RAG recien creado
2. Observa el progreso: domain_analysis → researching → building → completed
3. Esto tarda 5-15 minutos dependiendo del modo

### Paso 4: Verificar encadenamiento automatico de patrones

Una vez el RAG llega a `completed` (pasa quality_gate), el hook en `handlePostBuild` debe:
1. Detectar que el RAG tiene `project_id`
2. Verificar que `business_projects.auto_patterns = true`
3. Insertar un `pattern_detection_runs` con status `PENDING`
4. Encolar job `DETECT_PATTERNS`
5. El job-runner lo procesa llamando a `execute-pattern-detection`

Verificacion: consultar `pattern_detection_runs` y `detected_patterns` despues de que el RAG complete.

### Paso 5: Ver resultados en UI

1. Vuelve al proyecto en `/projects`
2. Abre la pestaña "Patrones"
3. Deberias ver 10-15 patrones organizados en 5 capas con badges de validacion

---

## Verificacion rapida sin esperar (queries directas)

Puedo hacer estas comprobaciones ahora mismo:

1. **Probar el endpoint external-worker-poll** - ya confirmado, devuelve 401 correctamente sin service key
2. **Verificar RPCs existen** - `pick_external_job`, `complete_external_job`, `fetch_external_job_stats` estan en la DB
3. **Verificar tablas existen** - `pattern_detection_runs` y `detected_patterns` confirmadas

---

## Riesgo identificado

El unico RAG completado que podria haber disparado el pipeline de patrones (`bcb87cf0`) tiene `project_id = null`, por lo que el hook en quality_gate no se activo (correcto, no hay proyecto asociado). Para probar el pipeline completo hay que crear un proyecto nuevo con RAG activado.

---

## Recomendacion

**Crea un proyecto de prueba desde la UI** con RAG activado en modo "Estandar" (mas rapido, ~500 fuentes). Esto disparara todo el pipeline y podremos verificar cada paso consultando la base de datos en tiempo real.

