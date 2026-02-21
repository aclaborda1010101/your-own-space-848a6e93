

# Ronda 5: Analisis Historico Completo + Consistencia de Datos

## Resumen ejecutivo

5 cambios en la Edge Function `contact-analysis` y ajustes menores en el frontend para transformar el analisis de una foto de 30 dias a un perfil profundo de relacion con historia completa.

## Cambios por problema

### Problema 1: Analisis historico completo (no solo 30 dias)

**Nuevo campo en BD:** Agregar columna `historical_analysis` (jsonb) a `people_contacts` para almacenar el analisis historico persistente.

**Cambios en `supabase/functions/contact-analysis/index.ts`:**

1. Agregar un paso previo que detecta si `historical_analysis` ya existe en el contacto.
2. Si NO existe (primera vez):
   - Recuperar TODOS los mensajes del contacto en bloques de 3,000 (usando paginacion con `.range()`).
   - Dividir los mensajes en bloques trimestrales.
   - Procesar cada bloque con la IA generando un "resumen progresivo" (cada bloque recibe el resumen acumulado anterior).
   - El resultado final es un JSON con: historia de la relacion, hitos, temas historicos principales, evolucion anual.
   - Guardar en `people_contacts.historical_analysis`.
3. Si YA existe:
   - Verificar si han pasado mas de 30 dias desde la ultima actualizacion.
   - Si si: enviar solo los mensajes nuevos + el historical_analysis existente para actualizarlo.
   - Si no: reutilizar el existente.
4. Inyectar el `historical_analysis` como contexto en el prompt de analisis de 30 dias para que la "Situacion actual" haga referencia al historial.

**Nuevo prompt de analisis historico:** Un prompt dedicado que pide:
- Fecha del primer contacto y duracion de la relacion
- Evolucion anual (mensajes por ano + descripcion)
- Hitos clave con fechas
- Temas historicos principales por ambito
- Apodos y dinamicas recurrentes

**Impacto en coste:** La primera vez sera costosa (~4-6 llamadas a la IA para un contacto con 18,000 msgs). Las siguientes veces solo procesan mensajes nuevos. Se usa Gemini Flash para los bloques de resumen (mas barato) y Claude solo para la consolidacion final.

### Problema 2: Porcentajes iguales en todas las vistas

**Cambios en `supabase/functions/contact-analysis/index.ts`:**

1. ANTES de iterar por ambitos, ejecutar UNA sola llamada a la IA que clasifique una muestra de mensajes y calcule `distribucion_ambitos` global.
2. Almacenar este resultado como `global_distribution` en el perfil.
3. En cada iteracion por ambito, inyectar estos porcentajes PRE-CALCULADOS en vez de pedir a la IA que los estime de nuevo.
4. El JSON de cada ambito usa los mismos valores de `distribucion_ambitos`.

**Cambios en `src/pages/StrategicNetwork.tsx` (ProfileByScope):**

- Leer `distribucion_ambitos` desde el nivel superior del perfil (no desde cada ambito individual).

### Problema 3: Informacion de segundo nivel compartida entre vistas

**Cambios en `supabase/functions/contact-analysis/index.ts`:**

1. Despues de procesar todos los ambitos, hacer un paso de POST-PROCESAMIENTO:
   - Recopilar `red_contactos_mencionados` de TODOS los ambitos.
   - Unificar por nombre: si "Angelito" aparece en profesional con contexto y en personal sin contexto, usar el contexto de profesional.
   - Escribir la lista unificada en todos los ambitos, anadiendo el campo `contexto_por_ambito` con la info especifica de cada vista.
2. Solo mostrar una persona en un ambito si tiene menciones relevantes en ESE ambito.

### Problema 4: Vincular contactos conocidos antes de marcar "no determinada"

**Cambios en `supabase/functions/contact-analysis/index.ts`:**

1. Antes de enviar el prompt a la IA, recuperar la lista de contactos del usuario desde `people_contacts` (nombre + relacion + categoria).
2. Inyectar esta lista en el prompt como "CONTACTOS CONOCIDOS DEL USUARIO".
3. Anadir instruccion: "Si una persona mencionada coincide con un contacto conocido, usa la relacion conocida en vez de 'no_determinada'. Marca `posible_match: true` y anade `match_id` con el nombre del contacto."
4. Casos especiales: si el nombre es "Juany" y hay un contacto "Juany" con categoria "familiar" o "personal", vincular automaticamente.

### Problema 5: Clasificacion familiar mas estricta

**Cambios en `supabase/functions/contact-analysis/index.ts`:**

1. Anadir al prompt de clasificacion global (Problema 2) reglas explicitas:

```
REGLAS DE CLASIFICACION FAMILIAR:
- FAMILIAR solo si el mensaje HABLA SOBRE familia (hijos, pareja, padres, salud familiar).
- Los apodos carinosos entre amigos (hermanito, gordo, negrito) son PERSONALES, no familiares.
- Las expresiones de afecto ("te quiero", "te amo") entre amigos son PERSONALES.
- Un mensaje es FAMILIAR solo si menciona a un FAMILIAR CONCRETO o trata un TEMA FAMILIAR.
```

2. Actualizar `FAMILIAR_LAYER` para incluir estas reglas de exclusion.

## Detalle tecnico

### Migracion SQL

```sql
ALTER TABLE people_contacts ADD COLUMN IF NOT EXISTS historical_analysis jsonb;
```

### Flujo de procesamiento de bloques historicos

```text
18,000 msgs -> dividir en bloques de ~3,000 msgs (6 bloques)
  Bloque 1 (jul-dic 2022) -> Gemini Flash -> Resumen 1
  Bloque 2 (ene-jun 2023) -> Gemini Flash + Resumen 1 -> Resumen 2
  Bloque 3 (jul-dic 2023) -> Gemini Flash + Resumen 2 -> Resumen 3
  Bloque 4 (ene-jun 2024) -> Gemini Flash + Resumen 3 -> Resumen 4
  Bloque 5 (jul-dic 2024) -> Gemini Flash + Resumen 4 -> Resumen 5
  Bloque 6 (ene 2025-feb 2026) -> Gemini Flash + Resumen 5 -> Resumen Final
  
  Resumen Final -> Guardar en historical_analysis
  Resumen Final -> Inyectar como contexto en analisis de 30 dias
```

### Archivos modificados

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/contact-analysis/index.ts` | Logica de bloques historicos, clasificacion global, vinculacion de contactos, post-procesamiento de red |
| `src/pages/StrategicNetwork.tsx` | Leer distribucion desde nivel global, mostrar seccion de historia |
| Migracion SQL | Anadir columna `historical_analysis` |

### Consideraciones de coste

- Primera ejecucion con historial: ~6 llamadas a Gemini Flash (barato) + 1 consolidacion con Claude = ~$0.10-0.15 por contacto
- Ejecuciones posteriores: solo mensajes nuevos del ultimo mes = coste normal
- Se anade un boton separado "Analisis Historico" para que el usuario controle cuando ejecutar el analisis completo (no se lanza automaticamente)

### Timeout

- La Edge Function tiene un timeout de 150s. Con 6 bloques secuenciales a Gemini Flash (~3-5s cada uno) + 1 llamada Claude = ~25-35s total. Dentro del limite.

