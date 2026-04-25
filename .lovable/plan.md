
## Diagnóstico (verificado en BD y código)

Step 2 v5 de AFFLUX (`status=review`, `_clean_brief_md` presente, 71 cambios registrados) sigue con estos problemas:

- `business_projects.company = "Alejandro Gordo"` → el normalizador recibe `companyName="Alejandro Gordo"`, lo detecta como persona, lo mueve a `founder_or_decision_maker`, pero al rellenar `client_company_name` vuelve a poner `ctx.companyName` (= "Alejandro Gordo"). Empate. Por eso la portada sigue mal.
- `CANONICAL_GROUPS` por defecto y los `matchTokens` de AFFLUX comparten términos genéricos (`call`, `llamada`, `coach`, `agent`...) → fusiona "Catalogador de propietarios" con "Revista emocional", "Notas comerciales" con "Asistente pre/post llamada", etc.
- Los catalizadores de `business_catalysts` no se inyectan canónicamente, así que "fallecimiento/herencia" puede no aparecer aunque exista en otras secciones.
- `open_questions` y `client_requested_items` aún incluyen frases en inglés porque `client_requested_items` no está en la lista de campos a traducir y la tirada del LLM se topa con cap de 60.
- AFFLUX overrides ya cubre 12 componentes canónicos pero falta el 13 ("Centralizador documental y organización de datos") y la alerta "71" (existe pero el `manual_review_alerts_count` está a 1, conviene revisar texto).

Todo es **arreglable con una pasada editorial determinista** sobre el Step 2 actual. No se re-extrae, no se tocan chunks, no se tocan F2/F3/F5/PRD.

## Cambios propuestos (globales, no específicos de AFFLUX)

### 1. `supabase/functions/project-wizard-step/brief-normalizer.ts`

**a) `applyNamingSplit` — fix definitivo del empate persona/empresa**
- Si `ctx.companyName` también pasa `looksLikePersonName(...)`, NO usarlo como `client_company_name`. En su lugar:
  - usar `ctx.productName` (si existe) como company por defecto **o** `[POR CONFIRMAR]`.
  - mover `ctx.companyName` a `founder_or_decision_maker` si está vacío.
- Cuando `ctx.productName` esté presente y `client_company_name` siga siendo el mismo string que el founder, sustituir `client_company_name` por `productName` (caso AFFLUX donde la empresa real se llama AFLU/AFFLUX y no está en BD).

**b) `applySemanticDedup` — separación canónica estricta**
- Cuando se usan `ctx.canonicalComponents`, exigir **score mínimo + desempate**: para cada candidato, calcular hits contra TODOS los grupos y asignar al de **mayor score** (no al primero con ≥2). Si hay empate entre grupos distintos, no fusionar (dejar el ítem en su propio bucket renombrado al ganador único o al original).
- Añadir lista de pares mutuamente exclusivos (`mutexGroups`) en el `NormalizationContext` para impedir fusiones cruzadas conocidas:
  - "Catalogador de propietarios en 7 roles" ↔ "Generador de revista emocional"
  - "Analizador de notas comerciales" ↔ "Asistente pre/post llamada"
  - "Matching activo-inversor" ↔ "Detector de compradores institucionales"
  - "Soul de Alejandro" ↔ "RAG de conocimiento"

**c) Inyección de catalizadores canónicos**
- Nueva función `applyCanonicalCatalysts(briefing, ctx)` que, si `ctx.canonicalCatalysts` está definido, garantiza que cada catalizador aparezca en `business_catalysts` (añade items faltantes con `_inferred_by: "normalizer_catalyst_v1"`).
- Permite resolver el problema "fallecimiento/herencia debe estar en catalizadores".

**d) Traducción más amplia**
- Añadir `client_requested_items`, `underutilized_data_assets`, `inferred_needs` y `external_data_sources_mentioned` a `FIELDS_TO_SCAN`.
- Subir cap de `capped` de 60 a 120.
- Añadir más palabras EN al `EN_HINT_WORDS` (`recorded`, `calls`, `lost`, `opportunities`, `qualification`, `prioritization`, `graph`, `historical`, `record`, `building`, `deal`).

