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
  "Documento de Alcance",
  "Auditoría Cruzada",
  "Documento Final",
  "AI Leverage",
  "PRD Técnico",
  "Generación de RAGs",
  "Detección de Patrones",
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
          current_step: 1,
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

  // ── Run extraction (Step 2) ──────────────────────────────────────────

  const runExtraction = async () => {
    if (!project || !projectId) return;
    setGenerating(true);
    try {
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
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_scope",
          projectId,
          stepData: {
            briefingJson,
            contactName,
            currentDate: new Date().toISOString().split("T")[0],
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

  // ── Navigate ─────────────────────────────────────────────────────────

  const navigateToStep = (step: number) => {
    const stepData = steps[step - 1];
    if (!stepData) return;
    // Can navigate to completed steps or current step
    if (stepData.status === "approved" || stepData.status === "review" || stepData.status === "editing" || step <= currentStep) {
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
  };
};
