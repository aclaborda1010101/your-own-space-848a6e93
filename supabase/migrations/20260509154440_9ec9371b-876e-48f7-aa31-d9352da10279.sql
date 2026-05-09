-- Kill switch para pausar operaciones de IA caras o desbocadas
CREATE TABLE IF NOT EXISTS public.ai_kill_switch (
  operation text NOT NULL PRIMARY KEY,
  paused boolean NOT NULL DEFAULT false,
  max_per_hour integer,
  notes text,
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_kill_switch ENABLE ROW LEVEL SECURITY;

-- Cualquier usuario autenticado puede leer (necesario para que el cliente lo consulte)
CREATE POLICY "ai_kill_switch readable by authenticated"
ON public.ai_kill_switch FOR SELECT TO authenticated USING (true);

-- Solo service_role puede escribir (la UI usará una edge function admin-only)
CREATE POLICY "ai_kill_switch writable by service_role only"
ON public.ai_kill_switch FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Fila por defecto: '*' = pausa global
INSERT INTO public.ai_kill_switch (operation, paused, notes)
VALUES ('*', false, 'Interruptor global de emergencia para todas las llamadas IA')
ON CONFLICT (operation) DO NOTHING;

-- Índice para lookups rápidos en cada llamada
CREATE INDEX IF NOT EXISTS idx_ai_kill_switch_paused ON public.ai_kill_switch(paused) WHERE paused = true;