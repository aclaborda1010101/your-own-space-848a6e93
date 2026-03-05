import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

export type StepStatus = "pending" | "in_progress" | "generating" | "review" | "approved" | "editing";

export interface WizardStep {
  stepNumber: number;
  stepName: string;
  status: StepStatus;
  outputData: any;
  inputData: any;
  version: number;
  approvedAt: string | null;
}

export interface WizardProject {
  id: string;
  name: string;
  company: string;
  contactId: string | null;
  clientNeed: string;
  inputType: string;
  inputContent: string;
  projectType: string;
  currentStep: number;
}

export interface ProjectCost {
  id: string;
  stepNumber: number;
  service: string;
  operation: string;
  tokensInput: number;
  tokensOutput: number;
  costUsd: number;
  createdAt: string;
}

const STEP_NAMES = [
  "Entrada del Proyecto",
  "Extracción Inteligente",
  "Borrador de Alcance",
  "Auditoría Cruzada",
  "Documento Final",
  "Auditoría IA",
  "PRD Técnico",
  "Blueprint de Patrones",
  "RAG Dirigido",
  "Ejecución de Patrones",
];

export const useProjectWizard = (projectId?: string) => {
  const { user } = useAuth();
  const [project, setProject] = useState<WizardProject | null>(null);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [dataProfile, setDataProfile] = useState<any>(null);
  const [dataPhaseComplete, setDataPhaseComplete] = useState(false);
  const autosaveRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load project data ────────────────────────────────────────────────

  const loadProject = useCallback(async () => {
    if (!projectId || !user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("business_projects")
        .select("*")
        .eq("id", projectId)
        .single();

      if (error) throw error;

      setProject({
        id: data.id,
        name: data.name,
        company: data.company || "",
        contactId: data.primary_contact_id,
        clientNeed: data.need_summary || "",
        inputType: (data as any).input_type || "text",
        inputContent: (data as any).input_content || "",
        projectType: (data as any).project_type || "mixto",
        currentStep: (data as any).current_step || 1,
      });
      setCurrentStep((data as any).current_step || 1);

      // Load steps
      const { data: stepsData } = await supabase
        .from("project_wizard_steps")
        .select("*")
        .eq("project_id", projectId)
        .order("step_number", { ascending: true });

      const wizardSteps: WizardStep[] = STEP_NAMES.map((name, i) => {
        const stepNum = i + 1;
        const saved = (stepsData || []).filter((s: any) => s.step_number === stepNum);
        const latest = saved.length > 0 ? saved.reduce((a: any, b: any) => a.version > b.version ? a : b) : null;
        return {
          stepNumber: stepNum,
          stepName: name,
          status: (latest?.status || "pending") as StepStatus,
          outputData: latest?.output_data || null,
          inputData: latest?.input_data || null,
          version: latest?.version || 0,
          approvedAt: latest?.approved_at || null,
        };
      });
      setSteps(wizardSteps);

      // Auto-resume polling if a step is still generating
      const generatingStep = wizardSteps.find(s => s.status === "generating");
      if (generatingStep) {
        setGenerating(true);
        setCurrentStep(generatingStep.stepNumber);
        pollForStepCompletion(generatingStep.stepNumber)
          .catch((e: any) => toast.error(e.message || "Error en generación en segundo plano"))
          .finally(() => setGenerating(false));
      }

      // Load costs
      await loadCosts();
    } catch (e: any) {
      console.error("Error loading wizard project:", e);
      toast.error("Error al cargar el proyecto");
    } finally {
      setLoading(false);
    }
  }, [projectId, user]);

  const loadCosts = useCallback(async () => {
    if (!projectId) return;
    const { data } = await supabase
      .from("project_costs")
      .select("*")
      .eq("project_id", projectId)
      .order("created_at", { ascending: true });

    const mapped = (data || []).map((c: any) => ({
      id: c.id,
      stepNumber: c.step_number,
      service: c.service,
      operation: c.operation,
      tokensInput: c.tokens_input,
      tokensOutput: c.tokens_output,
      costUsd: Number(c.cost_usd),
      createdAt: c.created_at,
    }));
    setCosts(mapped);
    setTotalCost(mapped.reduce((sum, c) => sum + c.costUsd, 0));
  }, [projectId]);

  useEffect(() => {
    if (projectId && user) loadProject();
  }, [projectId, user, loadProject]);

  // ── Create wizard project ────────────────────────────────────────────

  const createWizardProject = async (data: {
    name: string;
    company: string;
    contactId?: string;
    clientNeed?: string;
    inputType: string;
    inputContent: string;
    projectType: string;
  }) => {
    if (!user) return null;
    try {
      const { data: row, error } = await supabase
        .from("business_projects")
        .insert({
          user_id: user.id,
          name: data.name,
          company: data.company || null,
          primary_contact_id: data.contactId || null,
          need_summary: data.clientNeed || null,
          input_type: data.inputType,
          input_content: data.inputContent,
          project_type: data.projectType,
          current_step: 2,
          origin: "wizard",
          status: "nuevo",
        } as any)
        .select()
        .single();

      if (error) throw error;

      // Create step 1 as approved
      await supabase.from("project_wizard_steps").insert({
        project_id: row.id,
        step_number: 1,
        step_name: "Entrada del Proyecto",
        status: "approved",
        input_data: data,
        output_data: data,
        version: 1,
        approved_at: new Date().toISOString(),
        user_id: user.id,
      });

      toast.success("Proyecto wizard creado");
      return row;
    } catch (e: any) {
      console.error("Error creating wizard project:", e);
      toast.error("Error al crear proyecto");
      return null;
    }
  };

  // ── Clear subsequent steps on regeneration ─────────────────────────

  const clearSubsequentSteps = async (fromStep: number) => {
    if (!projectId) return;
    await supabase
      .from("project_wizard_steps")
      .delete()
      .eq("project_id", projectId)
      .gt("step_number", fromStep);

    await supabase
      .from("business_projects")
      .update({ current_step: fromStep } as any)
      .eq("id", projectId);

    if (fromStep <= 7) {
      setDataPhaseComplete(false);
    }
  };

  // ── Run extraction (Step 2) ──────────────────────────────────────────

  const runExtraction = async () => {
    if (!project || !projectId) return;
    setGenerating(true);
    try {
      await clearSubsequentSteps(2);
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "extract",
          projectId,
          stepData: {
            projectName: project.name,
            companyName: project.company,
            projectType: project.projectType,
            clientNeed: project.clientNeed,
            inputContent: project.inputContent,
            inputType: project.inputType,
          },
        },
      });

      if (error) throw error;
      toast.success("Briefing extraído correctamente");
      await loadProject();
      return data;
    } catch (e: any) {
      console.error("Extraction error:", e);
      toast.error(e.message || "Error en la extracción");
    } finally {
      setGenerating(false);
    }
  };

  // ── Generate scope document (Step 3) ─────────────────────────────────

  const generateScope = async (briefingJson: any, contactName: string) => {
    if (!projectId) return;
    setGenerating(true);
    try {
      await clearSubsequentSteps(3);

      // Read attachment contents from storage if any
      const attachments = briefingJson?.attachments || [];
      const attachmentsContent: { name: string; type: string; content: string }[] = [];

      for (const att of attachments) {
        try {
          // Only read text-based files; skip images
          if (att.type?.startsWith("image/")) {
            attachmentsContent.push({ name: att.name, type: att.type, content: `[Imagen adjunta: ${att.name}]` });
            continue;
          }
          const { data, error } = await supabase.storage.from("project-documents").download(att.path);
          if (error || !data) continue;
          const text = await data.text();
          // Truncate to 20k chars per file
          attachmentsContent.push({
            name: att.name,
            type: att.type,
            content: text.length > 20000 ? text.substring(0, 20000) + "\n[...truncado]" : text,
          });
        } catch {
          // Skip unreadable files
        }
      }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_scope",
          projectId,
          stepData: {
            briefingJson,
            contactName,
            currentDate: new Date().toISOString().split("T")[0],
            attachmentsContent: attachmentsContent.length > 0 ? attachmentsContent : undefined,
          },
        },
      });

      if (error) throw error;
      toast.success("Documento de alcance generado");
      await loadProject();
      return data;
    } catch (e: any) {
      console.error("Scope generation error:", e);
      toast.error(e.message || "Error generando documento");
    } finally {
      setGenerating(false);
    }
  };

  // ── Poll for async step completion ────────────────────────────────────────

  const pollForStepCompletion = useCallback(async (stepNumber: number, maxWaitMs = 300000) => {
    if (!projectId) return;
    const startTime = Date.now();
    const pollInterval = 6000; // 6 seconds

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      const { data } = await supabase
        .from("project_wizard_steps")
        .select("status, output_data")
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (data?.status === "review") {
        toast.success(`Paso ${stepNumber} generado correctamente`);
        await loadProject();
        return data;
      }
      if (data?.status === "error") {
        const errMsg = (data.output_data as any)?.error || `Error en paso ${stepNumber}`;
        throw new Error(errMsg);
      }
      // status === "generating" → keep polling
    }
    throw new Error(`Timeout esperando paso ${stepNumber} (${maxWaitMs / 1000}s)`);
  }, [projectId, loadProject]);

  // ── Run generic step (Steps 4-9) ──────────────────────────────────────────

  const runGenericStep = async (stepNumber: number, action: string) => {
    if (!project || !projectId) return;
    setGenerating(true);
    try {
      await clearSubsequentSteps(stepNumber);
      // Collect all previous step outputs for context
      const getStepOutput = (n: number) => steps.find(s => s.stepNumber === n)?.outputData;
      
      const stepData: Record<string, any> = {
        projectName: project.name,
        companyName: project.company,
        projectType: project.projectType,
        briefingJson: getStepOutput(2),
        scopeDocument: getStepOutput(3)?.document || getStepOutput(3),
        originalInput: project.inputContent,
        auditJson: getStepOutput(4),
        finalDocument: getStepOutput(5)?.document || getStepOutput(5),
        aiLeverageJson: getStepOutput(6),
        prdDocument: getStepOutput(7)?.document || getStepOutput(7),
      };

      // Inject dataProfile for PRD generation (step 7)
      if (stepNumber === 7 && dataProfile) {
        stepData.dataProfile = dataProfile;
      }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: { action, projectId, stepData },
      });

      if (error) throw error;

      // If the edge function returned 202 (async), poll for completion
      if (data?.status === "generating") {
        const result = await pollForStepCompletion(stepNumber);
        return result;
      }

      toast.success(`Paso ${stepNumber} generado correctamente`);
      await loadProject();
      return data;
    } catch (e: any) {
      console.error(`Step ${stepNumber} error:`, e);
      toast.error(e.message || `Error en paso ${stepNumber}`);
    } finally {
      setGenerating(false);
    }
  };

  // ── Approve step ─────────────────────────────────────────────────────

  const approveStep = async (stepNumber: number, outputData?: any) => {
    if (!projectId) return;
    try {
      const { error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "approve_step",
          projectId,
          stepData: { stepNumber, outputData },
        },
      });

      if (error) throw error;
      toast.success(`Paso ${stepNumber} aprobado`);
      await loadProject();
    } catch (e: any) {
      console.error("Approve error:", e);
      toast.error("Error al aprobar paso");
    }
  };

  // ── Save step data (autosave) ────────────────────────────────────────

  const saveStepData = async (stepNumber: number, outputData: any) => {
    if (!projectId || !user) return;
    try {
      const { data: existing } = await supabase
        .from("project_wizard_steps")
        .select("id")
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from("project_wizard_steps")
          .update({ output_data: outputData, status: "editing" })
          .eq("id", existing.id);
      }
    } catch (e) {
      console.error("Autosave error:", e);
    }
  };

  // ── Update step output data (edit mode) ──────────────────────────────

  const updateStepOutputData = async (stepNumber: number, newOutputData: any) => {
    if (!projectId || !user) return;
    try {
      const { data: existing } = await supabase
        .from("project_wizard_steps")
        .select("id")
        .eq("project_id", projectId)
        .eq("step_number", stepNumber)
        .order("version", { ascending: false })
        .limit(1)
        .single();

      if (existing) {
        await supabase
          .from("project_wizard_steps")
          .update({ output_data: newOutputData })
          .eq("id", existing.id);
      }

      // Update local state
      setSteps(prev => prev.map(s =>
        s.stepNumber === stepNumber ? { ...s, outputData: newOutputData } : s
      ));
    } catch (e: any) {
      console.error("Update step data error:", e);
      toast.error("Error al guardar cambios");
    }
  };

  // ── Navigate ─────────────────────────────────────────────────────────

  const navigateToStep = (step: number) => {
    const stepData = steps[step - 1];
    if (!stepData) return;
    const maxApproved = steps.reduce((max, s) =>
      s.status === "approved" && s.stepNumber > max ? s.stepNumber : max, 0);
    if (stepData.status === "approved" || stepData.status === "review" ||
        stepData.status === "editing" || step <= maxApproved + 1) {
      setCurrentStep(step);
    }
  };

  // ── Autosave setup ───────────────────────────────────────────────────

  const startAutosave = (stepNumber: number, getOutputData: () => any) => {
    stopAutosave();
    autosaveRef.current = setInterval(() => {
      const data = getOutputData();
      if (data) saveStepData(stepNumber, data);
    }, 30000); // 30 seconds
  };

  const stopAutosave = () => {
    if (autosaveRef.current) {
      clearInterval(autosaveRef.current);
      autosaveRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopAutosave();
  }, []);

  return {
    project,
    steps,
    costs,
    totalCost,
    currentStep,
    loading,
    generating,
    dataProfile,
    setDataProfile,
    dataPhaseComplete,
    setDataPhaseComplete,
    stepNames: STEP_NAMES,
    createWizardProject,
    runExtraction,
    generateScope,
    approveStep,
    saveStepData,
    navigateToStep,
    setCurrentStep,
    startAutosave,
    stopAutosave,
    loadProject,
    loadCosts,
    runGenericStep,
    updateStepOutputData,
  };
};
