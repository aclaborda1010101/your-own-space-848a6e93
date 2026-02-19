UPDATE email_accounts 
SET is_active = false, 
    sync_error = 'Azure tenant bloqueado - OAuth no disponible'
WHERE email_address = 'aclaborda@outlook.com';