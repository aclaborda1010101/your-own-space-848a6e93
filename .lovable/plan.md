

## Plan: Mejorar calidad de próxima acción y sugerencias de WhatsApp

### Problemas detectados

1. **`proxima_accion.que` habla en tercera persona**: El análisis genera "Preguntar específicamente por el descanso físico de Mi Nena" — pero si le vas a escribir a ella, no deberías referirte a ella por su nombre. Debería decir "Preguntarle cómo se encuentra y cómo va la medicación".

2. **`generate-response-draft` genera mensajes genéricos**: Las sugerencias ("Que tal la medicación? has descansado") no suenan naturales para un contacto familiar. El prompt no recibe suficiente contexto sobre la relación familiar ni el tono adecuado.

### Cambios

**1. `supabase/functions/contact-analysis/index.ts`** — Mejorar instrucción de `proxima_accion`:

En la sección del prompt donde se define el schema JSON de `proxima_accion`, añadir instrucción explícita:

```
"proxima_accion": {
  "que": "Describe la acción en SEGUNDA PERSONA dirigida al contacto, 
          NO uses el nombre del contacto. 
          Ejemplo MALO: 'Preguntar a Mi Nena por su medicación'. 
          Ejemplo BUENO: 'Preguntarle cómo va la medicación y si ha descansado'.",
  "canal": "whatsapp|email|presencial|llamada",
  "cuando": "fecha", 
  "pretexto": "tema natural para abrir la conversación"
}
```

**2. `supabase/functions/generate-response-draft/index.ts`** — Mejorar contexto para contactos familiares:

- Añadir la **categoría del contacto** al prompt del usuario (familiar/personal/profesional) para que el LLM ajuste el tono.
- Para contactos **familiares**: añadir directiva de que el tono debe ser cariñoso, cercano, como hablarías a tu familia.
- Incluir el nombre del contacto en el prompt para que el LLM entienda que "Mi Nena" es un apodo cariñoso.

Cambio en el `systemPrompt` (después de las reglas absolutas):

```typescript
const familiarDirective = contact.category === 'familiar'
  ? `\n❤️ CONTACTO FAMILIAR: "${contact.name}" es un familiar cercano. 
     El tono DEBE ser cariñoso, cercano y natural. 
     Usa el mismo afecto que se ve en los mensajes de ejemplo.
     NO seas clínico ni formal. Escribe como le hablarías a tu familia.`
  : '';
```

Y en el `userPrompt` proactivo, reformular para que no copie literalmente la `proxima_accion`:

```typescript
const userPrompt = isProactive
  ? `Quiero INICIAR una conversación con ${contact.name} (${contact.category || 'contacto'}).
     NO estoy respondiendo a ningún mensaje.
     
     Lo que quiero conseguir: ${proactive_context}
     
     Genera 3 opciones para ABRIR la conversación. 
     Que suenen naturales, como si realmente le estuvieras escribiendo a esta persona.
     NO copies literalmente el objetivo — transfórmalo en un mensaje de WhatsApp real.`
  : ...
```

### Archivos a editar
- `supabase/functions/contact-analysis/index.ts` (mejorar instrucción proxima_accion)
- `supabase/functions/generate-response-draft/index.ts` (añadir directiva familiar + mejorar prompt proactivo)

### Resultado esperado
- Próxima acción: "Preguntarle cómo va la medicación y si ha podido descansar"
- Sugerencias: "Ey cariño, qué tal estás? has podido descansar?" (natural, cercano)

