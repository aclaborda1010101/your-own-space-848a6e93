

# Fix: Asignar cuentas Gmail al usuario correcto

## Problema

Las dos cuentas Gmail estan asociadas al user_id `ef287d8b-7f59-4782-8a5b-54e562e9a149`, pero tu usuario actual es `f103da90-81d4-43a2-ad34-b33db8b9c369`. Por eso no aparecen en la seccion de Ajustes > Cuentas de correo.

Esto probablemente paso porque las cuentas se crearon con una sesion de login anterior o un usuario diferente.

## Solucion

Ejecutar una migracion SQL para actualizar el `user_id` de las dos cuentas Gmail al usuario correcto:

```text
UPDATE email_accounts 
SET user_id = 'f103da90-81d4-43a2-ad34-b33db8b9c369'
WHERE id IN (
  '965ad8f7-6131-4960-a54d-dd20901738c4',  -- agustin.cifuentes@agustitogrupo.com
  'bd1bc32b-7b90-4323-9f9f-0ac168c55564'   -- agustin@hustleovertalks.com
);
```

## Resultado esperado

Tras la migracion, las 3 cuentas apareceran en Ajustes > Cuentas de correo:

- agustin.cifuentes@agustitogrupo.com (Gmail) - boton "Conectar" visible
- agustin@hustleovertalks.com (Gmail) - boton "Conectar" visible  
- aclaborda@outlook.com (Outlook) - ya visible

Despues podras hacer click en "Conectar" en cada cuenta Gmail para completar la autorizacion OAuth con Google.

