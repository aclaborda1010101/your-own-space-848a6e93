CREATE TABLE public.whatsapp_instance_owners (
  instance_name TEXT PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  connected_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.whatsapp_instance_owners ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own instance"
  ON public.whatsapp_instance_owners FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own instance"
  ON public.whatsapp_instance_owners FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own instance"
  ON public.whatsapp_instance_owners FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete their own instance"
  ON public.whatsapp_instance_owners FOR DELETE TO authenticated
  USING (user_id = auth.uid());