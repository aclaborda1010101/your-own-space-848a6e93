ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS network_size integer;
ALTER TABLE bl_diagnostics ADD COLUMN IF NOT EXISTS network_label text;