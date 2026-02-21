

# Senales No Convencionales + Metricas Compuestas + Correccion Sector Centros Comerciales

## Resumen

Este cambio enriquece el pipeline de deteccion de patrones con un catalogo de fuentes no convencionales clasificadas por accesibilidad (Tier A/B/C), metricas compuestas de Capa 4-5, y correccion final de los bugs pendientes de sector/freshness/idioma.

**Estado actual del codigo**: La parametrizacion por sector (mapa `SECTOR_ECONOMIC_PARAMS`, funcion `detectSectorParams`, UI dinamica con `unit_name`) YA esta implementada. La frescura YA incluye "annual/quarterly/biannual" en el calculo. Los prompts YA piden respuestas en espanol. Lo que falta es el catalogo de fuentes no convencionales, las metricas compuestas y algunos ajustes menores.

---

## Archivos a modificar

| Archivo | Cambio |
|---------|--------|
| `supabase/functions/pattern-detector-pipeline/index.ts` | 1) Catalogo `SECTOR_UNCONVENTIONAL_SOURCES`. 2) Phase 2: inyectar fuentes por sector con tier. 3) Phase 5: instrucciones para metricas compuestas Capa 4-5. 4) Freshness: incluir mas variantes de frecuencia (continuous, varies, real-time). |
| `src/components/projects/PatternDetector.tsx` | Badge de Tier (A/B/C) en tab Fuentes segun campo `status` |

---

## BLOQUE 1 -- Catalogo de fuentes no convencionales (edge function)

Crear un mapa constante `SECTOR_UNCONVENTIONAL_SOURCES` en el edge function, junto a `SECTOR_ECONOMIC_PARAMS`. Para centros comerciales:

**Tier A** (8 fuentes, status = "available"):
- Google Trends API (busquedas por zona, ratio busquedas/oferta)
- OpenStreetMap (densidad POIs por categoria, zonas verdes, red peatonal, comercios nocturnos)
- Catastro (uso parcelas, permisos construccion, superficie por tipo, antiguedad parque)
- AEMET (temperatura media pico verano, dias lluvia, calidad aire)
- CNMC (cobertura fibra optica)
- Ministerio Educacion (matricula escolar por municipio)
- INE (variacion precios vivienda)
- Datos abiertos ayuntamientos (licencias construccion, actividad economica, aforos trafico)

**Tier B** (5 fuentes, status = "pending"):
- Inside Airbnb (listings y crecimiento)
- LinkedIn Jobs API (ofertas empleo)
- Google Maps Popular Times (trafico peatonal)
- APIs delivery Glovo/Uber Eats (tiempo respuesta)
- Movilidad bicicletas/patinetes publicos

**Tier C** (3 fuentes, status = "requires_agreement"):
- Operadores telefonia (movilidad real, dwell time)
- SafeGraph/equivalente europeo (foot traffic)
- Nielsen (datos consumo)

Cada fuente incluye: nombre, tipo, frecuencia, hipotesis que soporta, impacto estimado, coste integracion.

---

## BLOQUE 2 -- Phase 2 enriquecida con fuentes sectoriales

Modificar `executePhase2` para:
1. Llamar a `detectSectorParams(sector)` para saber si hay fuentes no convencionales para este sector
2. Si existen, inyectar el catalogo completo en el prompt como contexto adicional
3. Instruir a la IA a incluir estas fuentes en su respuesta, con el tier y la hipotesis
4. Al insertar en `data_sources_registry`, usar el tier como `status`: "available" (A), "pending" (B), "requires_agreement" (C)

---

## BLOQUE 3 -- Phase 5 con metricas compuestas

Modificar `executePhase5` para:
1. Detectar sector con regex
2. Si es centros comerciales, anadir al prompt instrucciones para generar senales de Capa 4-5 con estas metricas compuestas:

Capa 3 (Senales debiles):
- Crecimiento matricula escolar como predictor de demanda familiar
- Momentum inmobiliario como indicador de zona "hot"
- Crecimiento listings Airbnb como proxy de gentrificacion

Capa 4 (Inteligencia lateral):
- Tiempo de respuesta delivery como proxy de saturacion comercial
- Ratio busquedas/visitas Google Maps como demanda insatisfecha
- Densidad coworkings como indicador teletrabajo
- Ratio gimnasios premium vs low-cost como proxy poder adquisitivo
- Trafico "horas muertas" como indicador base residencial

Capa 5 (Edge extremo):
- "Latent Demand Score" = (Busquedas Google / Oferta comercial) x Crecimiento poblacion
- "Digital Natives Density" = Actividad digital geolocalizada / Poblacion 18-35
- "Future-Proof Index" = (Cobertura fibra x Permisos construccion x Ofertas empleo) / Competencia actual
- "Dead Hours Vitality Index" = Trafico horas muertas / Trafico pico sabado
- "Climate Refuge Score" = (Dias >32C + Dias lluvia + Dias AQI>150) / 365

Las metricas pasan automaticamente por el Credibility Engine existente (no requiere cambios).

---

## BLOQUE 4 -- Freshness fix adicional

Ampliar la lista de frecuencias validas en Phase 3 para incluir:
- "continuous", "real-time", "realtime", "varies", "irregular", "hourly"

Estas frecuencias son comunes en fuentes como OSM (continuous), AEMET (hourly), y datos abiertos (varies).

---

## BLOQUE 5 -- UI: Badge de tier en fuentes

En `PatternDetector.tsx`, tab "Fuentes", anadir un badge de color junto a cada fuente:
- status = "available" -> Badge verde "Disponible"
- status = "pending" -> Badge amarillo "Pendiente"
- status = "requires_agreement" -> Badge gris "Requiere acuerdo"
- otros status -> no mostrar badge extra

---

## Orden de implementacion

1. Edge function: catalogo de fuentes, Phase 2 enriquecida, Phase 5 con metricas compuestas, freshness fix
2. UI: badges de tier
3. Deploy

## Resultado esperado

- Phase 2 genera fuentes Tier A/B/C con hipotesis, impacto y coste de integracion
- Phase 5 genera senales de Capa 3-5 con metricas compuestas ("Latent Demand Score", "Future-Proof Index", etc.)
- Credibility Engine evalua automaticamente todas las metricas compuestas
- UI muestra tier de accesibilidad de cada fuente con badge de color
- Freshness calcula correctamente para frecuencias como "continuous", "varies", "hourly"

