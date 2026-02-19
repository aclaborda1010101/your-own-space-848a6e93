

# Fix: Contactos duplicados en importacion de backup WhatsApp

## Problema raiz

Hay 1989 contactos pero solo 1174 nombres unicos (815 duplicados). "Carls Primo" aparece 33 veces, "Mi Nena" 18 veces, etc.

**Causa**: Al procesar grupos en `handleBackupImport`, cada speaker llama a `findOrCreateContact` que comprueba el array `existingContacts` del estado React. Pero `setExistingContacts` es asincrono: cuando se procesa el siguiente grupo con el mismo speaker, el estado NO se ha actualizado aun, y se crea otro contacto duplicado.

**Causa secundaria**: La carga inicial de contactos (linea 253) no tiene `.limit()`, asi que Supabase devuelve maximo 1000 filas.

## Solucion en 2 pasos

### Paso 1: Limpiar duplicados existentes (SQL)

Ejecutar una migracion que:
1. Para cada nombre duplicado, elige el contacto con mas mensajes como "ganador"
2. Reasigna todos los `contact_messages` de los duplicados al ganador
3. Suma los `wa_message_count` al ganador
4. Elimina los duplicados

### Paso 2: Corregir el codigo para evitar futuros duplicados

**Archivo: `src/pages/DataImport.tsx`**

1. **Usar un Map mutable en lugar de estado React** para rastrear contactos durante la importacion. Crear un `contactsMapRef = useRef(new Map())` que se actualice sincronamente al crear cada contacto. Asi, cuando el mismo speaker aparece en el grupo siguiente, ya esta en el Map.

2. **Aumentar el limite de carga inicial** de contactos: agregar `.limit(5000)` a la query de la linea 253.

3. **Actualizar `findOrCreateContact`** para que reciba y actualice el Map mutable en lugar de depender del estado React.

## Detalle tecnico

```text
ANTES:
  findOrCreateContact -> busca en existingContacts (estado React)
  setExistingContacts([...prev, nuevo]) -> React lo actualiza DESPUES
  Siguiente grupo, mismo speaker -> NO lo encuentra -> DUPLICADO

DESPUES:
  findOrCreateContact -> busca en contactsMap (ref mutable)
  contactsMap.set(nombre, {id, name}) -> actualizado AL INSTANTE
  Siguiente grupo, mismo speaker -> LO ENCUENTRA -> sin duplicado
```

## Archivos modificados

1. `supabase/migrations/xxx_deduplicate_contacts.sql` - Limpieza de duplicados existentes
2. `src/pages/DataImport.tsx` - Ref mutable + limite de carga + logica anti-duplicados

