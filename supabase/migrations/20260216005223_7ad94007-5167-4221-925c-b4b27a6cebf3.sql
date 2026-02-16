-- Limpiar cuentas de email duplicadas

-- Eliminar aclaborda@outlook.com registrado erróneamente como iCloud
DELETE FROM email_accounts WHERE id = 'c5461994-1bce-43d1-ab8d-35adfbfbc1be';

-- Eliminar duplicado de Outlook (mantener 3dd25e8b que tiene credenciales)
DELETE FROM email_accounts WHERE id = '6f45b7a1-7ad2-4379-a29b-0f7bf297fe43';

-- Eliminar duplicado IMAP de hustleovertalks (mantener registro Gmail bd1bc32b)
DELETE FROM email_accounts WHERE id = '023fdf36-60bb-48d1-8104-c4f488449fab';