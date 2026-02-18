

# Deshacer "Soy yo" en Angel Baena

## Problema
Se marco accidentalmente a "Angel Baena" como tu identidad. Esto guardo `{"whatsapp_names": ["Angel Baena"]}` en el campo `my_identifiers` de tu perfil (`user_profile`). Esto hara que en futuras importaciones, los mensajes de Angel Baena se consideren tuyos y no se cree como contacto.

## Solucion
Un solo cambio en base de datos:

- Actualizar `user_profile.my_identifiers` para quitar "Angel Baena" de `whatsapp_names`, dejando el array vacio `{"whatsapp_names": []}`.

No se necesitan cambios de codigo.

## Detalle tecnico
- Ejecutar migration SQL: `UPDATE user_profile SET my_identifiers = '{"whatsapp_names": []}'::jsonb;`
- Esto limpia el identificador erroneo sin afectar nada mas.

