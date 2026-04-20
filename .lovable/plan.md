

## Qué quieres

En las fichas de `/red-estrategica`, sustituir el cuadradito con el número grande (`8`, `9`, `7`) por el **anillo circular con porcentaje** que ya usamos dentro de la ficha de contacto (el "circulito con el 90"). Mismo lenguaje visual que el detalle del contacto, queda mejor.

## Cómo lo voy a hacer

### Cambio único en `src/components/contact/ContactCard.tsx`

Reemplazar el bloque actual del score:

```tsx
<div className="shrink-0 w-14 h-14 rounded-2xl border ...">
  {score}   // 8, 9, 7...
</div>
```

por el anillo `HealthMeter` (el mismo componente que se usa en `ContactDetail`):

```tsx
<HealthMeter
  score={contact.health_score}   // 0–10
  size="md"                       // 64×64 — encaja con el avatar de 56
  showLabel={false}
/>
```

- `HealthMeter` ya pinta el círculo SVG con gradient rojo→ámbar→verde según el score, número en el centro (`8`, `9`, `7`).
- Mantengo el `Tooltip` envolviendo el anillo con la misma explicación del cálculo (Sana / Atención / Crítica) — no se pierde la info al hover.
- Quito el helper `scoreTone()` que solo se usaba para el cuadradito (ya no hace falta para el score; el borde del card lo paso a un tono neutro `hover:border-primary/30` para no competir con el color del anillo).
- Tamaño `md` (64px) → equilibra bien con el avatar de 56px y el chip de categoría.

### Lo que NO toco

- Toolbar y filtros de `RedEstrategica.tsx` — siguen igual.
- Resto de la card: avatar, nombre, chip categoría, meta-fila (recencia, mensajes, podcast), `last_topic`, acciones de seguimiento → idénticos.
- `HealthMeter` — ya existe y funciona, no se modifica.
- Vista lista — sigue igual.

## Resultado esperado

Las fichas pasan a mostrar el mismo anillo circular con número que ves al entrar al detalle del contacto. Mismo lenguaje visual en toda la app, más reconocible de un vistazo.

