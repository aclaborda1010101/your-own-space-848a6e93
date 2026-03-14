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
  "Auditoría IA",
  "PRD Técnico",
  "Descripción del MVP",
];

// Map old 10-step step_numbers to new 5-step system for retrocompatibility
const mapOldStepNumber = (oldStep: number): number => {
  if (oldStep <= 2) return oldStep; // Steps 1-2 unchanged
  if (oldStep <= 5) return 3;       // Old steps 3-5 → new step 3 (fused scope)
  if (oldStep === 6) return 4;       // Old step 6 → new step 4 (AI audit)
  if (oldStep === 7) return 5;       // Old step 7 → new step 5 (PRD)
  if (oldStep === 8) return 6;       // Old step 8 → new step 6 (MVP)
  return 6;                          // Old steps 9-10 → treated as step 6
};

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

      const rawStep = (data as any).current_step || 1;
      const mappedStep = mapOldStepNumber(rawStep);

      setProject({
        id: data.id,
        name: data.name,
        company: data.company || "",
        contactId: data.primary_contact_id,
        clientNeed: data.need_summary || "",
        inputType: (data as any).input_type || "text",
        inputContent: (data as any).input_content || "",
        projectType: (data as any).project_type || "mixto",
        currentStep: mappedStep,
      });
      setCurrentStep(mappedStep);

      // Load steps — handle both old (10-step) and new (5-step) data
      const { data: stepsData } = await supabase
        .from("project_wizard_steps")
        .select("*")
        .eq("project_id", projectId)
        .order("step_number", { ascending: true });

      const wizardSteps: WizardStep[] = STEP_NAMES.map((name, i) => {
        const stepNum = i + 1;
        
        // For new 5-step system, look for exact step number first
        let saved = (stepsData || []).filter((s: any) => s.step_number === stepNum);
        
        // Retrocompat: if step 3 not found, check old steps 3-5 and use the latest
        if (stepNum === 3 && saved.length === 0) {
          const oldSteps = (stepsData || []).filter((s: any) => [3, 4, 5].includes(s.step_number));
          if (oldSteps.length > 0) {
            // Use the highest old step as the status for fused step 3
            const best = oldSteps.reduce((a: any, b: any) => a.step_number > b.step_number ? a : b);
            saved = [best];
          }
        }
        // Retrocompat: step 4 (AI audit) was old step 6
        if (stepNum === 4 && saved.length === 0) {
          const old6 = (stepsData || []).filter((s: any) => s.step_number === 6);
          if (old6.length > 0) saved = old6;
        }
        // Retrocompat: step 5 (PRD) was old step 7
        if (stepNum === 5 && saved.length === 0) {
          const old7 = (stepsData || []).filter((s: any) => s.step_number === 7);
          if (old7.length > 0) saved = old7;
        }
        // Retrocompat: step 6 (MVP) is stored as DB step 11
        if (stepNum === 6 && saved.length === 0) {
          const old11 = (stepsData || []).filter((s: any) => s.step_number === 11);
          if (old11.length > 0) saved = old11;
        }

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
  };

  // ── Update input content (Step 1 re-edit) ─────────────────────────────

  const updateInputContent = async (newContent: string) => {
    if (!projectId || !user) return;
    try {
      await supabase
        .from("business_projects")
        .update({ input_content: newContent } as any)
        .eq("id", projectId);

      setProject(prev => prev ? { ...prev, inputContent: newContent } : prev);
      toast.success("Material de entrada actualizado");
    } catch (e: any) {
      console.error("Error updating input content:", e);
      toast.error("Error al actualizar el material");
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

  // ── Generate scope document (Step 3 — fused: draft + audit + final) ──

  const generateScope = async (briefingJson: any, contactName: string, pricingMode: string = 'none') => {
    if (!projectId) return;
    setGenerating(true);
    try {
      await clearSubsequentSteps(3);

      // Read attachment contents from storage if any
      const attachments = briefingJson?.attachments || [];
      const attachmentsContent: { name: string; type: string; content: string }[] = [];

      for (const att of attachments) {
        try {
          if (att.type?.startsWith("image/")) {
            attachmentsContent.push({ name: att.name, type: att.type, content: `[Imagen adjunta: ${att.name}]` });
            continue;
          }
          const { data, error } = await supabase.storage.from("project-documents").download(att.path);
          if (error || !data) continue;
          const text = await data.text();
          attachmentsContent.push({
            name: att.name,
            type: att.type,
            content: text.length > 20000 ? text.substring(0, 20000) + "\n[...truncado]" : text,
          });
        } catch { /* Skip */ }
      }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_scope",
          projectId,
          stepData: {
            briefingJson,
            contactName,
            pricingMode,
            currentDate: new Date().toISOString().split("T")[0],
            attachmentsContent: attachmentsContent.length > 0 ? attachmentsContent : undefined,
            originalInput: project?.inputContent,
          },
        },
      });

      if (error) throw error;

      // If async, poll for completion
      if (data?.status === "generating") {
        const result = await pollForStepCompletion(3);
        return result;
      }

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
    const pollInterval = 6000;

    // Map UI step numbers to DB step numbers (backend uses old numbering)
    const UI_TO_DB_STEP: Record<number, number[]> = {
      4: [4, 6],   // Auditoría IA: try new (4) then old (6)
      5: [5, 7],   // PRD Técnico: try new (5) then old (7)
      6: [6, 11],  // MVP: try new (6) then DB (11)
    };
    const dbSteps = UI_TO_DB_STEP[stepNumber] || [stepNumber];

    while (Date.now() - startTime < maxWaitMs) {
      await new Promise(resolve => setTimeout(resolve, pollInterval));

      // Try each possible DB step number
      let data: any = null;
      for (const dbStep of dbSteps) {
        const { data: result } = await supabase
          .from("project_wizard_steps")
          .select("status, output_data")
          .eq("project_id", projectId)
          .eq("step_number", dbStep)
          .order("version", { ascending: false })
          .limit(1)
          .single();
        if (result) {
          data = result;
          break;
        }
      }

      if (data?.status === "review") {
        toast.success(`Paso ${stepNumber} generado correctamente`);
        await loadProject();
        return data;
      }
      if (data?.status === "error") {
        const errMsg = (data.output_data as any)?.error || `Error en paso ${stepNumber}`;
        throw new Error(errMsg);
      }
    }
    throw new Error(`Timeout esperando paso ${stepNumber} (${maxWaitMs / 1000}s)`);
  }, [projectId, loadProject]);

  // ── Run generic step (Steps 4-5) ──────────────────────────────────────────

  const runGenericStep = async (stepNumber: number, action: string) => {
    if (!project || !projectId) return;
    setGenerating(true);
    try {
      await clearSubsequentSteps(stepNumber);
      const getStepOutput = (n: number) => steps.find(s => s.stepNumber === n)?.outputData;
      
      const stepData: Record<string, any> = {
        projectName: project.name,
        companyName: project.company,
        projectType: project.projectType,
        briefingJson: getStepOutput(2),
        scopeDocument: getStepOutput(3)?.document || getStepOutput(3),
        originalInput: project.inputContent,
        finalDocument: getStepOutput(3)?.document || getStepOutput(3), // Step 3 now produces the final doc
        aiLeverageJson: getStepOutput(4),
        prdDocument: getStepOutput(5)?.document || getStepOutput(5),
      };

      // Inject live summary context
      if ([3, 4, 5, 6].includes(stepNumber)) {
        try {
          const { data: summaryData } = await supabase.functions.invoke("project-activity-intelligence", {
            body: { action: "get_summary", projectId },
          });
          if (summaryData?.summary_markdown) {
            stepData.activityContext = summaryData.summary_markdown;
          }
        } catch { /* non-blocking */ }
      }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: { action, projectId, stepData },
      });

      if (error) throw error;

      // If async, poll for completion
      if (data?.status === "generating") {
        const timeout = stepNumber === 5 ? 600000 : 300000;
        const result = await pollForStepCompletion(stepNumber, timeout);
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

      // Auto-log timeline entry
      try {
        const stepName = STEP_NAMES[stepNumber - 1] || `Paso ${stepNumber}`;
        await supabase.from("business_project_timeline").insert({
          project_id: projectId,
          event_date: new Date().toISOString().split("T")[0],
          channel: "interno",
          title: `Paso ${stepNumber} aprobado: ${stepName}`,
          auto_detected: true,
          user_id: user?.id || null,
        });
      } catch (tlErr) {
        console.warn("Timeline auto-log failed:", tlErr);
      }

      // Refresh live summary
      try {
        await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "refresh_summary", projectId },
        });
      } catch (sumErr) {
        console.warn("Summary refresh failed:", sumErr);
      }

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
    }, 30000);
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

  // ── Budget estimation (Step 6 — internal) ─────────────────────────────

  const [budgetData, setBudgetData] = useState<any>(null);
  const [budgetGenerating, setBudgetGenerating] = useState(false);

  const updateBudgetData = async (data: any) => {
    if (!projectId) return;
    setBudgetData(data);
    try {
      await supabase
        .from("project_wizard_steps")
        .update({ output_data: data })
        .eq("project_id", projectId)
        .eq("step_number", 6);
      toast.success("Presupuesto actualizado");
    } catch (e: any) {
      toast.error("Error guardando presupuesto");
    }
  };

  // Load budget data from step 6 if exists
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("project_wizard_steps")
        .select("output_data")
        .eq("project_id", projectId)
        .eq("step_number", 6)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.output_data) setBudgetData(data.output_data);
    })();
  }, [projectId, steps]);

  const generateBudgetEstimate = async (selectedModels?: string[]) => {
    if (!projectId || !project) return;
    setBudgetGenerating(true);
    try {
      const getStepOutput = (n: number) => steps.find(s => s.stepNumber === n)?.outputData;
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_budget_estimate",
          projectId,
          stepData: {
            scopeDocument: getStepOutput(3)?.document || getStepOutput(3),
            aiLeverageJson: getStepOutput(4),
            prdDocument: getStepOutput(5)?.document || getStepOutput(5),
            selectedMonetizationModels: selectedModels || [],
          },
        },
      });
      if (error) throw error;
      if (data?.budget) setBudgetData(data.budget);
      toast.success("Estimación de presupuesto generada");
      await loadCosts();
    } catch (e: any) {
      console.error("Budget estimation error:", e);
      toast.error(e.message || "Error generando estimación");
    } finally {
      setBudgetGenerating(false);
    }
  };

  const updateProjectName = async (newName: string) => {
    if (!projectId || !newName.trim()) return;
    const { error } = await supabase
      .from("business_projects")
      .update({ name: newName.trim() })
      .eq("id", projectId);
    if (error) {
      toast.error("Error al actualizar el nombre");
      return;
    }
    setProject((prev) => (prev ? { ...prev, name: newName.trim() } : null));
    toast.success("Nombre actualizado");
  };

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
    runGenericStep,
    updateStepOutputData,
    updateInputContent,
    budgetData,
    budgetGenerating,
    generateBudgetEstimate,
    updateBudgetData,
    updateProjectName,
  };
};
