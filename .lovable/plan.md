

# Plan: Restructure Phase 5 Pattern Detection to 5 Business Intelligence Layers

## Problem
Phase 5 currently uses technical detection layers (Obvia, Analítica Avanzada, Señales Débiles, Inteligencia Lateral, Edge Extremo). You want business intelligence layers aligned with the Brief extraction model.

## Changes in `supabase/functions/pattern-detector-pipeline/index.ts`

### 1. Rewrite Phase 5 system prompt (lines 736-748)
Replace the current layer definitions with:
- **CAPA 1 = Evidentes**: Lo que el cliente dice explícitamente, peticiones directas, requisitos claros
- **CAPA 2 = Proceso**: Cómo trabaja actualmente, workflows, hábitos operativos
- **CAPA 3 = Dolor**: Lo que le duele de verdad (no lo que dice, sino lo que revela el análisis)
- **CAPA 4 = Éxito Oculto**: Qué ha funcionado que nadie más ha detectado, insights no obvios
- **CAPA 5 = Sistémico**: Dinámicas profundas del negocio, del mercado, del equipo

Add rules:
- Minimum 3 patterns per layer (15-25 total)
- Mutual exclusivity between layers (no overlap)
- Prohibit generic titles ("Problema de eficiencia", "Oportunidad de mejora")
- Layer-specific confidence ranges (Capa 1: 0.7-1.0, Capa 5: 0.3-0.6)

### 2. Rewrite Phase 5 user prompt / JSON schema (lines 752-809)
Replace the signal schema with the required pattern schema:
```text
{
  "layers": [
    {
      "layer_id": 1,
      "layer_name": "Evidentes",
      "patterns": [
        {
          "patron_id": "EVD-001",
          "capa": 1,
          "titulo": "specific title (not generic)",
          "descripcion": "causal explanation",
          "evidencia_transcripcion": "exact quote or precise reference",
          "impacto_negocio": "quantified impact",
          "accion_recomendada": "concrete action with AI layer mapping",
          "confianza": 0.0-maxCap
        }
      ]
    }
  ]
}
```

Patron ID format: `EVD-XXX`, `PRC-XXX`, `DLR-XXX`, `EXO-XXX`, `SIS-XXX` by layer.

### 3. Update signal_registry insert loop (lines 929-948)
Adapt the DB insert to map the new schema fields (`patron_id` → `signal_name`, `titulo` as description, etc.) since the `signal_registry` table columns remain unchanged.

### 4. Keep sector-specific injection logic intact
The centros_comerciales hardcoded signals (lines 823-927) will remain functional — they inject into layers by `layer_id` which still maps 1-5.

### 5. Redeploy edge function

