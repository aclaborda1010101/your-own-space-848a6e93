import { useState, useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import type { TranslatedIntent } from "@/components/projects/PatternIntentReview";

export interface PatternRun {
  id: string;
  project_id: string | null;
  sector: string;
  geography: string | null;
  time_horizon: string | null;
  business_objective: string | null;
  baseline_definition: string | null;
  status: string;
  current_phase: number;
  phase_results: Record<string, any>;
  quality_gate: any;
  quality_gate_passed: boolean | null;
  dashboard_output: any;
  model_verdict: string;
  error_log: string | null;
  created_at: string;
}

export interface DataSource {
  id: string;
  source_name: string;
  url: string | null;
  source_type: string;
  reliability_score: number;
  data_type: string | null;
  update_frequency: string | null;
  coverage_period: string | null;
  status: string;
  created_at: string;
}

export interface Signal {
  id: string;
  layer_id: number;
  layer_name: string;
  signal_name: string;
  description: string | null;
  confidence: number;
  p_value: number | null;
  impact: string;
  trend: string;
  uncertainty_type: string;
  devil_advocate_result: string | null;
  contradicting_evidence: string | null;
  data_source: string | null;
}

export interface Backtest {
  id: string;
  baseline_rmse: number | null;
  naive_rmse: number | null;
  model_rmse: number | null;
  uplift_vs_naive_pct: number | null;
  uplift_vs_baseline_pct: number | null;
  complexity_justified: boolean | null;
  win_rate_pct: number | null;
  precision_pct: number | null;
  recall_pct: number | null;
  false_positives: number;
  false_negatives: number;
  avg_anticipation_days: number | null;
  cost_simulation: any;
  retrospective_cases: any;
}

export function usePatternDetector(projectId?: string) {
  const { user } = useAuth();
  const [runs, setRuns] = useState<PatternRun[]>([]);
  const [currentRun, setCurrentRun] = useState<PatternRun | null>(null);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [backtests, setBacktests] = useState<Backtest[]>([]);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Fetch runs for project
  const fetchRuns = useCallback(async () => {
    if (!user) return;
    const query = supabase
      .from("pattern_detector_runs" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (projectId) {
      query.eq("project_id", projectId);
    }

    const { data } = await query;
    setRuns((data as any[]) || []);
    if (data && data.length > 0) {
      setCurrentRun(data[0] as any);
    }
  }, [user, projectId]);

  // Fetch sources for current run
  const fetchSources = useCallback(async (runId: string) => {
    const { data } = await supabase
      .from("data_sources_registry" as any)
      .select("*")
      .eq("run_id", runId)
      .order("reliability_score", { ascending: false });
    setSources((data as any[]) || []);
  }, []);

  // Fetch signals for current run
  const fetchSignals = useCallback(async (runId: string) => {
    const { data } = await supabase
      .from("signal_registry" as any)
      .select("*")
      .eq("run_id", runId)
      .order("layer_id", { ascending: true });
    setSignals((data as any[]) || []);
  }, []);

  // Fetch backtests for current run
  const fetchBacktests = useCallback(async (runId: string) => {
    const { data } = await supabase
      .from("model_backtests" as any)
      .select("*")
      .eq("run_id", runId);
    setBacktests((data as any[]) || []);
  }, []);

  // Load all data for a run
  const loadRunData = useCallback(async (runId: string) => {
    await Promise.all([
      fetchSources(runId),
      fetchSignals(runId),
      fetchBacktests(runId),
    ]);
  }, [fetchSources, fetchSignals, fetchBacktests]);

  // Create a new run
  const createRun = useCallback(async (params: {
    sector: string;
    geography?: string;
    time_horizon?: string;
    business_objective?: string;
  }) => {
    if (!user) return null;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: {
          action: "create",
          project_id: projectId || null,
          user_id: user.id,
          ...params,
        },
      });

      if (error) throw error;
      const runId = data.run_id;
      toast.success("Análisis creado. Iniciando pipeline...");

      // Start run_all
      await supabase.functions.invoke("pattern-detector-pipeline", {
        body: { action: "run_all", run_id: runId },
      });

      // Start polling
      startPolling(runId);
      await fetchRuns();
      return runId;
    } catch (err) {
      console.error("createRun error:", err);
      toast.error("Error al crear el análisis");
      return null;
    } finally {
      setLoading(false);
    }
  }, [user, projectId, fetchRuns]);

  // Poll for run status
  const startPolling = useCallback((runId: string) => {
    setPolling(true);
    if (pollRef.current) clearInterval(pollRef.current);

    pollRef.current = setInterval(async () => {
      const { data } = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: { action: "status", run_id: runId },
      });

      if (data) {
        setCurrentRun(data as any);

        // Load data as phases complete
        if (data.current_phase >= 2) fetchSources(runId);
        if (data.current_phase >= 5) fetchSignals(runId);
        if (data.current_phase >= 6) fetchBacktests(runId);

        // Stop polling when done
        if (["completed", "failed", "blocked"].includes(data.status)) {
          if (pollRef.current) clearInterval(pollRef.current);
          pollRef.current = null;
          setPolling(false);
          
          if (data.status === "completed") {
            toast.success("Análisis completado");
            loadRunData(runId);
          } else if (data.status === "blocked") {
            toast.warning("Quality Gate no superado. Datos insuficientes.");
          } else {
            toast.error(`Análisis fallido: ${data.error_log || "Error desconocido"}`);
          }
        }
      }
    }, 5000);
  }, [fetchSources, fetchSignals, fetchBacktests, loadRunData]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  // Initial load
  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  // Load data when currentRun changes
  useEffect(() => {
    if (currentRun?.id) {
      loadRunData(currentRun.id);
      // Resume polling if run is in progress
      if (currentRun.status.startsWith("running_") || currentRun.status === "pending") {
        startPolling(currentRun.id);
      }
    }
  }, [currentRun?.id]);

  // Translate user intent to technical request
  const translateIntent = useCallback(async (params: {
    sector: string;
    geography?: string;
    time_horizon?: string;
    business_objective?: string;
  }): Promise<TranslatedIntent | null> => {
    try {
      const { data, error } = await supabase.functions.invoke("pattern-detector-pipeline", {
        body: { action: "translate_intent", project_id: projectId || null, ...params },
      });
      if (error) throw error;
      return data as TranslatedIntent;
    } catch (err) {
      console.error("translateIntent error:", err);
      toast.error("Error al traducir el objetivo");
      return null;
    }
  }, []);

  return {
    runs,
    currentRun,
    sources,
    signals,
    backtests,
    loading,
    polling,
    createRun,
    fetchRuns,
    setCurrentRun,
    translateIntent,
  };
}
