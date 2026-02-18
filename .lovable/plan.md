

# Plan: Reconocimiento del usuario propio en importaciones

## Problema actual
Al importar un chat de WhatsApp, todos los participantes se tratan igual. No se distingue cual es "yo" (el usuario), por lo que no se puede:
- Filtrar los mensajes propios vs los del contacto
- Usar la informacion de los mensajes propios para enriquecer el perfil del usuario
- Evitar que el propio usuario aparezca como "contacto detectado"

## Solucion propuesta

### 1. Almacenar identidades del usuario en `user_profile`

Agregar un campo `my_identifiers` (JSONB) a la tabla `user_profile` que almacene los nombres/numeros con los que el usuario aparece en diferentes plataformas:

```text
my_identifiers: {
  whatsapp_names: ["Agustin", "Agus"],
  whatsapp_numbers: ["635871339"],
  plaud_speaker_labels: ["Speaker 1"]
}
```

Esto se configurara desde la pagina de Settings (una seccion "Mis identidades") y tambien se podra completar desde la propia pagina de importacion.

### 2. Modificar la logica de importacion de WhatsApp

En `DataImport.tsx`, al parsear el archivo:
- Comparar cada speaker detectado contra `my_identifiers.whatsapp_names` y `whatsapp_numbers`
- Los que coincidan se marcan como "Yo" y no se anaden a la lista de contactos detectados
- Los mensajes del usuario se separan para poder enriquecer su perfil

### 3. UI de configuracion de identidad

Antes de importar (o en Settings), el usuario podra:
- Indicar sus numeros de telefono y nombres de WhatsApp
- Marcar un speaker detectado como "Soy yo" directamente en la revision de resultados

### 4. Hidratacion del perfil propio

Los mensajes identificados como propios se pueden usar para:
- Actualizar `last_contact` del contacto vinculado
- Contar mensajes enviados vs recibidos
- En futuro: alimentar el perfil de comunicacion del usuario

---

## Cambios tecnicos

### Migracion SQL
- `ALTER TABLE user_profile ADD COLUMN my_identifiers JSONB DEFAULT '{}'`

### `src/hooks/useUserProfile.tsx`
- Agregar `my_identifiers` a las interfaces `UserProfile` y `UserProfileRow`
- Incluirlo en `DEFAULT_PROFILE` con valores iniciales

### `src/pages/DataImport.tsx`
- Cargar `my_identifiers` del perfil del usuario al montar
- En `handleWhatsAppImport`: filtrar speakers, marcar los que coincidan como "Yo"
- No mostrar los speakers "Yo" en la lista de contactos detectados
- Mostrar un resumen separado: "X mensajes tuyos, Y mensajes del contacto"
- Agregar opcion en la revision para marcar un speaker como "Soy yo" (y guardar su nombre en `my_identifiers`)

### `src/pages/Settings.tsx` (seccion Perfil)
- Agregar campo editable "Mis nombres en WhatsApp" y "Mis numeros" para que el usuario configure sus identidades

### Flujo de uso
```text
1. Usuario sube chat.txt
2. Se detectan speakers: ["Agustin", "Maria"]
3. "Agustin" coincide con my_identifiers -> se marca como "Yo"
4. Solo "Maria" aparece como contacto a confirmar
5. Resumen: "150 mensajes tuyos, 120 de Maria"
6. Si no hay coincidencia, se ofrece boton "Soy yo" junto a cada speaker
```

