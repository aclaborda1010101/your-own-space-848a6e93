

# Ronda 4: Vinculacion de contactos de segundo nivel + fixes pendientes de ronda 3

## Resumen

6 cambios: nueva funcionalidad de vinculacion de contactos de segundo nivel (la mas importante), refuerzo del filtrado estricto por ambito en el prompt, metricas segmentadas reales, gestiones compartidas, contactos honestos y dinamica de relacion. Los cambios 2-6 ya estaban en el prompt pero Claude no los aplica bien, asi que se reforzara el prompt con instrucciones mas directivas.

## Cambio 1: Vinculacion de contactos de segundo nivel (NUEVO)

### Base de datos

Nueva tabla `contact_links` para almacenar vinculaciones entre contactos de segundo nivel y contactos reales del sistema:

```text
contact_links
  id: uuid (PK)
  user_id: uuid (FK auth.users)
  source_contact_id: uuid (FK people_contacts) -- contacto donde se detecto la mencion
  target_contact_id: uuid (FK people_contacts) -- contacto vinculado del sistema
  mentioned_name: text -- nombre tal como aparece en los mensajes
  context: text -- contexto de la mencion
  first_mention_date: text -- fecha de primera mencion
  status: text -- 'linked' | 'ignored' | 'pending'
  created_at: timestamptz
```

RLS: solo el usuario propietario puede CRUD.

### Edge function (`contact-analysis`)

Sin cambios en la edge function para este cambio. Los datos de `red_contactos_mencionados` ya se generan en el JSON. La vinculacion es una accion del frontend.

### Frontend (`StrategicNetwork.tsx`)

En la seccion "RED DE CONTACTOS MENCIONADOS" de `ProfileByScope`, cada contacto mencionado tendra botones de accion:

- Si ya esta vinculado (existe en `contact_links` con status='linked'): mostrar enlace "Ver perfil" con icono de link verde
- Si hay posible match (nombre coincide con un contacto del sistema): mostrar sugerencia "Vincular con [nombre]?" con botones [Si, vincular] [No, es otra persona]
- Si no hay match: mostrar botones [Vincular con existente] [Crear contacto] [Ignorar]

Al hacer clic en "Vincular con existente", se abre un Combobox (Popover + Command, como ya existe en el proyecto) con busqueda de contactos. Al seleccionar uno, se crea el registro en `contact_links`.

Ademas, nueva seccion "MENCIONADO POR OTROS CONTACTOS" en `ProfileByScope` que consulta `contact_links` donde `target_contact_id` = contacto actual, mostrando quien lo menciona y en que contexto.

### Deteccion automatica de matches

Al cargar `ProfileByScope`, buscar en la lista de contactos del usuario si algun nombre de `red_contactos_mencionados` coincide (comparacion case-insensitive del primer nombre). Si hay match, marcar automaticamente `posible_match: true` en la UI (esto es independiente de lo que diga Claude).

## Cambio 2: Refuerzo del filtrado estricto por ambito

El prompt actual ya tiene las reglas pero Claude las ignora. Cambios:

- Mover las reglas de filtrado AL PRINCIPIO del prompt, antes de cualquier dato
- Anadir instruccion explicita en el system message: "ANTES de escribir cada campo del JSON, preguntate: este contenido pertenece al ambito X? Si no, EXCLUYELO."
- En el JSON template de salida, anadir comentarios inline: `"situacion_actual": "SOLO hechos del ambito ${ambito}, NO incluir proyectos si es personal"`
- Anadir regla negativa explicita para cada ambito: "Si estas en ambito personal, las palabras AICOX, WIBEX, MediaPRO, CFMOTO, Arabia Saudi, presupuesto de proyecto, deadline, entregable NO deben aparecer en tu analisis."

## Cambio 3: Metricas segmentadas reales

Reforzar el prompt para que `mensajes_ambito` contenga numeros ESTIMADOS pero razonables:

