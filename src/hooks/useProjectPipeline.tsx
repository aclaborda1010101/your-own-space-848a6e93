import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export interface PipelineStep {
  id: string;
  pipeline_id: string | null;
  step_number: number;
  model_name: string;
  role_description: string | null;
  input_content: string | null;
  output_content: string | null;
  status: string | null;
  tokens_used: number | null;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface Pipeline {
  id: string;
  project_id: string | null;
  user_id: string;
  idea_description: string;
  status: string | null;
  current_step: number | null;
  final_document: string | null;
  lovable_prompt: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const STEP_MODELS = [
  { step: 1, model: "anthropic/claude-sonnet-4-20250514", role: "Arquitecto Estratégico" },
  { step: 2, model: "openai/gpt-5.2-mini", role: "Crítico Destructivo" },
  { step: 3, model: "google/gemini-2.0-flash", role: "Visionario Innovador" },
  { step: 4, model: "anthropic/claude-sonnet-4-20250514", role: "Consolidador Final" },
];

export function useProjectPipeline() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activePipeline, setActivePipeline] = useState<Pipeline | null>(null);
  const [steps, setSteps] = useState<PipelineStep[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string | null>(null);

  // Load pipeline + steps
  const loadPipeline = useCallback(async (pipelineId: string) => {
    const [pipelineRes, stepsRes] = await Promise.all([
      supabase.from("project_pipelines").select("*").eq("id", pipelineId).single(),
      supabase.from("pipeline_steps").select("*").eq("pipeline_id", pipelineId).order("step_number"),
    ]);
    if (pipelineRes.data) setActivePipeline(pipelineRes.data as Pipeline);
    if (stepsRes.data) setSteps(stepsRes.data as PipelineStep[]);
  }, []);

  // Subscribe to realtime updates
  useEffect(() => {
    if (!selectedPipelineId) return;

    const channel = supabase
      .channel(`pipeline-${selectedPipelineId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "pipeline_steps", filter: `pipeline_id=eq.${selectedPipelineId}` },
        (payload) => {
          setSteps(prev => prev.map(s => s.id === payload.new.id ? { ...s, ...payload.new } as PipelineStep : s));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "project_pipelines", filter: `id=eq.${selectedPipelineId}` },
        (payload) => {
          setActivePipeline(prev => prev ? { ...prev, ...payload.new } as Pipeline : null);
          if (payload.new.status === "completed" || payload.new.status === "error") {
            setIsRunning(false);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedPipelineId]);

  // Create pipeline + 4 steps + start step 1
  const startPipeline = useCallback(async (ideaDescription: string) => {
    if (!user) return;
    setIsRunning(true);

    try {
      // Create pipeline
      const { data: pipeline, error: pipelineError } = await supabase
        .from("project_pipelines")
        .insert({ user_id: user.id, idea_description: ideaDescription })
        .select()
        .single();

      if (pipelineError || !pipeline) throw pipelineError || new Error("Failed to create pipeline");

      // Create 4 steps
      const stepsToInsert = STEP_MODELS.map(s => ({
        pipeline_id: pipeline.id,
        step_number: s.step,
        model_name: s.model,
        role_description: s.role,
        status: "pending",
      }));

      const { data: createdSteps, error: stepsError } = await supabase
        .from("pipeline_steps")
        .insert(stepsToInsert)
        .select();

      if (stepsError) throw stepsError;

      setActivePipeline(pipeline as Pipeline);
      setSteps((createdSteps || []) as PipelineStep[]);
      setSelectedPipelineId(pipeline.id);

      // Invalidate projects query so kanban updates
      queryClient.invalidateQueries({ queryKey: ["ideas-projects"] });

      toast.success("Pipeline iniciado - Paso 1: Arquitecto Estratégico");

      // Fire step 1
      await runStep(pipeline.id, 1);
    } catch (err) {
      console.error("Pipeline creation error:", err);
      toast.error("Error al iniciar el pipeline");
      setIsRunning(false);
    }
  }, [user, queryClient]);

  const runStep = useCallback(async (pipelineId: string, stepNumber: number) => {
    setIsRunning(true);
    try {
      // Reset pipeline status if it was in error
      await supabase.from("project_pipelines").update({ status: "in_progress", error_message: null }).eq("id", pipelineId);
      setActivePipeline(prev => prev ? { ...prev, status: "in_progress", error_message: null } : null);

      const res = await supabase.functions.invoke("project-pipeline-step", {
        body: { pipelineId, stepNumber },
      });

      if (res.error) {
        toast.error(`Error en paso ${stepNumber}: ${res.error.message}`);
        await loadPipeline(pipelineId);
        setIsRunning(false);
        return;
      }

      // Reload data
      await loadPipeline(pipelineId);

      if (stepNumber === 4) {
        toast.success("🎉 Pipeline completado - Documento final generado");
      } else {
        const nextRole = STEP_MODELS[stepNumber]?.role || "";
        toast.success(`Paso ${stepNumber} completado. Siguiente: ${nextRole}`);
      }
      setIsRunning(false);
    } catch (err) {
      console.error("Step error:", err);
      toast.error(`Error ejecutando paso ${stepNumber}`);
      await loadPipeline(pipelineId);
      setIsRunning(false);
    }
  }, [loadPipeline]);

  const retryStep = useCallback(async (stepNumber: number) => {
    if (!activePipeline) return;
    await runStep(activePipeline.id, stepNumber);
  }, [activePipeline, runStep]);

  const skipToStep = useCallback(async (stepNumber: number) => {
    if (!activePipeline) return;
    // Mark the failed step as skipped and move on
    const failedStep = steps.find(s => s.step_number === stepNumber - 1 && s.status === "error");
    if (failedStep) {
      await supabase.from("pipeline_steps").update({ status: "skipped", error_message: "Saltado por el usuario" }).eq("id", failedStep.id);
    }
    await supabase.from("project_pipelines").update({ current_step: stepNumber - 1, status: "in_progress", error_message: null }).eq("id", activePipeline.id);
    await runStep(activePipeline.id, stepNumber);
  }, [activePipeline, steps, runStep]);

  const continueToNextStep = useCallback(async () => {
    if (!activePipeline) return;
    const nextStep = (activePipeline.current_step || 0) + 1;
    if (nextStep > 4) return;
    await runStep(activePipeline.id, nextStep);
  }, [activePipeline, runStep]);

  const pausePipeline = useCallback(async () => {
    if (!activePipeline) return;
    await supabase.from("project_pipelines").update({ status: "paused" }).eq("id", activePipeline.id);
    setActivePipeline(prev => prev ? { ...prev, status: "paused" } : null);
    setIsRunning(false);
    toast.info("Pipeline pausado");
  }, [activePipeline]);

  const updateStepOutput = useCallback(async (stepId: string, newOutput: string) => {
    await supabase.from("pipeline_steps").update({ output_content: newOutput }).eq("id", stepId);
    setSteps(prev => prev.map(s => s.id === stepId ? { ...s, output_content: newOutput } : s));
    toast.success("Resultado actualizado");
  }, []);

  const selectPipeline = useCallback(async (pipelineId: string) => {
    setSelectedPipelineId(pipelineId);
    await loadPipeline(pipelineId);
  }, [loadPipeline]);

  const closePipeline = useCallback(() => {
    setSelectedPipelineId(null);
    setActivePipeline(null);
    setSteps([]);
  }, []);

  const [isGeneratingPrompt, setIsGeneratingPrompt] = useState(false);

  const generateLovablePrompt = useCallback(async () => {
    if (!activePipeline) return;
    setIsGeneratingPrompt(true);
    try {
      const res = await supabase.functions.invoke("project-generate-lovable-prompt", {
        body: { pipelineId: activePipeline.id },
      });
      if (res.error) {
        toast.error("Error generando prompt: " + res.error.message);
        return;
      }
      const prompt = res.data?.prompt || "";
      setActivePipeline(prev => prev ? { ...prev, lovable_prompt: prompt } : null);
      toast.success("Prompt Lovable generado");
    } catch (err) {
      console.error("Generate prompt error:", err);
      toast.error("Error generando prompt Lovable");
    } finally {
      setIsGeneratingPrompt(false);
    }
  }, [activePipeline]);

  return {
    activePipeline,
    steps,
    isRunning,
    isGeneratingPrompt,
    selectedPipelineId,
    startPipeline,
    continueToNextStep,
    retryStep,
    skipToStep,
    pausePipeline,
    updateStepOutput,
    selectPipeline,
    closePipeline,
    generateLovablePrompt,
    STEP_MODELS,
  };
}
