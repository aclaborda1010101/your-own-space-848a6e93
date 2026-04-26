import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Briefcase, Pencil } from "lucide-react";
import { cn } from "@/lib/utils";
import { useProjectWizard } from "@/hooks/useProjectWizard";
import { ProjectWizardStepper } from "@/components/projects/wizard/ProjectWizardStepper";
import { ProjectWizardStep1 } from "@/components/projects/wizard/ProjectWizardStep1";
import { ProjectWizardStep2 } from "@/components/projects/wizard/ProjectWizardStep2";
import { ProjectWizardGenericStep } from "@/components/projects/wizard/ProjectWizardGenericStep";
import { ProjectWizardStep1Edit } from "@/components/projects/wizard/ProjectWizardStep1Edit";
import { ProjectCostBadge } from "@/components/projects/wizard/ProjectCostBadge";
import { ProjectDocumentsPanel } from "@/components/projects/wizard/ProjectDocumentsPanel";
import { ProjectActivityTimeline } from "@/components/projects/wizard/ProjectActivityTimeline";
import { ProjectBudgetPanel } from "@/components/projects/wizard/ProjectBudgetPanel";
import { ProjectLiveSummaryPanel } from "@/components/projects/wizard/ProjectLiveSummaryPanel";
import { ProjectProposalExport } from "@/components/projects/wizard/ProjectProposalExport";
import { PricingModeSelector } from "@/components/projects/wizard/PricingModeSelector";
import { ChainedPRDProgress } from "@/components/projects/wizard/ChainedPRDProgress";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
// PublishToForgeDialog ahora vive dentro de ProjectProposalExport (Paso 5).
import { ManifestViewer } from "@/components/projects/wizard/ManifestViewer";
import { PipelineQAPanel } from "@/components/projects/wizard/PipelineQAPanel";
import { useState, useRef } from "react";
import { toast } from "sonner";

const TOTAL_STEPS = 5;
const TOTAL_PIPELINE_PHASES = 5;

const ProjectWizardNew = () => {
  const navigate = useNavigate();
  const { createWizardProject } = useProjectWizard();
  const [saving, setSaving] = useState(false);

  const handleCreate = async (data: any) => {
    setSaving(true);
    const result = await createWizardProject(data);
    setSaving(false);
    if (result) {
      navigate(`/projects/wizard/${result.id}`, { replace: true });
    }
  };

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="rounded-xl hover:bg-muted/50">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Nuevo Proyecto</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Paso 1 — Define el proyecto y sube material de entrada</p>
        </div>
      </div>
      <ProjectWizardStep1 onSubmit={handleCreate} saving={saving} />
    </main>
  );
};

const stepLabels: Record<number, string> = {
  1: "Entrada",
  2: "Briefing",
  3: "PRD Técnico",
  4: "Presupuesto",
  5: "Propuesta cliente",
};

const ProjectWizardEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    project, steps, costs, totalCost, currentStep,
    loading, generating, normalizing, chainedPhase, prdSubProgress, internalStepStatuses,
    runExtraction, retryFailedChunks, normalizeBrief, approveStep, navigateToStep, runGenericStep, runChainedPRD, runPipelineV2PRD, updateStepOutputData,
    updateInputContent, updateProjectName,
    budgetData, budgetGenerating, budgetStatus, generateBudgetEstimate, updateBudgetData, approveBudget,
    proposalData, proposalGenerating, generateClientProposal,
  } = useProjectWizard(id);

  const [pricingMode, setPricingMode] = useState<'none' | 'custom' | 'full'>('none');
  const [exportMode, setExportMode] = useState<'client' | 'internal'>('client');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  // forgeOpen movido a ProjectProposalExport (Paso 5).
  const [autoChainEnabled, setAutoChainEnabled] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = window.localStorage.getItem(`wizard-autochain-${id}`);
    return v === null ? true : v === "1";
  });
  const nameInputRef = useRef<HTMLInputElement>(null);

  const toggleAutoChain = (next: boolean) => {
    setAutoChainEnabled(next);
    if (typeof window !== "undefined" && id) {
      window.localStorage.setItem(`wizard-autochain-${id}`, next ? "1" : "0");
    }
  };

  if (loading) {
    return (
      <main className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Cargando proyecto...</p>
        </div>
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <Breadcrumbs />
        <Card className="border-dashed">
          <CardContent className="p-8 text-center space-y-3">
            <p className="text-muted-foreground">Proyecto no encontrado.</p>
            <Button variant="outline" onClick={() => navigate("/projects")}>Volver a proyectos</Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  const maxUnlocked = steps.reduce((max, s) => {
    if (s.status === "approved" && s.stepNumber > max) return s.stepNumber;
    return max;
  }, 0);

  const step2Data = steps.find(s => s.stepNumber === 2);
  const step3Data = steps.find(s => s.stepNumber === 3);
  const step4Data = steps.find(s => s.stepNumber === 4);
  const progress = ((currentStep - 1) / TOTAL_STEPS) * 100;

  // Extraer prdText y architecture_manifest del Paso 3 una sola vez (compartido por
  // Propuesta cliente → Expert Forge y por el visor de manifest en Avanzado / Interno).
  const { prdFullText, manifestData, prdApproved } = (() => {
    const step3 = step3Data;
    const step3Out = step3?.outputData as any;
    let fullText = "";
    let manifest: Record<string, unknown> | null = null;
    if (step3Out) {
      if (typeof step3Out === "string") {
        try {
          const parsed = JSON.parse(step3Out);
          fullText = parsed.document || parsed.content || parsed.text || step3Out;
          if (parsed.architecture_manifest) manifest = parsed.architecture_manifest;
        } catch {
          fullText = step3Out;
        }
      } else if (typeof step3Out === "object") {
        fullText = step3Out.document || step3Out.content || step3Out.text || "";
        if (typeof fullText === "object") fullText = JSON.stringify(fullText);
        if (!fullText || fullText.length < 100) fullText = JSON.stringify(step3Out);
        if (step3Out.architecture_manifest) manifest = step3Out.architecture_manifest as Record<string, unknown>;
      }
    }
    return {
      prdFullText: fullText,
      manifestData: manifest,
      prdApproved: step3?.status === "approved",
    };
  })();

  return (
    <main className="p-4 lg:p-6 space-y-5">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="rounded-lg shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-primary/80 to-primary/40 flex items-center justify-center shadow-sm shadow-primary/10 shrink-0">
            <Briefcase className="w-4 h-4 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            {editingName ? (
              <Input
                ref={nameInputRef}
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onBlur={() => {
                  if (draftName.trim() && draftName.trim() !== project.name) {
                    updateProjectName(draftName);
                  }
                  setEditingName(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    (e.target as HTMLInputElement).blur();
                  } else if (e.key === "Escape") {
                    setEditingName(false);
                  }
                }}
                className="text-lg font-bold h-8 px-2"
                autoFocus
              />
            ) : (
              <div className="flex items-center gap-1.5 group cursor-pointer" onClick={() => { setDraftName(project.name); setEditingName(true); }}>
                <h1 className="text-lg font-bold text-foreground truncate">{project.name}</h1>
                <Pencil className="w-3.5 h-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            )}
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {project.company && (
                <span className="text-xs text-muted-foreground">{project.company}</span>
              )}
              <Badge variant="outline" className="text-[10px] px-2 py-0 border-primary/20 text-primary">
                Paso {currentStep}/{TOTAL_STEPS} — {stepLabels[currentStep] || ""}
              </Badge>
            </div>
          </div>
        </div>
        <ProjectCostBadge totalCost={totalCost} costs={costs} />
      </div>

      {/* Progress bar */}
      <div className="relative">
        <div className="h-1 bg-muted/30 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between mt-1">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((step) => {
            const stepData = steps.find(s => s.stepNumber === step);
            const isCompleted = stepData?.status === "approved";
            const isCurrent = step === currentStep;
            return (
              <div
                key={step}
                className={cn(
                  "w-1.5 h-1.5 rounded-full transition-all",
                  isCompleted ? "bg-primary" : isCurrent ? "bg-primary animate-pulse" : "bg-muted-foreground/20"
                )}
              />
            );
          })}
        </div>
      </div>

      {/* Live Summary */}
      <ProjectLiveSummaryPanel
        projectId={id!}
        wizardSteps={steps}
        internalStepStatuses={internalStepStatuses}
      />

      {/* Auto-chain banner */}
      {(generating && chainedPhase !== "idle" && chainedPhase !== "done") && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-primary">Generando PRD automáticamente tras aprobar el Brief…</p>
            <p className="text-xs text-muted-foreground truncate">
              Fase: {chainedPhase} {prdSubProgress?.label ? `· ${prdSubProgress.label}` : ""}
            </p>
          </div>
        </div>
      )}
      {budgetGenerating && (
        <div className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5 flex items-center gap-3 text-sm">
          <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
          <p className="font-medium text-primary">Generando estimación de presupuesto automáticamente…</p>
        </div>
      )}

      {/* Auto-chain toggle */}
      <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoChainEnabled}
            onChange={(e) => toggleAutoChain(e.target.checked)}
            className="w-3.5 h-3.5 rounded border-border accent-primary"
          />
          <span>Encadenar automáticamente PRD + Presupuesto al aprobar Brief</span>
        </label>
      </div>

      {/* Pipeline — sidebar fija + contenido */}
      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] gap-6">
        {/* Stepper sidebar — siempre visible */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm h-fit lg:sticky lg:top-4">
          <CardContent className="p-3">
            <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
              <Briefcase className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-semibold text-foreground">Pipeline del proyecto</p>
            </div>
            <ProjectWizardStepper
              steps={steps}
              currentStep={currentStep}
              onNavigate={(step) => {
                if (step === 4) {
                  document
                    .getElementById("budget-internal-card")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                if (step === 5) {
                  document
                    .getElementById("proposal-export-card")
                    ?.scrollIntoView({ behavior: "smooth", block: "start" });
                  return;
                }
                navigateToStep(step);
              }}
              maxUnlockedStep={maxUnlocked}
              chainedPhase={chainedPhase}
              internalStepStatuses={internalStepStatuses}
            />
          </CardContent>
        </Card>

        {/* Step content */}
        <div className="min-w-0 space-y-4">
          {currentStep === 1 && (
            <ProjectWizardStep1Edit
              inputContent={project.inputContent}
              onUpdateContent={updateInputContent}
              onGoToExtraction={() => navigateToStep(2)}
              onReExtract={(freshContent) => {
                navigateToStep(2);
                // Pasamos contenido fresco explícitamente para evitar el race con setProject
                runExtraction(freshContent);
              }}
              hasExistingBriefing={!!steps.find(s => s.stepNumber === 2)?.outputData}
              generating={generating}
            />
          )}

          {currentStep === 2 && (
            <ProjectWizardStep2
              inputContent={project.inputContent}
              briefing={step2Data?.outputData || null}
              generating={generating}
              normalizing={normalizing}
              onExtract={() => runExtraction(undefined, { forceRefresh: true })}
              onForceFullExtract={() => runExtraction(undefined, { skipSampler: true, forceRefresh: true })}
              onChunkedReExtract={() => runExtraction(undefined, { chunkedExtraction: true, forceRefresh: true })}
              onRetryFailedChunks={retryFailedChunks}
              onNormalizeBrief={normalizeBrief}
              onApprove={async (editedBriefing) => {
                await approveStep(2, editedBriefing, { autoChain: autoChainEnabled });
              }}
              projectId={id}
              projectName={project.name}
              company={project.company}
              version={step2Data?.version || 1}
            />
          )}

          {currentStep === 3 && (
            <>
              {generating && chainedPhase !== "idle" && chainedPhase !== "done" ? (
                <Card className="border-border/50">
                  <CardContent className="p-6">
                    <ChainedPRDProgress currentPhase={chainedPhase} prdSubProgress={prdSubProgress} />
                  </CardContent>
                </Card>
              ) : (
                <div className="space-y-4">
                  <PricingModeSelector
                    value={pricingMode}
                    onChange={setPricingMode}
                    disabled={generating}
                  />

                  {/* Aviso si el contenido actual NO viene del pipeline v2 */}
                  {step3Data?.outputData &&
                    (step3Data.outputData as any)?.source !== "pipeline_v2" && (
                      <Card className="border-amber-500/50 bg-amber-500/5">
                        <CardContent className="p-4 flex items-start gap-3">
                          <div className="text-amber-600 text-sm">⚠️</div>
                          <div className="flex-1 space-y-1">
                            <p className="text-sm font-semibold text-amber-700">
                              Este PRD viene del pipeline antiguo
                            </p>
                            <p className="text-xs text-muted-foreground">
                              El documento actual no se generó desde Step 28
                              (<code className="text-[10px]">scope_architecture_v1</code>).
                              Pulsa <strong>"Generar PRD Técnico (v2)"</strong> para crear el PRD
                              correcto basado en el alcance aprobado antes de descargarlo o
                              enviarlo a Lovable. La descarga PDF está bloqueada hasta entonces.
                            </p>
                          </div>
                        </CardContent>
                      </Card>
                    )}

                  <ProjectWizardGenericStep
                    stepNumber={3}
                    stepName="PRD Técnico (Lovable)"
                    description="PRD técnico determinista generado desde Step 28 (scope_architecture_v1). Pipeline v2: registro → gaps → viabilidad → arquitectura → PRD. Sin LLM, sin SQL inventado."
                    outputData={step3Data?.outputData || null}
                    generating={generating && (chainedPhase === "idle" || chainedPhase === "done")}
                    onGenerate={async () => {
                      await runPipelineV2PRD(pricingMode);
                    }}
                    onApprove={async () => {
                      await approveStep(3, undefined, { autoChain: autoChainEnabled });
                    }}
                    generateLabel="Generar PRD Técnico (v2)"
                    isMarkdown={true}
                    projectId={id}
                    projectName={project.name}
                    company={project.company}
                    version={step3Data?.version || 1}
                    onUpdateOutputData={(newData) => updateStepOutputData(3, newData)}
                    exportMode="internal"
                    onExportModeChange={setExportMode}
                    status={step3Data?.status}
                    isPipelineV2={(step3Data?.outputData as any)?.source === "pipeline_v2"}
                  />
                </div>
              )}
            </>
          )}

          {/*
            Paso 4 (Descripción MVP) movido a la sección "Avanzado / Interno":
            no es parte del flujo comercial principal y se solapa con el PRD y
            la propuesta cliente. Sigue accesible desde abajo.
          */}
        </div>
      </div>


      {/* Paso 4 — Budget panel — disponible cuando exista el PRD (aprobado o no) */}
      {(() => {
        const hasPRD = !!step3Data?.outputData;
        if (!hasPRD) return null;
        return (
          <div id="budget-internal-card" className="space-y-2 scroll-mt-4">
            {!prdApproved && (
              <div className="text-xs text-muted-foreground border border-dashed border-border/40 rounded-md px-3 py-2 bg-muted/20">
                El PRD aún no está aprobado. Puedes ir trabajando el presupuesto; al aprobar el PRD se incorporará automáticamente al pipeline.
              </div>
            )}
            <ProjectBudgetPanel
              projectId={id!}
              projectName={project.name}
              company={project.company || ""}
              budgetData={budgetData}
              generating={budgetGenerating}
              budgetStatus={budgetStatus}
              onGenerate={(models) => generateBudgetEstimate(models)}
              onBudgetUpdate={updateBudgetData}
              onApprove={() => approveBudget({ autoChain: autoChainEnabled })}
            />
          </div>
        );
      })()}

      {/* Paso 5 — Propuesta cliente (F7) + Expert Forge — disponible cuando exista presupuesto */}
      {budgetData && step3Data?.outputData && (() => {
        const budgetApproved = budgetStatus === "approved";
        return (
          <div id="proposal-export-card" className="space-y-2 scroll-mt-4">
            {!budgetApproved && (
              <div className="text-xs text-muted-foreground border border-dashed border-border/40 rounded-md px-3 py-2 bg-muted/20">
                El presupuesto aún no está aprobado. Puedes generar la propuesta en borrador para revisar antes de cerrarla.
              </div>
            )}
            <ProjectProposalExport
              projectId={id!}
              projectName={project.name}
              company={project.company || ""}
              budgetStatus={budgetStatus}
              proposalData={proposalData}
              proposalGenerating={proposalGenerating}
              onGenerate={generateClientProposal}
              prdText={prdFullText}
              architectureManifest={manifestData}
              prdApproved={prdApproved}
            />
          </div>
        );
      })()}

      {/* Avanzado / Interno — colapsado por defecto */}
      <CollapsibleCard
        id={`advanced-internal-${id}`}
        title="Avanzado / Interno"
        icon={<Briefcase className="w-4 h-4 text-muted-foreground" />}
        defaultOpen={false}
        badge={
          <Badge variant="outline" className="text-[10px] px-2 py-0 border-amber-500/30 text-amber-600 bg-amber-500/5">
            USO INTERNO
          </Badge>
        }
      >
        <div className="p-4 space-y-4">
          {/* QA · Pipeline v2 — herramienta de debug */}
          {id && <PipelineQAPanel projectId={id} />}

          {/* Visor del manifest de arquitectura (lectura) — sin botón Forge,
              que ahora vive en el card de Paso 5 · Propuesta cliente. */}
          {prdApproved && manifestData && (
            <div className="space-y-2">
              <div className="flex justify-end items-center gap-2 text-xs text-muted-foreground">
                <span>{prdFullText.length.toLocaleString()} chars</span>
                <span className="text-primary">📋 Manifest incluido</span>
              </div>
              <ManifestViewer manifest={manifestData} />
            </div>
          )}

          {/* Descripción MVP (opcional) — fuera del flujo comercial principal */}
          {step3Data?.outputData && (
            <div className="border-t border-border/40 pt-4">
              <p className="text-[11px] text-muted-foreground mb-2">
                Descripción MVP — opcional. El alcance ya está cubierto por el PRD y la propuesta cliente.
              </p>
              <ProjectWizardGenericStep
                stepNumber={4}
                stepName="Descripción MVP"
                description="Genera una descripción detallada del Minimum Viable Product con funcionalidades core, criterios de éxito y plan de lanzamiento."
                outputData={step4Data?.outputData || null}
                generating={generating}
                onGenerate={async () => {
                  await runGenericStep(4, "generate_mvp");
                }}
                onApprove={async () => {
                  await approveStep(4, undefined, { autoChain: autoChainEnabled });
                }}
                generateLabel="Generar Descripción MVP"
                isMarkdown={true}
                projectId={id}
                projectName={project.name}
                company={project.company}
                version={step4Data?.version || 1}
                onUpdateOutputData={(newData) => updateStepOutputData(4, newData)}
                exportMode={exportMode}
                onExportModeChange={setExportMode}
                status={step4Data?.status}
              />
            </div>
          )}

          <ProjectDocumentsPanel
            projectId={id!}
            projectName={project.name}
            company={project.company}
            steps={steps.map(s => ({
              stepNumber: s.stepNumber,
              outputData: s.outputData,
              status: s.status,
              version: s.version || 1,
            }))}
          />

          <ProjectActivityTimeline projectId={id!} />
        </div>
      </CollapsibleCard>
    </main>
  );
};

const ProjectWizardPage = () => {
  const { id } = useParams<{ id: string }>();
  if (id === "new") return <ProjectWizardNew />;
  return <ProjectWizardEdit />;
};

export default ProjectWizardPage;
