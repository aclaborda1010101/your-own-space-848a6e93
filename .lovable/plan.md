

# Wizard de Onboarding + Vinculacion Inteligente de Contactos

Este es un modulo grande que se implementara en fases incrementales. Esta primera implementacion cubre las **Fases 1-3** del spec: wizard completo + vinculacion automatica + tabla de aliases.

---

## Estado actual del sistema

- Ya existen 1162 contactos en `people_contacts`
- Existe tabla `phone_contacts` para contactos importados de agenda
- Existe tabla `contact_messages` para mensajes de WhatsApp
- Existe tabla `contact_links` para relaciones entre contactos
- Ya hay logica de importacion de CSV/WhatsApp en `DataImport.tsx` (2146 lineas)
- Ya hay logica de email sync con Gmail/IMAP
- NO existe tabla `contact_aliases` ni `contact_link_suggestions` ni `contact_relationships`
- NO existe flag de "onboarding completado" en `user_settings`

---

## Fase 1: Base de datos

### Nuevas tablas

**`contact_aliases`** — Diccionario de nombres alternativos por contacto
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| contact_id | uuid REFERENCES people_contacts(id) ON DELETE CASCADE | |
| alias | text NOT NULL | "Angelito", "Angie" |
| source | text NOT NULL | whatsapp/plaud/email/manual/wizard |
| confidence | numeric DEFAULT 1.0 | 1.0 = confirmado, 0.5-0.9 = sugerido |
| context | text | Contexto de donde se detecto |
| is_dismissed | boolean DEFAULT false | |
| created_at | timestamptz DEFAULT now() | |
| UNIQUE(user_id, contact_id, alias) | | |

**`contact_link_suggestions`** — Cola de vinculaciones pendientes de confirmar
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| mentioned_name | text NOT NULL | El nombre detectado |
| mentioned_in_source | text NOT NULL | whatsapp/plaud/email |
| mentioned_in_id | text | ID de la fuente |
| mentioned_by | uuid REFERENCES people_contacts(id) ON DELETE SET NULL | |
| suggested_contact | uuid REFERENCES people_contacts(id) ON DELETE CASCADE | |
| confidence | numeric DEFAULT 0.5 | |
| confidence_reasons | jsonb | Razones del match |
| status | text DEFAULT 'pending' | pending/accepted/rejected/deferred |
| created_at | timestamptz DEFAULT now() | |
| resolved_at | timestamptz | |

**`contact_relationships`** — Relaciones detectadas entre contactos
| Columna | Tipo | Descripcion |
|---------|------|-------------|
| id | uuid PK | |
| user_id | uuid NOT NULL | |
| contact_a_id | uuid REFERENCES people_contacts(id) ON DELETE CASCADE | |
| contact_b_id | uuid REFERENCES people_contacts(id) ON DELETE CASCADE | |
| relationship_type | text | colleagues/mentioned_together/same_project/family |
| context | text | |
| source | text | |
| first_detected | timestamptz DEFAULT now() | |
| mention_count | int DEFAULT 1 | |
| UNIQUE(user_id, contact_a_id, contact_b_id) | | |

### Columna nueva en `user_settings`

- `onboarding_completed` boolean DEFAULT false — indica si el wizard se completo

### Columna nueva en `people_contacts`

- `vcard_raw` jsonb — campos originales del vCard para referencia

### RLS

Todas las tablas con politica standard `user_id = auth.uid()` para CRUD.

---

## Fase 2: Wizard de Onboarding — Nueva pagina `/onboarding`

### Componente `src/pages/Onboarding.tsx`

Wizard de 4 pasos con stepper visual:

**Paso 1 — Contactos (.vcf / .csv)**
- Parser de vCard (.vcf): extraer nombre, telefonos, emails, empresa, cargo, notas
- Reutilizar el parser CSV existente de DataImport para archivos .csv
- Deduplicacion por telefono Y email contra `people_contacts` existentes
- Si contacto ya existe: enriquecer (anadir telefonos/emails nuevos, rellenar campos vacios)
- Guardar `vcard_raw` con todos los campos originales
- Mostrar resumen: X nuevos, Y enriquecidos, Z duplicados descartados

