

## Plan: Exportar DOCX con estilo HOT en todos los apartados de Auditoría IA

Dos cambios principales: actualizar el template DOCX para que coincida con el estilo del documento HOT, y reemplazar/añadir botones DOCX en todos los tabs de auditoría.

---

### 1. Actualizar estilo DOCX en Edge Function (`generate-document/index.ts`)

Adaptar el template para replicar el estilo visual del documento HOT:

- **Colores**: Cambiar `BRAND` de indigo/violeta a dark teal (`0A3039`) + green accent (`7ED957`) + white
- **Cover page**: Fondo dark teal (shading), titulo centrado en blanco bold, subtitulo en verde accent
- **H1**: Background dark teal bar con texto blanco bold (usando `shading` en Paragraph)
- **H2**: Bold, dark, grande, sin fondo (estilo limpio del HOT)
- **Header**: Barra dark teal con texto blanco (nombre proyecto + "CONFIDENCIAL")
- **Footer**: Texto en gris, centrado, "Agustito · Consultora Tecnologica"
- **Body text**: Sans-serif limpio, tamaño consistente
- **Bullets**: Con bold en texto inicial si hay patron `**texto**:`

---

### 2. Añadir botón DOCX en cada tab de auditoría

Actualmente los 4 tabs (Cuestionario, Radiografía, Plan por Capas, Roadmap) solo tienen "Exportar MD". Hay que:

**A) Pasar `auditId` y `auditName` a los tabs que no lo tienen:**
- `BusinessLeverageTabs.tsx`: pasar `auditId` y `auditName` a `DiagnosticTab`, `RecommendationsTab`, `RoadmapTab`
- Actualizar props interfaces de esos 3 componentes

**B) Añadir botón DOCX junto al MD existente en cada tab:**
- **DiagnosticTab**: botón DOCX que genera markdown con `handleExportMd` logic y llama a `generate-document`
- **RecommendationsTab**: igual, usando el markdown que ya construyen para export
- **RoadmapTab**: igual, usando `roadmap.full_document_md`
- **QuestionnaireTab**: ya tiene `auditId`, añadir botón DOCX

Cada botón usará un patron comun: estado `generatingDocx`, llamada a `supabase.functions.invoke("generate-document", { body: { projectId: auditId, stepNumber: N, content: md, contentType: "markdown", projectName: auditName } })`, y `window.open(data.url)`.

**C) El tab "Documento Final" ya tiene DOCX** - solo se beneficia del cambio de estilo.

---

### 3. Step numbers para auditoría

Asignar stepNumbers dedicados para diferenciar cada tab de auditoría:
- Cuestionario: `stepNumber: 11`
- Radiografía: `stepNumber: 12`  
- Plan por Capas: `stepNumber: 13`
- Roadmap: `stepNumber: 14`
- Documento Final: ya usa `stepNumber: 10`

Añadir estos títulos al `STEP_TITLES` del edge function.

---

### Resumen de archivos a modificar

1. `supabase/functions/generate-document/index.ts` - nuevo estilo HOT + stepNumbers 11-14
2. `src/components/projects/BusinessLeverageTabs.tsx` - pasar auditId/auditName a 3 tabs
3. `src/components/projects/DiagnosticTab.tsx` - añadir props auditId/auditName + botón DOCX
4. `src/components/projects/RecommendationsTab.tsx` - igual
5. `src/components/projects/RoadmapTab.tsx` - igual
6. `src/components/projects/QuestionnaireTab.tsx` - añadir botón DOCX
7. Redeploy edge function