- Instruccion: "Cuenta los mensajes del bloque de WhatsApp. Clasifica cada uno como profesional/personal/familiar. Reporta el conteo real en mensajes_ambito.total, el porcentaje en mensajes_ambito.porcentaje y la media semanal filtrada en mensajes_ambito.media_semanal."
- Anadir al JSON template un campo extra: `"distribucion_ambitos": { "profesional_pct": X, "personal_pct": Y, "familiar_pct": Z }` que se muestra como mini-resumen en TODAS las vistas

## Cambio 4: Gestiones compartidas

Ya esta en el prompt. Reforzar con instruccion mas explicita:
- "Si detectas menciones de dinero que NO son presupuestos de proyecto (lineas de telefono, prestamos, pagos compartidos, suscripciones), incluyelos SIEMPRE en gestiones_compartidas, NUNCA en pipeline ni datos_clave profesionales."

## Cambio 5: Contactos de segundo nivel honestos

Ya esta en el prompt. Reforzar:
- "Si solo tienes una mencion de un nombre en una felicitacion de cumpleanos, usa relacion: 'no_determinada'. NUNCA uses 'familiar', 'amigo' ni 'otro' sin evidencia explicita en los mensajes."

## Cambio 6: Dinamica de la relacion

Ya esta en el prompt. Sin cambios adicionales necesarios (la seccion ya se renderiza en el frontend).

## Archivos a modificar

### 1. `supabase/migrations/xxx.sql`
- Crear tabla `contact_links` con RLS

### 2. `supabase/functions/contact-analysis/index.ts`
- Reorganizar el prompt: filtrado al principio, instrucciones mas directivas
- Anadir `distribucion_ambitos` al JSON schema
- Reforzar instrucciones negativas explicitas por ambito
- Actualizar system message con regla de auto-verificacion

### 3. `src/pages/StrategicNetwork.tsx`
- Seccion "RED DE CONTACTOS MENCIONADOS": anadir botones de vinculacion (Vincular/Ignorar/Crear)
- Combobox de busqueda de contactos para vincular
- Logica para guardar/consultar `contact_links`
- Nueva seccion "MENCIONADO POR OTROS CONTACTOS" que consulta links inversos
- Deteccion automatica de matches comparando nombres con contactos existentes
- Mostrar `distribucion_ambitos` como mini-resumen en cada vista

## Flujo de vinculacion detallado

```text
1. Usuario abre perfil de Carls
2. En "Red de contactos mencionados" aparece "Oscar Lopez"
3. El sistema compara "Oscar Lopez" con todos los contactos del usuario
4. Si encuentra match -> muestra: "Oscar Lopez 🔗 ¿Vincular con Oscar Lopez (profesional)?" [Si] [No]
5. Si no encuentra match -> muestra: "Oscar Lopez" [Vincular con existente] [Crear contacto] [Ignorar]
6. Al vincular: INSERT en contact_links (source=Carls, target=Oscar, mentioned_name="Oscar Lopez")
7. En el perfil de Oscar Lopez, seccion "Mencionado por otros": "Carls Primo (03/02): Colaboracion MediaPRO"
```

## Detalle tecnico del refuerzo de prompt

```text
SYSTEM MESSAGE actualizado:
"Eres un analista de inteligencia relacional para el ambito [X].
REGLA CRITICA: Cada campo del JSON debe contener SOLO informacion del ambito [X].
ANTES de escribir cualquier campo, verifica: ¿este contenido es de [X]?
Si no lo es, EXCLUYELO aunque dejes el campo vacio o con pocos datos.
Es MEJOR un analisis corto y honesto que uno largo con datos del ambito equivocado."

PROMPT - nueva seccion al principio:
"## FILTRO OBLIGATORIO - LEER PRIMERO
Este analisis es para el ambito [X].
CONTENIDO PROHIBIDO en este ambito:
- [lista explicita segun ambito]
Si un campo queda vacio por falta de datos del ambito correcto, escribe un insight honesto explicando la situacion."
```

