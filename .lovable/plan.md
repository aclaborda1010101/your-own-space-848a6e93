

# Fix: Scroll en cuestionario y mensaje confuso en Radiografia

## Problemas detectados

### 1. No se puede hacer scroll en el cuestionario
La pagina deberia hacer scroll nativo del navegador, pero el contenido del cuestionario queda cortado. Esto puede deberse a que el contenido esta dentro de tabs anidados (ProjectDetail tabs > BusinessLeverageTabs) y el area no tiene scroll explicito. Solucion: envolver el contenido del cuestionario en un `ScrollArea` con altura maxima, o asegurar que la pagina principal haga scroll anadiendo `overflow-y-auto` al contenedor principal.

### 2. Mensaje confuso en la tab Radiografia
Cuando el cuestionario esta completado (15/15) pero el usuario no ha pulsado "Generar radiografia", al ir a la tab Radiografia ve "Completa el cuestionario primero para generar la radiografia". Esto es confuso porque el cuestionario YA esta completo. El problema es que `diagnostic` es `null` hasta que se ejecute el analisis.

## Cambios propuestos

### `src/components/projects/QuestionnaireTab.tsx`
- Envolver la lista de preguntas en un `ScrollArea` con `max-h-[60vh]` para garantizar scroll dentro del tab
- Esto asegura que el cuestionario siempre sea scrolleable independientemente del layout padre

### `src/components/projects/DiagnosticTab.tsx`
- Cambiar el mensaje cuando `diagnostic` es null: en vez de "Completa el cuestionario primero", mostrar "Pulsa 'Generar radiografia' en la pestana Cuestionario para analizar las respuestas"
- Esto guia mejor al usuario sobre lo que debe hacer

### `src/pages/Projects.tsx`
- Anadir `overflow-y-auto` al contenedor principal del `ProjectDetail` para asegurar scroll de pagina

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `src/components/projects/QuestionnaireTab.tsx` | Envolver preguntas en ScrollArea |
| `src/components/projects/DiagnosticTab.tsx` | Mejorar mensaje cuando no hay diagnostico |
| `src/pages/Projects.tsx` | Asegurar scroll en ProjectDetail |