**e) Inyección de componentes obligatorios**
- Nueva función `ensureCanonicalComponentsPresent(briefing, ctx)`: tras el dedup, comprueba que cada `ctx.canonicalComponents[*].canonical` aparezca al menos una vez en `ai_native_opportunity_signals`. Si falta, inserta un placeholder con `_inferred_by: "normalizer_required_component_v1"` para que aparezca en el "Brief Limpio" como candidato F2/roadmap.

### 2. `src/lib/normalization-overrides.ts`

**a) Tipo extendido**: añadir `companyNameOverride?`, `canonicalCatalysts?`, `mutexGroups?`.

**b) AFFLUX overrides actualizados**:
- `companyNameOverride: "AFLU"` (con `productName: "AFFLUX"` ya existente).
- `matchTokens` afinados (eliminar términos demasiado genéricos compartidos, p. ej. quitar `call`/`llamada` del grupo "revista emocional" y de "Soul").
- `canonicalCatalysts`:
  - "Fallecimiento de propietario, herencia o cambio sucesorio como disparador de venta"
  - "Detección de compradores institucionales activos (tipo Benatar)"
  - "Desajuste entre oferta de edificios completos y demanda inversora"
  - "Baja respuesta y fricción comercial como catalizador de automatización"
- `mutexGroups`: las 4 parejas listadas arriba.
- Añadir 13.º componente canónico: "Centralizador documental y organización de datos".
- Confirmar texto exacto de la alerta "71".

### 3. `supabase/functions/project-wizard-step/index.ts`

- En la rama `repair_step2_brief`/`normalize_brief`, propagar `companyNameOverride`, `canonicalCatalysts` y `mutexGroups` al `NormalizationContext`.
- (No tocar lógica de chunks ni de PRD.)

### 4. `supabase/functions/project-wizard-step/clean-brief-builder.ts`

- Sección 9 "Componentes candidatos normalizados": si un ítem viene de `_inferred_by: "normalizer_required_component_v1"`, marcarlo como `*(candidato F2/roadmap)*` para no engañar sobre evidencia.
- Sección 4 "Catalizadores": ordenar primero los `_inferred_by: "normalizer_catalyst_v1"` para que destaquen los canónicos.
- Sección 7 "Compliance flags": forzar bullets limpios (ya lo hace) y traducir `evidence` que siga en inglés (re-aplicar `isLikelyEnglish` con un mini glosario fijo si la traducción LLM no llegó).

### 5. `src/hooks/useProjectWizard.ts`

- En `normalizeBrief()` enviar también los nuevos campos del override (`companyNameOverride`, `canonicalCatalysts`, `mutexGroups`).
- (Opcional) Si `companyNameOverride` está definido, mostrar un toast informativo: *"Se aplicará el nombre de empresa autoritativo: AFLU"*.

### 6. `src/main.tsx`

- Bump de `cache-bust` para forzar rebuild de la preview.

## Acción inmediata tras el merge

El usuario pulsa **"Limpiar y normalizar"** una vez. Eso ejecuta `repair_step2_brief` con los nuevos overrides, genera la v6 del Step 2 con:

- Cliente: **AFLU** · Decisor: **Alejandro Gordo** · Producto: **AFFLUX**
- 13 componentes canónicos sin fusiones cruzadas erróneas
- Catalizadores incluyendo fallecimiento/herencia
- Frases en inglés traducidas (incluyendo `client_requested_items` y `open_questions`)
- Alerta manual "71" presente
- PDF resultante 8-10 páginas

## Criterio de aceptación

- BD: `output_data.business_extraction_v2.client_naming_check.client_company_name = "AFLU"` (no "Alejandro Gordo").
- BD: `output_data._normalization_log.changes` contiene `naming_split` con `after: "AFLU"`.
- `_clean_brief_md` no contiene las frases EN del listado del usuario.
- Sección 9 contiene los 13 nombres canónicos, sin fusiones entre catalogador↔revista, notas↔llamada, matching↔detector institucional, Soul↔RAG.
- Sección 4 contiene "Fallecimiento de propietario..." como bullet.
- Sección 8 contiene la alerta "Revisar señal 71".
- `_clean_brief_md.length` < 12.000 chars (~8 páginas A4).
- No se ha tocado Step 3+.

## Fuera de alcance (explícitamente)

- No re-extraer.
- No tocar `chunked-extractor.ts`.
- No tocar PRD, propuesta, F2/F3/F4/F5.
- No cambiar `business_projects.company` automáticamente (lo dejamos al user; el override es la fuente de verdad para el brief).
