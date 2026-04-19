
UPDATE public.openclaw_nodes
SET role = 'coordinador',
    ip = '192.168.1.74',
    model = 'claude-opus-4-7',
    host = '192.168.1.74',
    description = COALESCE(description, 'Bridge ejecutivo (Telegram MoltBot, decisiones rápidas).')
WHERE name = 'POTUS';

UPDATE public.openclaw_nodes
SET role = 'ejecucion',
    ip = '192.168.1.72',
    model = 'claude-opus-4-7',
    host = '192.168.1.72',
    description = COALESCE(description, 'Nodo principal de cómputo (Mac Mini M4 Pro).')
WHERE name = 'TITAN';
