
-- Table: economic_backtests
CREATE TABLE public.economic_backtests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backtest_id UUID NOT NULL REFERENCES public.model_backtests(id) ON DELETE CASCADE,
  run_id UUID NOT NULL REFERENCES public.pattern_detector_runs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  period_start TIMESTAMPTZ,
  period_end TIMESTAMPTZ,
  gross_revenue_protected NUMERIC(12,2) DEFAULT 0,
  capital_tied_up_cost NUMERIC(12,2) DEFAULT 0,
  unprevented_losses NUMERIC(12,2) DEFAULT 0,
  net_economic_impact NUMERIC(12,2) DEFAULT 0,
  roi_multiplier NUMERIC(6,2) DEFAULT 0,
  payback_period_days INT DEFAULT 0,
  loyalty_bonus_included BOOLEAN DEFAULT FALSE,
  reputational_damage_included BOOLEAN DEFAULT FALSE,
  margin_used_pct NUMERIC(5,2) DEFAULT 30.0,
  cost_of_capital_pct NUMERIC(5,2) DEFAULT 5.0,
  per_pharmacy_impact NUMERIC(10,2) DEFAULT 0,
  total_pharmacies INT DEFAULT 3800,
  calculation_method TEXT DEFAULT 'ai_estimation' CHECK (calculation_method IN ('ai_estimation', 'code_execution')),
  assumptions JSONB DEFAULT '{}',
  event_breakdown JSONB DEFAULT '[]',
  error_intelligence JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_economic_bt_run ON public.economic_backtests(run_id);
CREATE INDEX idx_economic_bt_backtest ON public.economic_backtests(backtest_id);
CREATE INDEX idx_economic_bt_user ON public.economic_backtests(user_id);

ALTER TABLE public.economic_backtests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own economic backtests"
  ON public.economic_backtests FOR ALL
  USING (auth.uid() = user_id);