**Paso 2 — WhatsApp**
- Reutilizar parsers existentes de `whatsapp-file-extract.ts` y `whatsapp-block-parser.ts`
- Subir multiples .txt
- Detectar speaker principal de cada chat
- Match automatico por telefono contra contactos del paso 1
- Match por nombre parcial → marcar para vinculacion (paso 4)
- Mostrar resumen: X chats importados, Y mensajes, Z contactos vinculados

**Paso 3 — Email**
- Mostrar cuentas ya conectadas (consultar `email_accounts`)
- Botones para conectar Gmail / IMAP (redirige a flows existentes)
- Boton "Sincronizar" que invoca `email-sync` con action "reprocess"
- Mostrar progreso/resultado

**Paso 4 — Vinculacion inteligente**
- Ejecutar matching automatico (telefono, email exacto, nombre completo)
- Generar sugerencias para matches parciales
- UI de tarjetas con boton Aceptar / Rechazar / Posponer / Crear contacto
- Al aceptar: crear alias con confidence 1.0
- Al rechazar: marcar `is_dismissed` en suggestion
- Al terminar: marcar `onboarding_completed = true` en user_settings

### Hook `src/hooks/useOnboarding.tsx`
- Estado del stepper (paso actual, datos de cada paso)
- Logica de importacion de vCard
- Logica de vinculacion automatica
- CRUD de sugerencias

---

## Fase 3: Integracion con el sistema existente

### Parser de vCard (nuevo)
Funcion en `src/lib/vcard-parser.ts`:
- Parsear formato vCard 3.0/4.0 (.vcf)
- Extraer: FN, N, TEL, EMAIL, ORG, TITLE, ADR, NOTE, PHOTO (base64 → ignorar), BDAY
- Multiples contactos por archivo (separados por BEGIN:VCARD / END:VCARD)
- Devolver array de ParsedContact compatible con el tipo existente

### Deteccion automatica de onboarding
En `SmartRedirect` (App.tsx): si el usuario esta autenticado y `onboarding_completed === false`, redirigir a `/onboarding` en vez de `/dashboard`.

### Ruta y navegacion
- Ruta `/onboarding` en App.tsx (protegida, sin AppLayout — pantalla completa)
- Item "Setup Inicial" en Settings para re-lanzar el wizard
- Badge de vinculaciones pendientes en dashboard (consulta `contact_link_suggestions` con status 'pending')

### Vinculacion automatica por telefono
Cuando se importan chats de WhatsApp, si el nombre del chat NO coincide pero hay un contacto con el mismo numero de telefono en `people_contacts.phone_numbers`, vincular automaticamente y crear alias.

---

## Archivos

### Nuevos
| Archivo | Descripcion |
|---------|-------------|
| `src/pages/Onboarding.tsx` | Wizard de 4 pasos |
| `src/hooks/useOnboarding.tsx` | Logica del wizard y vinculacion |
| `src/lib/vcard-parser.ts` | Parser de archivos .vcf |

### Modificados
| Archivo | Cambio |
|---------|--------|
| `src/App.tsx` | Ruta `/onboarding`, redireccion condicional |
| `src/hooks/useUserSettings.tsx` | Campo `onboarding_completed` |
| `src/pages/Settings.tsx` | Boton "Relanzar wizard" |
| `src/pages/Dashboard.tsx` | Badge vinculaciones pendientes |
| `src/integrations/supabase/types.ts` | Auto-actualizado |

### Migracion SQL (1 migracion)
- CREATE TABLE contact_aliases + RLS
- CREATE TABLE contact_link_suggestions + RLS
- CREATE TABLE contact_relationships + RLS
- ALTER TABLE user_settings ADD COLUMN onboarding_completed
- ALTER TABLE people_contacts ADD COLUMN vcard_raw

---

## Fuera de alcance (fases futuras)

- Fase 4 del spec: deteccion de segundo nivel (menciones cruzadas en conversaciones) — requiere edge function con IA
- Fase 5 del spec: vinculacion continua post-wizard — se implementara como edge function
- Fase 6: badge de "X vinculaciones pendientes" en dashboard — trivial, se anade despues
- Reset completo de datos — se anade como boton en Settings despues

