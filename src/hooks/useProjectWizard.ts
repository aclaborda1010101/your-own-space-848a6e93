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
  "Briefing",
  "PRD Técnico",
  "Descripción del MVP",
];

// Map old step_numbers to new 4-step system for retrocompatibility
// New system: 1=Entrada, 2=Briefing, 3=PRD, 4=MVP
// Old 6-step: 1=Entrada, 2=Briefing, 3=Alcance, 4=Auditoría, 5=PRD, 6=MVP
// Old 10-step: 7=PRD, 8-10=MVP
const mapOldStepNumber = (rawStep: number): number => {
  if (rawStep <= 2) return rawStep;  // Steps 1-2 unchanged
  if (rawStep === 3) return 2; // Old alcance → Briefing stage
  if (rawStep === 4) return 4; // New 4-step MVP must stay on MVP
  if (rawStep === 5 || rawStep === 7) return 3; // PRD (new or old) → step 3
  if (rawStep === 6 || rawStep === 8 || rawStep === 11) return 4; // MVP legacy/internal → step 4
  if (rawStep >= 9) return 4;        // Old steps 9-10 → MVP
  return rawStep;
};

export type ChainedPhase = "idle" | "alcance" | "auditoria" | "patrones" | "prd" | "done" | "error";

export const useProjectWizard = (projectId?: string) => {
  const { user } = useAuth();
  const [project, setProject] = useState<WizardProject | null>(null);
  const [steps, setSteps] = useState<WizardStep[]>([]);
  const [internalStepStatuses, setInternalStepStatuses] = useState<Record<number, StepStatus>>({});
  const [costs, setCosts] = useState<ProjectCost[]>([]);
  const [totalCost, setTotalCost] = useState(0);
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [normalizing, setNormalizing] = useState(false);
  const [chainedPhase, setChainedPhase] = useState<ChainedPhase>("idle");
  const [prdSubProgress, setPrdSubProgress] = useState<{ currentPart: number; totalParts: number; label: string; partsCompleted: string[]; startedAt: string } | null>(null);
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
      const mappedStep = Math.min(mapOldStepNumber(rawStep), 4);

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

      // Load steps — handle both old (6/10-step) and new (4-step) data
      const { data: stepsData } = await supabase
        .from("project_wizard_steps")
        .select("*")
        .eq("project_id", projectId)
        .order("step_number", { ascending: true });

      const wizardSteps: WizardStep[] = STEP_NAMES.map((name, i) => {
        const stepNum = i + 1;
        
        // For new 4-step system, look for exact step number first
        let saved = (stepsData || []).filter((s: any) => s.step_number === stepNum);
        
        // Retrocompat: step 3 (PRD) — check old step 5 (PRD) or 7 (legacy PRD)
        if (stepNum === 3 && saved.length === 0) {
          const oldPrd = (stepsData || []).filter((s: any) => [5, 7].includes(s.step_number));
          if (oldPrd.length > 0) {
            saved = [oldPrd.reduce((a: any, b: any) => a.step_number > b.step_number ? a : b)];
          }
        }
        // Retrocompat: step 4 (MVP) — check old step 11 (MVP) or 6 (old MVP), or 8 (legacy)
        if (stepNum === 4 && saved.length === 0) {
          const oldMvp = (stepsData || []).filter((s: any) => [11, 8].includes(s.step_number));
          if (oldMvp.length > 0) {
            saved = [oldMvp.reduce((a: any, b: any) => a.step_number > b.step_number ? a : b)];
          }
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

      // Load internal pipeline step statuses (10=alcance, 11=audit, 12=patterns, 300=forge)
      const internalMap: Record<number, StepStatus> = {};
      for (const s of (stepsData || []) as any[]) {
        if ([10, 11, 12, 300].includes(s.step_number)) {
          internalMap[s.step_number] = (s.status || "pending") as StepStatus;
        }
      }
      setInternalStepStatuses(internalMap);

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
    // Delete steps greater than fromStep in both new AND old numbering
    // New pipeline: 1,2,3,4,5,11  Old pipeline: 1,2,3,4,5,6,7,8,9,10,11
    // We need to delete any step_number > fromStep to cover old numbering,
    // BUT preserve step_number 6 (internal budget) when fromStep < 6
    const { data: toDelete } = await supabase
      .from("project_wizard_steps")
      .select("id, step_number")
      .eq("project_id", projectId)
      .gt("step_number", fromStep);
    
    if (toDelete && toDelete.length > 0) {
      // Keep budget steps (step_number 6) unless explicitly clearing from step 6+
      const idsToDelete = toDelete
        .filter((s: any) => !(s.step_number === 6 && fromStep < 6))
        .map((s: any) => s.id);
      
      if (idsToDelete.length > 0) {
        await supabase
          .from("project_wizard_steps")
          .delete()
          .in("id", idsToDelete);
      }
    }

    await supabase
      .from("business_projects")
      .update({ current_step: fromStep } as any)
      .eq("id", projectId);
  };

  // ── Update input content (Step 1 re-edit) ─────────────────────────────

  const updateInputContent = async (newContent: string): Promise<string | null> => {
    if (!projectId || !user) return null;
    try {
      await supabase
        .from("business_projects")
        .update({ input_content: newContent } as any)
        .eq("id", projectId);

      setProject(prev => prev ? { ...prev, inputContent: newContent } : prev);
      toast.success("Material de entrada actualizado");
      return newContent;
    } catch (e: any) {
      console.error("Error updating input content:", e);
      toast.error("Error al actualizar el material");
      return null;
    }
  };

  // ── Run extraction (Step 2) ──────────────────────────────────────────
  // `overrideInput` evita el race con setProject: el Step 1 nos pasa el
  // texto recién guardado en lugar de leerlo del state que aún no se ha
  // re-renderizado.
  // `skipSampler` permite forzar el contenido completo (sin muestreo)
  // cuando el usuario lo pide explícitamente desde la alerta del briefing.

  const runExtraction = async (
    overrideInput?: string,
    options?: {
      skipSampler?: boolean;
      forceRefresh?: boolean;
      chunkedExtraction?: boolean;
    },
  ) => {
    if (!project || !projectId) return;
    const inputContent = overrideInput ?? project.inputContent;
    setGenerating(true);
    const isChunked = options?.chunkedExtraction === true
      || (inputContent || "").length > 90_000;
    const toastId = toast.loading(
      isChunked
        ? "Extracción por bloques en curso (puede tardar 1-3 min)…"
        : "Re-extrayendo briefing…",
    );
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
            inputContent,
            inputType: project.inputType,
            skipSampler: options?.skipSampler === true,
            forceRefresh: options?.forceRefresh === true,
            // Auto-promote a chunked si el input es largo (>90k), aunque el caller no lo pida
            chunkedExtraction: isChunked,
          },
        },
      });

      if (error) throw error;
      toast.dismiss(toastId);
      toast.success(
        isChunked
          ? "Briefing extraído por bloques (extracción completa)"
          : "Briefing extraído correctamente",
      );

      // ── Auto-pipeline: retry_failed_chunks (si procede) → normalize_brief ──
      // Garantiza que el output siempre tenga _clean_brief_md y naming corregido.
      try {
        const briefing = (data as any)?.briefing || {};
        const meta = briefing?._chunked_extraction_meta;
        const failedCount = Array.isArray(meta?.failed_chunks) ? meta.failed_chunks.length : 0;

        if (failedCount > 0) {
          const tId = toast.loading(`Recuperando ${failedCount} bloque(s) fallido(s)…`);
          const { error: retryErr } = await supabase.functions.invoke("project-wizard-step", {
            body: {
              action: "retry_failed_chunks",
              stepData: {
                projectId,
                inputContent,
                projectName: project.name,
                companyName: project.company,
                projectType: project.projectType,
                clientNeed: project.clientNeed,
              },
            },
          });
          toast.dismiss(tId);
          if (retryErr) console.warn("[auto-pipeline] retry failed (non-blocking):", retryErr);
        }

        // Normalize siempre (genera _clean_brief_md, corrige naming, dedup, EN→ES)
        const { getNormalizationOverrides } = await import("@/lib/normalization-overrides");
        const overrides = getNormalizationOverrides(project.name || "", project.company || "");
        const tId2 = toast.loading("Generando Brief Limpio normalizado…");
        const { error: normErr } = await supabase.functions.invoke("project-wizard-step", {
          body: {
            action: "normalize_brief",
            stepData: {
              projectId,
              projectName: project.name,
              companyName: project.company,
              productName: overrides.productName,
              companyNameOverride: overrides.companyNameOverride,
              canonicalComponents: overrides.canonicalComponents,
              canonicalCatalysts: overrides.canonicalCatalysts,
              mutexGroups: overrides.mutexGroups,
              forbiddenTopics: overrides.forbiddenTopics,
              manualReviewAlerts: overrides.manualReviewAlerts,
            },
          },
        });
        toast.dismiss(tId2);
        if (normErr) {
          console.warn("[auto-pipeline] normalize failed (non-blocking):", normErr);
          toast.warning("Brief extraído pero la normalización falló. Pulsa 'Limpiar y normalizar' manualmente.");
        } else {
          toast.success("Brief Limpio generado y listo para exportar");
        }
      } catch (autoErr) {
        console.warn("[auto-pipeline] non-blocking error:", autoErr);
      }

      await loadProject();
      return data;
    } catch (e: any) {
      console.error("Extraction error:", e);
      toast.dismiss(toastId);
      toast.error(e.message || "Error en la extracción");
    } finally {
      setGenerating(false);
    }
  };

  // ── Retry only failed chunks (surgical repair, no full re-extraction) ──
  const retryFailedChunks = async () => {
    if (!project || !projectId) return;
    setGenerating(true);
    const toastId = toast.loading("Reintentando bloques fallidos…");
    try {
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "retry_failed_chunks",
          stepData: {
            projectId,
            inputContent: project.inputContent,
            projectName: project.name,
            companyName: project.company,
            projectType: project.projectType,
            clientNeed: project.clientNeed,
          },
        },
      });
      if (error) throw error;
      toast.dismiss(toastId);
      toast.success(`Recuperados ${data?.recovered ?? 0} bloque(s). ${data?.still_failed ?? 0} sigue(n) fallando.`);
      await loadProject();
      return data;
    } catch (e: any) {
      console.error("Retry failed chunks error:", e);
      toast.dismiss(toastId);
      toast.error(e.message || "Error al reintentar bloques");
    } finally {
      setGenerating(false);
    }
  };

  // ── Normalize / repair brief (clean naming, dedup, language, retry chunks) ──
  // Uses `normalize_brief`: no re-extraction, no chunk retry, only final editorial normalization.
  const normalizeBrief = async (): Promise<{ success: boolean; cleanLength: number; version: number } | null> => {
    if (!project || !projectId) return null;
    setNormalizing(true);
    const toastId = toast.loading("Limpiando y normalizando brief…");
    try {
      // Pull project-specific normalization overrides (canonical components,
      // forbidden topics, manual review alerts). Returns {} for projects with
      // no override registered.
      const { getNormalizationOverrides } = await import("@/lib/normalization-overrides");
      const overrides = getNormalizationOverrides(project.name || "", project.company || "");

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "normalize_brief",
          stepData: {
            projectId,
            projectName: project.name,
            companyName: project.company,
            inputContent: project.inputContent,
            projectType: project.projectType,
            clientNeed: project.clientNeed,
            // Optional per-project overrides (empty for unregistered projects).
            productName: overrides.productName,
            companyNameOverride: overrides.companyNameOverride,
            canonicalComponents: overrides.canonicalComponents,
            canonicalCatalysts: overrides.canonicalCatalysts,
            mutexGroups: overrides.mutexGroups,
            forbiddenTopics: overrides.forbiddenTopics,
            manualReviewAlerts: overrides.manualReviewAlerts,
          },
        },
      });
      toast.dismiss(toastId);
      if (error) {
        const msg = (error as any)?.message || "Error desconocido";
        console.error("[normalizeBrief] backend error:", error);
        toast.error(`Normalización falló: ${msg}`);
        return null;
      }
      if (!data?.success) {
        const msg = (data as any)?.error || "Sin éxito";
        toast.error(`Normalización falló: ${msg}`);
        return null;
      }
      const cleanLen = data.clean_brief_length || 0;
      const recovered = data.recovered_chunks || 0;
      toast.success(
        recovered > 0
          ? `Brief Limpio generado (v${data.version}). ${recovered} bloque(s) recuperado(s).`
          : `Brief Limpio generado (v${data.version}). Listo para exportar y aprobar.`,
      );
      await loadProject();
      return { success: true, cleanLength: cleanLen, version: data.version };
    } catch (e: any) {
      console.error("Normalize brief error:", e);
      toast.dismiss(toastId);
      toast.error(e.message || "Error al normalizar el brief");
      return null;
    } finally {
      setNormalizing(false);
    }
  };


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

  const pollForStepCompletion = useCallback(async (stepNumber: number, maxWaitMs = 600000) => {
    if (!projectId) return;
    const startTime = Date.now();
    const pollInterval = 6000;

    // Map UI step numbers to DB step numbers
    // New 4-step pipeline: UI 3=DB 3 (chained PRD), UI 4=DB 4 (MVP stored as 11)
    // Old pipeline retrocompat included
    const UI_TO_DB_STEP: Record<number, number[]> = {
      3: [3, 5, 7],   // PRD: new chained (3) or old (5) or legacy (7)
      4: [4, 11],      // MVP: new (4) or old DB 11
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

  // ── Run chained PRD (Step 3 in new pipeline: Alcance → Auditoría → PRD) ───

  const runChainedPRD = async (pricingMode: string = 'none') => {
    if (!project || !projectId) return;
    setGenerating(true);
    setChainedPhase("alcance");
    try {
      await clearSubsequentSteps(3);
      const getStepOutput = (n: number) => steps.find(s => s.stepNumber === n)?.outputData;
      const briefingJson = getStepOutput(2);

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

      // Get live summary context
      let activityContext: string | undefined;
      try {
        const { data: summaryData } = await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "get_summary", projectId },
        });
        if (summaryData?.summary_markdown) activityContext = summaryData.summary_markdown;
      } catch { /* non-blocking */ }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_prd_chained",
          projectId,
          stepData: {
            projectName: project.name,
            companyName: project.company,
            projectType: project.projectType,
            briefingJson,
            originalInput: project.inputContent,
            pricingMode,
            currentDate: new Date().toISOString().split("T")[0],
            attachmentsContent: attachmentsContent.length > 0 ? attachmentsContent : undefined,
            activityContext,
          },
        },
      });

      if (error) throw error;

      // The edge function returns immediately with status "generating"
      // Poll for completion, updating chainedPhase based on DB progress
      if (data?.status === "generating") {
        // Start polling with phase tracking
        const startTime = Date.now();
        const maxWaitMs = 900000; // 15 min for chained
        const pollInterval = 6000;

        while (Date.now() - startTime < maxWaitMs) {
          await new Promise(resolve => setTimeout(resolve, pollInterval));

          // Check internal phase progress via step markers
          const { data: phaseMarker } = await supabase
            .from("project_wizard_steps")
            .select("step_number, status, input_data")
            .eq("project_id", projectId)
            .in("step_number", [10, 11, 12, 3]) // 10=alcance, 11=audit, 12=patterns, 3=PRD
            .order("step_number", { ascending: false });

          if (phaseMarker) {
            const s3 = phaseMarker.find((s: any) => s.step_number === 3);
            const s11 = phaseMarker.find((s: any) => s.step_number === 11);
            const s10 = phaseMarker.find((s: any) => s.step_number === 10);
            const s12 = phaseMarker.find((s: any) => s.step_number === 12);

            // Read sub-progress from input_data
            if (s3?.input_data && typeof s3.input_data === "object") {
              const gp = (s3.input_data as any)?.generation_progress;
              if (gp && gp.current_part) {
                setPrdSubProgress({
                  currentPart: gp.current_part,
                  totalParts: gp.total_parts || 6,
                  label: gp.current_label || "",
                  partsCompleted: gp.parts_completed || [],
                  startedAt: gp.started_at || "",
                });
              }
            }

            if (s3?.status === "review") {
              setChainedPhase("done");
              setPrdSubProgress(null);
              toast.success("PRD Técnico generado correctamente");
              await loadProject();
              return data;
            }
            if (s3?.status === "error") {
              const errData = s3 as any;
              throw new Error(errData?.output_data?.error || "Error generando PRD");
            }
            if (s3?.status === "generating") {
              setChainedPhase("prd");
            } else if (s12?.status === "generating") {
              setChainedPhase("patrones");
            } else if (s12?.status === "review" || s11?.status === "review" || s11?.status === "approved") {
              setChainedPhase("prd");
            } else if (s10?.status === "review" || s10?.status === "approved") {
              setChainedPhase("auditoria");
            }
          }
        }
        throw new Error("Timeout esperando PRD encadenado (15 min)");
      }

      setChainedPhase("done");
      toast.success("PRD Técnico generado correctamente");
      await loadProject();
      return data;
    } catch (e: any) {
      console.error("Chained PRD error:", e);
      setChainedPhase("error");
      setPrdSubProgress(null);
      toast.error(e.message || "Error generando PRD");
    } finally {
      setGenerating(false);
      setPrdSubProgress(null);
      setTimeout(() => setChainedPhase("idle"), 2000);
    }
  };

  // ── Pipeline v2 PRD (canonical: build_registry → audit_f4a → audit_f4b → architect_scope → generate_technical_prd) ──
  // Reemplaza al runChainedPRD legacy. Usa Step 28 (`scope_architecture_v1`)
  // como única fuente de verdad y produce un PRD técnico determinista (sin LLM,
  // sin SQL inventado, sin scoring inventado, sin "Claro aquí tienes…").
  const runPipelineV2PRD = async (pricingMode: string = 'none') => {
    if (!project || !projectId) return;

    // Validar prerequisito: brief aprobado
    const step2 = steps.find((s) => s.stepNumber === 2);
    if (!step2 || step2.status !== "approved") {
      toast.error("Aprueba primero el briefing (Paso 2) antes de generar el PRD.");
      return;
    }

    setGenerating(true);
    setChainedPhase("alcance");
    try {
      await clearSubsequentSteps(3);

      // Persistimos el pricingMode para que la propuesta cliente lo use luego.
      try {
        if (typeof window !== "undefined") {
          window.localStorage.setItem(`wizard-pricing-mode-${projectId}`, pricingMode);
        }
      } catch { /* no-op */ }

      const callAction = async (action: string, label: string) => {
        console.info(`[pipeline-v2] ${label} (${action})…`);
        const { data, error } = await supabase.functions.invoke("project-wizard-step", {
          body: { action, projectId },
        });
        if (error) {
          console.error(`[pipeline-v2] ${action} failed:`, error);
          throw new Error(`${label} falló: ${error.message || error}`);
        }
        if (data?.error) {
          throw new Error(`${label}: ${data.error}`);
        }
        return data;
      };

      // F2 + F3 — Component Registry (Step 25)
      setChainedPhase("alcance");
      await callAction("build_registry", "Construir registro de componentes");

      // F4a — Gap Audit (Step 26)
      await callAction("audit_f4a_gaps", "Auditoría de gaps");

      // F4b — Feasibility Audit (Step 27)
      setChainedPhase("auditoria");
      await callAction("audit_f4b_feasibility", "Auditoría de viabilidad");

      // F5 — Scope Architect (Step 28)
      setChainedPhase("patrones");
      await callAction("architect_scope", "Arquitectura de alcance (Step 28)");

      // F6 — Technical PRD (Step 29)
      setChainedPhase("prd");
      await callAction("generate_technical_prd", "PRD técnico (Step 29)");

      // Mirror Step 29 → Step 3 para que la UI existente (descarga PDF, badges,
      // budget panel y propuesta cliente) lo encuentre sin cambios mayores.
      const { data: step29Row } = await supabase
        .from("project_wizard_steps")
        .select("id, version, output_data")
        .eq("project_id", projectId)
        .eq("step_number", 29)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!step29Row?.output_data) {
        throw new Error("Step 29 no devolvió output_data tras generate_technical_prd.");
      }

      const od29 = step29Row.output_data as any;
      const prdMarkdown: string = od29.prd_markdown || "";
      const prdMeta = od29.prd_meta || {};

      const { data: existing3 } = await supabase
        .from("project_wizard_steps")
        .select("id, version")
        .eq("project_id", projectId)
        .eq("step_number", 3)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const newV3 = existing3 ? existing3.version + 1 : 1;
      const mirroredOutput = {
        document: prdMarkdown,
        source: "pipeline_v2",
        step_28_ref: { step_number: 28 },
        step_29_ref: { step_number: 29, version: step29Row.version, row_id: step29Row.id },
        prd_meta: prdMeta,
        components_total: prdMeta.components_total || 0,
        components_by_bucket: prdMeta.components_by_bucket || {},
        pricing_mode: pricingMode,
      };

      const { error: upsertErr } = await supabase.from("project_wizard_steps").upsert({
        id: existing3?.id || undefined,
        project_id: projectId,
        step_number: 3,
        step_name: "PRD Técnico (Pipeline v2)",
        status: "review",
        input_data: { source: "pipeline_v2", pricing_mode: pricingMode },
        output_data: mirroredOutput,
        model_used: "deterministic_f6",
        version: newV3,
        user_id: user?.id ?? null,
      });

      if (upsertErr) {
        console.error("[pipeline-v2] Failed to mirror Step 29 → Step 3:", upsertErr);
        throw new Error(`No se pudo persistir el PRD en Step 3: ${upsertErr.message}`);
      }

      setChainedPhase("done");
      toast.success("PRD Técnico generado desde Step 28 (pipeline v2)");
      await loadProject();
      return mirroredOutput;
    } catch (e: any) {
      console.error("Pipeline v2 PRD error:", e);
      setChainedPhase("error");
      toast.error(e.message || "Error generando PRD desde el pipeline v2");
    } finally {
      setGenerating(false);
      setTimeout(() => setChainedPhase("idle"), 2000);
    }
  };

  // ── Run generic step (Steps 3-4 in new pipeline) ──────────────────────────

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
        finalDocument: getStepOutput(3)?.document || getStepOutput(3),
        aiLeverageJson: getStepOutput(3)?._internal_audit || null,
        prdDocument: getStepOutput(3)?.document || getStepOutput(3),
      };

      // Inject live summary context
      try {
        const { data: summaryData } = await supabase.functions.invoke("project-activity-intelligence", {
          body: { action: "get_summary", projectId },
        });
        if (summaryData?.summary_markdown) {
          stepData.activityContext = summaryData.summary_markdown;
        }
      } catch { /* non-blocking */ }

      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: { action, projectId, stepData },
      });

      if (error) throw error;

      // If async, poll for completion
      if (data?.status === "generating") {
        const timeout = 600000;
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

  const approveStep = async (stepNumber: number, outputData?: any, options?: { autoChain?: boolean }) => {
    if (!projectId) return;
    try {
      // ── Pre-approval safety: Step 2 must have a clean brief ──
      // If the user is approving Step 2 but normalization never ran, do it now.
      // This prevents approving a raw briefing and blocking PDF/PRD downstream.
      let payloadOutput = outputData;
      if (stepNumber === 2) {
        const candidate = outputData || steps.find((s) => s.stepNumber === 2)?.outputData;
        const hasCleanBrief =
          typeof candidate?._clean_brief_md === "string" &&
          candidate._clean_brief_md.trim().length > 200;
        if (!hasCleanBrief) {
          const repair = await normalizeBrief();
          if (!repair?.success) {
            toast.error("No se pudo generar el Brief Limpio. Revisa los logs antes de aprobar.");
            return;
          }
          // After normalizeBrief() loadProject() updated `steps`, but we read
          // outputData from the freshly persisted version via Supabase to be safe.
          const { data: latest } = await supabase
            .from("project_wizard_steps")
            .select("output_data")
            .eq("project_id", projectId)
            .eq("step_number", 2)
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle();
          payloadOutput = (latest?.output_data as any) || candidate;
        }
      }

      console.info(`[approveStep] invoking project-wizard-step approve_step for step ${stepNumber}…`);
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "approve_step",
          projectId,
          stepData: { stepNumber, outputData: payloadOutput },
        },
      });

      if (error) {
        console.error(`[approveStep] invoke error:`, error);
        throw error;
      }
      if (data?.error) {
        console.error(`[approveStep] backend error:`, data.error);
        toast.error(`No se pudo aprobar el paso ${stepNumber}: ${data.error}`);
        return;
      }
      console.info(`[approveStep] step ${stepNumber} approved OK`);
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

      // ── Auto-chain pipeline ────────────────────────────────────────
      // After approving Brief (step 2): jump to step 3 and auto-launch chained PRD.
      // After approving PRD (step 3): auto-launch budget estimate (sugerido).
      // IMPORTANT: la propuesta cliente NO se dispara aquí. Se genera SOLO
      // tras "Aprobar presupuesto" desde ProjectBudgetPanel (approveBudget).
      const autoChain = options?.autoChain !== false; // default ON
      if (autoChain) {
        if (stepNumber === 2) {
          setCurrentStep(3);
          setTimeout(() => {
            runPipelineV2PRD('none').catch((err) => {
              console.error("Auto pipeline-v2 PRD failed:", err);
            });
          }, 500);
        } else if (stepNumber === 3) {
          setTimeout(() => {
            generateBudgetEstimate([]).catch((err) => {
              console.error("Auto budget estimate failed:", err);
            });
          }, 500);
        }
      }
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
  // Estados del presupuesto: pending → generated → editing → approved
  const [budgetStatus, setBudgetStatus] = useState<"pending" | "generated" | "editing" | "approved">("pending");

  const updateBudgetData = async (data: any) => {
    if (!projectId) return;
    setBudgetData(data);
    // Cualquier edición devuelve a estado "editing" (rompe aprobación)
    setBudgetStatus("editing");
    try {
      await supabase
        .from("project_wizard_steps")
        .update({ output_data: data, status: "editing" })
        .eq("project_id", projectId)
        .eq("step_number", 6);
      toast.success("Presupuesto actualizado");
    } catch (e: any) {
      toast.error("Error guardando presupuesto");
    }
  };

  // Load budget data + status from step 6 if exists
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("project_wizard_steps")
        .select("output_data, status")
        .eq("project_id", projectId)
        .eq("step_number", 6)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.output_data) setBudgetData(data.output_data);
      if (data?.status === "approved") setBudgetStatus("approved");
      else if (data?.status === "editing") setBudgetStatus("editing");
      else if (data?.output_data) setBudgetStatus("generated");
      else setBudgetStatus("pending");
    })();
  }, [projectId, steps]);

  const generateBudgetEstimate = async (selectedModels?: string[]) => {
    if (!projectId || !project) return;
    setBudgetGenerating(true);
    try {
      const getStepOutput = (n: number) => steps.find(s => s.stepNumber === n)?.outputData;
      // In new 4-step pipeline: step 3 = PRD (contains scope+audit+prd)
      const prdOutput = getStepOutput(3);
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_budget_estimate",
          projectId,
          stepData: {
            scopeDocument: prdOutput?._internal_scope?.document || prdOutput?.document || prdOutput,
            aiLeverageJson: prdOutput?._internal_audit || null,
            prdDocument: prdOutput?.document || prdOutput,
            selectedMonetizationModels: selectedModels || [],
          },
        },
      });
      if (error) throw error;
      if (data?.budget) {
        setBudgetData(data.budget);
        setBudgetStatus("generated");
      }
      toast.success("Estimación de presupuesto generada");
      await loadCosts();
    } catch (e: any) {
      console.error("Budget estimation error:", e);
      toast.error(e.message || "Error generando estimación");
    } finally {
      setBudgetGenerating(false);
    }
  };

  // ── Approve budget ──────────────────────────────────────────────────
  // Marca el presupuesto como aprobado y, si autoChain, genera la propuesta
  // cliente (F7) automáticamente. Si autoChain OFF, solo habilita el botón.
  const approveBudget = async (options?: { autoChain?: boolean }) => {
    if (!projectId || !budgetData) {
      toast.error("Genera el presupuesto antes de aprobarlo");
      return;
    }
    try {
      await supabase
        .from("project_wizard_steps")
        .update({ status: "approved", approved_at: new Date().toISOString() })
        .eq("project_id", projectId)
        .eq("step_number", 6);
      setBudgetStatus("approved");
      toast.success("Presupuesto aprobado");

      const autoChain = options?.autoChain !== false;
      if (autoChain) {
        setTimeout(() => {
          generateClientProposal().catch((err) => {
            console.error("Auto client proposal failed:", err);
          });
        }, 300);
      }
    } catch (e: any) {
      console.error("Approve budget error:", e);
      toast.error("Error aprobando presupuesto");
    }
  };

  // ── Client proposal (Step 30 — F7) ─────────────────────────────────
  const [proposalData, setProposalData] = useState<{
    proposalMarkdown?: string;
    client_proposal_v1?: any;
    proposal_meta?: any;
    version?: number;
  } | null>(null);
  const [proposalGenerating, setProposalGenerating] = useState(false);

  // Load latest proposal from Step 30
  useEffect(() => {
    if (!projectId) return;
    (async () => {
      const { data } = await supabase
        .from("project_wizard_steps")
        .select("output_data, version")
        .eq("project_id", projectId)
        .eq("step_number", 30)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data?.output_data) {
        const od = data.output_data as any;
        setProposalData({
          proposalMarkdown: od.proposal_markdown,
          client_proposal_v1: od.client_proposal_v1,
          proposal_meta: od.proposal_meta,
          version: data.version,
        });
      }
    })();
  }, [projectId, budgetStatus]);

  const generateClientProposal = async () => {
    if (!projectId || !project) return;
    if (!budgetData) {
      toast.error("Genera y aprueba el presupuesto antes de generar la propuesta");
      return;
    }
    if (budgetStatus !== "approved") {
      toast.error("Aprueba el presupuesto antes de generar la propuesta cliente");
      return;
    }
    setProposalGenerating(true);
    try {
      const { budgetToCommercialTermsV1, validateBudgetForClientProposal } = await import("@/lib/budgetToCommercialTerms");
      const validationError = validateBudgetForClientProposal(budgetData);
      if (validationError) {
        toast.error(validationError);
        return;
      }
      const commercial_terms_v1 = budgetToCommercialTermsV1(budgetData);
      if (!commercial_terms_v1) {
        toast.error("No se pudieron derivar las condiciones comerciales del presupuesto");
        return;
      }
      const { data, error } = await supabase.functions.invoke("project-wizard-step", {
        body: {
          action: "generate_client_proposal",
          projectId,
          stepData: {
            commercial_terms_v1,
            projectName: project.name,
            companyName: project.company,
          },
        },
      });
      if (error) throw error;
      // Reload proposal from Step 30
      const { data: row } = await supabase
        .from("project_wizard_steps")
        .select("output_data, version")
        .eq("project_id", projectId)
        .eq("step_number", 30)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (row?.output_data) {
        const od = row.output_data as any;
        setProposalData({
          proposalMarkdown: od.proposal_markdown,
          client_proposal_v1: od.client_proposal_v1,
          proposal_meta: od.proposal_meta,
          version: row.version,
        });
      }
      toast.success("Propuesta cliente generada");
      if (data?.internal_jargon_warnings?.length > 0) {
        console.warn("[F7] Internal jargon warnings:", data.internal_jargon_warnings);
      }
      return data;
    } catch (e: any) {
      console.error("Generate client proposal error:", e);
      toast.error(e.message || "Error generando propuesta cliente");
    } finally {
      setProposalGenerating(false);
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
    normalizing,
    chainedPhase,
    prdSubProgress,
    internalStepStatuses,
    stepNames: STEP_NAMES,
    createWizardProject,
    runExtraction,
    retryFailedChunks,
    normalizeBrief,
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
    runChainedPRD,
    runPipelineV2PRD,
    updateStepOutputData,
    updateInputContent,
    budgetData,
    budgetGenerating,
    budgetStatus,
    approveBudget,
    generateBudgetEstimate,
    updateBudgetData,
    proposalData,
    proposalGenerating,
    generateClientProposal,
    updateProjectName,
  };
};
