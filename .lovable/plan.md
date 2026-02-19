

# Ajustes al sistema de analisis de contactos -- Ronda 2

## Resumen

5 mejoras al sistema de analisis de contactos: multi-ambito, alertas etiquetadas, metricas exactas, red de segundo nivel y evolucion temporal.

## Cambios

### 1. Multi-ambito: analisis por TODAS las pestanas aplicables

**Problema**: Un contacto solo se analiza con un ambito (el campo `category`). Si "Carls Primo" es profesional Y familiar, solo se genera perfil profesional.

**Solucion**:

- Anadir columna `categories text[]` a `people_contacts` (array, por defecto `[category]`)
- Cambiar el edge function `contact-analysis` para que acepte un parametro `scopes` (array de ambitos) y genere un analisis por cada uno. El resultado se guarda como `{ profesional: {...}, personal: {...}, familiar: {...} }` en `personality_profile`
- En el frontend, los botones profesional/personal/familiar del header pasan de ser un selector de categoria unica a toggles multi-seleccion. Cada uno activa/desactiva ese ambito para el contacto
- `ProfileByScope` lee `profile[ambito]` en lugar de `profile` directamente
- "Analizar IA" envia todos los ambitos activos al edge function

### 2. Alertas etiquetadas: [CONTACTO] vs [OBSERVACION]

**Solucion** (solo prompt del edge function):

- Anadir al prompt reglas claras:
  - Las alertas son SIEMPRE sobre el contacto
  - Si el USUARIO dice algo sobre si mismo, NO es alerta del contacto
  - Cada alerta debe llevar etiqueta: `[CONTACTO]` o `[OBSERVACION]`
- Actualizar el JSON schema de alertas para incluir campo `tipo: "contacto" | "observacion"`
- En el frontend, mostrar la etiqueta con color diferenciado

### 3. Metricas exactas calculadas desde datos reales

**Solucion** (edge function):

- Antes de llamar a Claude, calcular las metricas directamente desde los mensajes en el edge function:
  - Total mensajes ultimos 30 dias
  - Media semanal (actual y mes anterior)
  - Tendencia con porcentaje
  - Ratio de iniciativa (quien envia primer mensaje tras silencio >4h)
  - Dia mas activo y horario habitual
  - Canales usados
- Inyectar estos datos pre-calculados en el prompt para que Claude los use tal cual, sin inventar
- Actualizar el schema JSON de `metricas_comunicacion` con los nuevos campos

### 4. Red de contactos de segundo nivel

**Solucion** (prompt + frontend):

- Anadir al prompt instrucciones para extraer personas mencionadas en los mensajes con contexto y fecha
- Nuevo campo en el JSON: `red_contactos_mencionados: [{ nombre, contexto, fecha_mencion, relacion }]`
- En `ProfileByScope`, nueva seccion "Red de contactos mencionados" con icono de Network/Users

### 5. Evolucion temporal

**Solucion** (prompt + frontend):

- Anadir al prompt instrucciones para generar `evolucion_reciente: { hace_1_mes, hace_1_semana, hoy, tendencia_general }`
- En `ProfileByScope`, nueva Card despues de "Situacion actual" que muestre la linea temporal

## Archivos modificados

1. **`supabase/migrations/xxx.sql`** -- Anadir columna `categories text[]` a `people_contacts`
2. **`supabase/functions/contact-analysis/index.ts`** -- Reescritura mayor:
   - Recibir `scopes` como parametro
   - Pre-calcular metricas exactas desde los mensajes
   - Loop por cada ambito generando analisis independiente
   - Nuevos campos en prompt: alertas etiquetadas, red segundo nivel, evolucion temporal
   - Guardar resultado como `{ profesional: {...}, familiar: {...} }` en personality_profile
3. **`src/pages/StrategicNetwork.tsx`**:
   - Header: categoria pasa de selector unico a toggles multi-seleccion con `categories[]`
   - `handleAnalyze`: envia array de scopes
   - `ProfileByScope`: lee `profile[ambito]` en vez de `profile`
   - Nuevas secciones: Red de contactos, Evolucion temporal
   - Metricas ampliadas con nuevos campos
   - Alertas con etiqueta visual [CONTACTO]/[OBSERVACION]

## Detalle tecnico del flujo multi-ambito

```text
ANTES:
  contact.category = "profesional"
  contact-analysis(contact_id) -> analiza 1 ambito -> guarda JSON plano

DESPUES:
  contact.categories = ["profesional", "familiar"]
  contact-analysis(contact_id, scopes=["profesional","familiar"])
  -> Loop: para cada scope, genera analisis con prompt especifico
  -> Guarda: { profesional: {datos...}, familiar: {datos...} }
  -> UI: tab profesional muestra profile.profesional, tab familiar muestra profile.familiar
```

## Detalle tecnico de metricas pre-calculadas

```text
En el edge function, ANTES de llamar a Claude:
1. Contar mensajes ultimos 30 dias y 30-60 dias
2. Agrupar por semana para media semanal
3. Detectar inicios de conversacion (primer msg tras >4h silencio)
4. Contar por dia de semana y hora
5. Inyectar como seccion "METRICAS PRE-CALCULADAS (usar tal cual)" en el prompt
```

