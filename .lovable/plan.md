

# Plan: Página de Política de Privacidad (oculta)

## Objetivo
Crear una página pública de política de privacidad en `/privacy-policy` para cumplir requisitos de Facebook/WhatsApp App Review. La página no aparecerá en navegación ni menús.

## Cambios

### 1. Crear `src/pages/PrivacyPolicy.tsx`
- Página pública con política de privacidad estándar para integración WhatsApp/Facebook
- Contenido en español, formato profesional con secciones: datos recopilados, uso, almacenamiento, derechos del usuario, contacto
- Sin AppLayout ni autenticación requerida
- Branding "JARVIS" como nombre de la app

### 2. Modificar `src/App.tsx`
- Añadir ruta pública `/privacy-policy` (sin `ProtectedRoute`, sin `AppLayout`)
- Lazy import del componente

## URL resultante
`https://pure-logic-flow.lovable.app/privacy-policy`

No se añade a sidebar, bottom nav ni ningún menú visible.

