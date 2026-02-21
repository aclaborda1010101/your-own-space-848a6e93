
# Fix: Eliminar emojis de RAG Architect + Restaurar scroll del cuestionario AI Leverage

## Problema 1: Emojis en toda la UI de RAG Architect

Los componentes RAG usan emojis en lugar de iconos Lucide, violando la estetica del proyecto. Se eliminaran todos los emojis de:

### Archivos afectados y cambios:

**`src/components/rag/RagCreator.tsx`**
- Linea 16: `"📋 Estándar"` -> `"Estándar"` (usar icono Eye ya importado)
- Linea 27: `"🔬 Profundo"` -> `"Profundo"` (usar icono Layers ya importado)
- Linea 37: `"🌍 TOTAL"` -> `"TOTAL"` (usar icono Globe ya importado)
- Linea 93: Quitar emoji `⏱️` del tiempo, usar icono Clock de Lucide
- Linea 102: `"🌍 MODO TOTAL ACTIVADO"` -> `"MODO TOTAL ACTIVADO"` con icono Globe
- Renderizar el icono del modo como componente `<mode.icon />` en lugar del texto con emoji

**`src/pages/RagArchitect.tsx`**
- Lineas 32-36: Eliminar mapa `modeIcons` con emojis, usar iconos Lucide (Eye, Layers, Globe)
- Linea 69: Reemplazar emoji en titulo del detalle por icono Lucide
- Linea 134: Reemplazar emoji en lista por icono Lucide
- Linea 159: `"🏗️ Nuevo RAG Total"` -> `"Nuevo RAG Total"` con icono Database

**`src/components/rag/RagBuildProgress.tsx`**
- Lineas 21-28: Quitar emojis del mapa `levelLabels` (`🌐`, `🎓`, `📊`, `🎬`, `👥`, `🔬`, `🔀`)

**`src/components/rag/RagDomainReview.tsx`**
- Linea 59: `"📋 HEMOS ENTENDIDO QUE:"` -> sin emoji
- Linea 77: `"📚 SUBDOMINIOS DETECTADOS"` -> sin emoji
- Linea 109: `"📊 VARIABLES CRÍTICAS"` -> sin emoji
- Linea 126: `"✅ QUERIES DE VALIDACIÓN"` -> sin emoji
- Linea 145: `"⚡ DEBATES CONOCIDOS"` -> sin emoji

## Problema 2: Scroll roto en cuestionario AI Leverage

**`src/components/projects/QuestionnaireTab.tsx`**
- Linea 94: `<ScrollArea className="max-h-[60vh]">` necesita altura explicita para funcionar. `max-h` no define un viewport de scroll valido para ScrollArea de Radix.
- Cambiar a: `<ScrollArea className="h-[calc(100vh-280px)]">` para dar una altura fija calculada que permita el scroll interno y mantenga los botones de accion visibles.

## Secuencia
1. Limpiar emojis de los 4 componentes RAG + pagina
2. Corregir ScrollArea del cuestionario
