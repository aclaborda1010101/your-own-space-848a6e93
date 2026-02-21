
-- Table 1: prediction_log
CREATE TABLE public.prediction_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  prediction_date TIMESTAMPTZ NOT NULL,
  target_medication TEXT NOT NULL,
  target_pharmacy TEXT,
  predicted_outcome TEXT NOT NULL,
  predicted_confidence NUMERIC(3,2),
  actual_outcome TEXT,
  was_correct BOOLEAN,
  error_analysis TEXT,
  missing_signal TEXT,
  lesson_learned TEXT,
  model_version INT,
  regime_flag TEXT DEFAULT 'normal' CHECK (regime_flag IN ('normal', 'demand_shock', 'supply_shock', 'regulatory_change', 'unknown_anomaly')),
  signals_used JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_prediction_log_run ON public.prediction_log(run_id);
CREATE INDEX idx_prediction_log_correct ON public.prediction_log(was_correct);
CREATE INDEX idx_prediction_log_regime ON public.prediction_log(regime_flag);

ALTER TABLE public.prediction_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own predictions" ON public.prediction_log
  FOR ALL USING (auth.uid() = user_id);

-- Table 2: pattern_discovery_log
CREATE TABLE public.pattern_discovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  discovery_mode TEXT NOT NULL CHECK (discovery_mode IN ('theoretical', 'data_driven', 'error_analysis')),
  pattern_description TEXT NOT NULL,
  variables_involved JSONB DEFAULT '[]',
  correlation_strength NUMERIC(4,3),
  p_value NUMERIC(6,5),
  validated BOOLEAN DEFAULT FALSE,
  validation_result TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_pattern_discovery_run ON public.pattern_discovery_log(run_id);
CREATE INDEX idx_pattern_discovery_mode ON public.pattern_discovery_log(discovery_mode);

ALTER TABLE public.pattern_discovery_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own discoveries" ON public.pattern_discovery_log
  FOR ALL USING (auth.uid() = user_id);

-- Table 3: signal_credibility_matrix
CREATE TABLE public.signal_credibility_matrix (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  signal_id UUID REFERENCES public.signal_registry(id) ON DELETE CASCADE,
  pattern_id UUID REFERENCES public.pattern_discovery_log(id) ON DELETE SET NULL,
  run_id UUID NOT NULL REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  temporal_stability_score NUMERIC(4,3),
  cross_replication_score NUMERIC(4,3),
  anticipation_days INT,
  signal_to_noise_ratio NUMERIC(5,2),
  final_credibility_score NUMERIC(4,3) NOT NULL,
  signal_class TEXT NOT NULL CHECK (signal_class IN ('Alpha', 'Beta', 'Fragile', 'Noise')),
  regime_flag TEXT DEFAULT 'normal' CHECK (regime_flag IN ('normal', 'demand_shock', 'supply_shock', 'regulatory_change', 'unknown_anomaly')),
  weights_version INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_credibility_signal ON public.signal_credibility_matrix(signal_id);
CREATE INDEX idx_credibility_run ON public.signal_credibility_matrix(run_id);
CREATE INDEX idx_credibility_class ON public.signal_credibility_matrix(signal_class);

ALTER TABLE public.signal_credibility_matrix ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own credibility" ON public.signal_credibility_matrix
  FOR ALL USING (auth.uid() = user_id);
