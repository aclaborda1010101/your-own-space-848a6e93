
# Fix Curso de IA: Scroll, Calidad y Build

## Problemas identificados

1. **No se puede hacer scroll en las lecciones**: El DialogContent usa flex layout con ScrollArea pero el viewport no tiene altura correcta. Falta `overflow-y-auto` como fallback y el ScrollArea necesita una altura explicita.

2. **Contenido de baja calidad**: El prompt actual genera contenido academico y generico. Usa Gemini Flash (modelo rapido pero superficial). Necesita un prompt mucho mas profesional con enfoque practico y trucos reales.

3. **Error de build**: El bundle supera el limite de 2MB del plugin PWA workbox. Hay que aumentar `maximumFileSizeToCacheInBytes` en la config de Vite.

---

## Cambios

### 1. `vite.config.ts` - Fix build error

Anadir `maximumFileSizeToCacheInBytes: 3 * 1024 * 1024` (3MB) en la seccion workbox del plugin VitePWA para que no falle el build por el tamano del bundle.

### 2. `src/pages/AICourse.tsx` - Fix scroll en el dialog

- Cambiar el DialogContent para que el scroll funcione correctamente:
  - Usar `overflow-hidden` en el DialogContent
  - Dar al ScrollArea una clase con `overflow-y-auto` explicito
  - Asegurar que el contenedor flex del dialog reparte bien el espacio entre header, contenido scrollable y footer

### 3. `supabase/functions/ai-course-lesson/index.ts` - Mejorar calidad del contenido

Reescribir completamente el system prompt para que genere contenido profesional:

- **Enfoque practico**: Menos teoria academica, mas "como lo uso en mi dia a dia"
- **Trucos y tips reales**: Shortcuts, patrones que usan los profesionales, errores comunes
- **Ejemplos del mundo real**: No codigo de juguete, sino snippets que se pueden copiar y usar
- **Tono profesional pero cercano**: Como un mentor senior explicando a un colega
- **Estructura mejorada**: Anadir seccion "Pro Tips" y "Errores comunes" en lugar de la estructura actual
- **Modelo**: Usar `gemini-pro` (Gemini 1.5 Pro) en lugar del default Flash para contenido educativo de mayor calidad, y subir maxTokens a 8192

Estructura nueva del prompt:
```text
## Que vas a aprender (y por que importa)
## Conceptos clave (con analogias reales)
## Manos a la obra (ejemplo practico paso a paso)
## Pro Tips (trucos que no te ensenan en los cursos)
## Errores comunes (y como evitarlos)  
## Ejercicio practico
## Recursos para seguir aprendiendo
```

---

## Resultado esperado

- Las lecciones se pueden scrollear sin problemas dentro del dialog
- El contenido generado es practico, profesional y con trucos utiles
- El build no falla por el limite de tamano del PWA workbox
