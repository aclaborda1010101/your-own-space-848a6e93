-- Limpiar contact_headlines contaminadas tras la fusión incorrecta Dani→Adolfo.
-- Se regenerarán automáticamente al abrir cada ficha.
DELETE FROM public.contact_headlines
WHERE contact_id IN (
  '0fcf785d-fc27-4e1c-b94d-fcaf8e8cbc9a', -- Adolfo Alvaro Benito
  '0c157af8-a512-4a82-b533-688d13f20f99'  -- Daniel de Carvajal
);