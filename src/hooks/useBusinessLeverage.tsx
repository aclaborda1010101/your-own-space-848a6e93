import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface QuestionItem {
  id: string;
  question: string;
  type: "single_choice" | "multi_choice" | "open" | "yes_no" | "scale_1_10";
  options: string[] | null;
  internal_reason: string;
  priority: string;
  area: string;
}

export interface Diagnostic {
  id: string;
  project_id: string;
  digital_maturity_score: number;
  automation_level: number;
  data_readiness: number;
  ai_opportunity_score: number;
  manual_processes: string[];
  time_leaks: string[];
  person_dependencies: string[];
  bottlenecks: string[];
  quick_wins: string[];
  underused_tools: string[];
  data_gaps: { gap: string; impact: string; unlocks: string }[];
}

export interface Recommendation {
  id: string;
  layer: number;
  title: string;
  description: string;
  time_saved_hours_week_min: number;
  time_saved_hours_week_max: number;
  productivity_uplift_pct_min: number;
  productivity_uplift_pct_max: number;
  revenue_impact_month_min: number;
  revenue_impact_month_max: number;
  investment_month_min: number;
  investment_month_max: number;
  difficulty: string;
  difficulty_score: number;
  implementation_time: string;
  confidence_display: string;
  confidence_score_internal: number;
  estimation_source: string;
  priority_score: number;
  implementable_under_14_days: boolean;
}

export interface Roadmap {
  id: string;
  version: number;
  executive_summary: string;
  quick_wins_plan: any[];
  plan_90_days: any[];
  plan_12_months: any[];
  economic_impact: any;
  implementation_model: string;
  pricing_recommendation: any;
  full_document_md: string;
}

export function useBusinessLeverage(projectId: string) {
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questionnaire, setQuestionnaire] = useState<QuestionItem[] | null>(null);
  const [responseId, setResponseId] = useState<string | null>(null);
  const [responses, setResponses] = useState<Record<string, any>>({});
  const [diagnostic, setDiagnostic] = useState<Diagnostic | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);

  const callEdge = useCallback(async (action: string, params: any = {}) => {
    const { data, error } = await supabase.functions.invoke("ai-business-leverage", {
      body: { action, project_id: projectId, ...params },
    });
    if (error) throw error;
    return data;
  }, [projectId]);

  // Load existing data
  const loadExisting = useCallback(async () => {
    const [diagRes, recsRes, roadmapRes, qRes] = await Promise.all([
      supabase.from("bl_diagnostics").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
      supabase.from("bl_recommendations").select("*").eq("project_id", projectId).order("priority_score", { ascending: false }),
      supabase.from("bl_roadmaps").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
      supabase.from("bl_questionnaire_responses").select("*").eq("project_id", projectId).order("created_at", { ascending: false }).limit(1),
    ]);

    if (diagRes.data?.[0]) setDiagnostic(diagRes.data[0] as any);
    if (recsRes.data?.length) setRecommendations(recsRes.data as any);
    if (roadmapRes.data?.[0]) setRoadmap(roadmapRes.data[0] as any);
    if (qRes.data?.[0]) {
      setResponseId(qRes.data[0].id);
      const rawResponses = (qRes.data[0].responses as any) || {};
      // Extract _questions fallback and set clean responses
      const { _questions, ...cleanResponses } = rawResponses;
      setResponses(cleanResponses);
      
      // Load template questions from template or fallback to _questions in responses
      if (qRes.data[0].template_id) {
        const { data: tmpl } = await supabase.from("bl_questionnaire_templates").select("questions").eq("id", qRes.data[0].template_id).single();
        if (tmpl) setQuestionnaire((tmpl.questions as any) || []);
      } else if (_questions && Array.isArray(_questions) && _questions.length > 0) {
        setQuestionnaire(_questions);
      }
    }
  }, [projectId]);

  const generateQuestionnaire = useCallback(async (sector: string, businessSize: string, businessType?: string) => {
    setLoading(true);
    try {
      const data = await callEdge("generate_questionnaire", { sector, business_size: businessSize, business_type: businessType });
      setQuestionnaire(data.questionnaire?.questionnaire || []);
      setResponseId(data.response_id);
      setResponses({});
      toast.success("Cuestionario generado");
    } catch (e: any) {
      toast.error("Error generando cuestionario: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [callEdge]);

  const saveResponses = useCallback(async (newResponses: Record<string, any>) => {
    setResponses(newResponses);
    if (responseId) {
      await supabase.from("bl_questionnaire_responses").update({ responses: newResponses }).eq("id", responseId);
    }
  }, [responseId]);

  const analyzeResponses = useCallback(async () => {
    if (!responseId) { toast.error("No hay cuestionario completado"); return; }
    setLoading(true);
    try {
      const data = await callEdge("analyze_responses", { response_id: responseId });
      setDiagnostic(data.diagnostic ? { ...data.diagnostic.scores, ...data.diagnostic.critical_findings, data_gaps: data.diagnostic.data_gaps, id: data.id, project_id: projectId } as any : null);
      await loadExisting(); // reload clean data
      toast.success("Radiografía generada");
    } catch (e: any) {
      toast.error("Error analizando: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [callEdge, responseId, loadExisting, projectId]);

  const generateRecommendations = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callEdge("generate_recommendations");
      setRecommendations(data.recommendations || []);
      toast.success(`${data.count} recomendaciones generadas`);
    } catch (e: any) {
      toast.error("Error generando recomendaciones: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [callEdge]);

  const generateRoadmap = useCallback(async () => {
    setLoading(true);
    try {
      const data = await callEdge("generate_roadmap");
      setRoadmap(data.roadmap);
      toast.success("Roadmap generado");
    } catch (e: any) {
      toast.error("Error generando roadmap: " + e.message);
    } finally {
      setLoading(false);
    }
  }, [callEdge]);

  return {
    loading,
    questionnaire,
    responseId,
    responses,
    diagnostic,
    recommendations,
    roadmap,
    loadExisting,
    generateQuestionnaire,
    saveResponses,
    analyzeResponses,
    generateRecommendations,
    generateRoadmap,
  };
}
