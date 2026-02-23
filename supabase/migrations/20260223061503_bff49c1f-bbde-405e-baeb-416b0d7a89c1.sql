
-- Bloque 2: Add contact_id to tasks table for Bio-to-Tasks bridge
ALTER TABLE public.tasks 
ADD COLUMN contact_id UUID REFERENCES public.people_contacts(id) ON DELETE SET NULL;

-- Index for efficient lookup by user + contact
CREATE INDEX idx_tasks_user_contact ON public.tasks (user_id, contact_id) WHERE contact_id IS NOT NULL;
