CREATE EXTENSION IF NOT EXISTS unaccent;

CREATE TABLE IF NOT EXISTS public._tmp_mac_import (
  id bigserial PRIMARY KEY,
  name text NOT NULL,
  name_norm text NOT NULL,
  phones text[] NOT NULL,
  desired_wa text NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_tmp_mac_name_norm ON public._tmp_mac_import(name_norm);

ALTER TABLE public._tmp_mac_import ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tmp_mac_no_access" ON public._tmp_mac_import;
CREATE POLICY "tmp_mac_no_access" ON public._tmp_mac_import FOR ALL USING (false) WITH CHECK (false);