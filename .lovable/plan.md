

# Fix: Eliminar secciones 2.12/2.13 y añadir texto descriptivo al presupuesto

## Problemas

1. **Secciones 2.12 "Inversión por fase" y 2.13 "Costes recurrentes mensuales estimados"** siguen apareciendo en el scope. Deben filtrarse antes de renderizar, igual que ya se hace con "Comparativa/Alternativas".

2. **Presupuesto sin texto descriptivo**: Cada modelo de monetización muestra solo el título y los precios, pero falta el párrafo introductorio. Por ejemplo, "Precio fijo + Mantenimiento mensual" debería ir precedido de: *"Implementación completa con precio fijo inicial más cuota mensual reducida para mantenimiento, actualizaciones y soporte."* Esto viene del campo `description` del modelo.

## Cambios en `supabase/functions/generate-document/index.ts`

### 1. Filtrar secciones "Inversión por fase" y "Costes recurrentes" del scope

En la línea 1810 donde ya se filtran secciones de "comparativa", añadir patrones adicionales para eliminar secciones cuyo heading contenga "inversión por fase" o "costes recurrentes":

```
cleanScope = cleanScope.replace(
  /^##\s*(?:.*(?:inversión\s+por\s+fase|costes?\s+recurrentes?).*)\n(?:(?!^##\s)[\s\S])*?(?=\n##\s|\n#\s|$)/gim, 
  ""
);
```

### 2. Añadir descripción del modelo en el presupuesto

En la sección de monetización (línea 1948), después del `<h4>` del nombre del modelo, renderizar `model.description` como párrafo introductorio:

```typescript
parts.push(`<h4>${escHtml(model.name)}</h4>`);
if (model.description) {
  parts.push(`<p style="font-size:9.5pt;color:var(--text-light);margin:4px 0 12px;">${escHtml(model.description)}</p>`);
}
```

## Fichero

| Fichero | Cambio |
|---|---|
| `supabase/functions/generate-document/index.ts` | Añadir regex para filtrar "Inversión por fase" y "Costes recurrentes" del scope. Añadir `model.description` como párrafo bajo cada título de modelo en el presupuesto. |

