import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Loader2, ArrowLeft, Briefcase, Pencil, Rocket } from "lucide-react";
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
import { ProjectLaunchPanel } from "@/components/projects/wizard/ProjectLaunchPanel";
import { ProjectSaaSEvaluationPanel } from "@/components/projects/wizard/ProjectSaaSEvaluationPanel";
import { ProjectProposalExport } from "@/components/projects/wizard/ProjectProposalExport";
import { ChainedPRDProgress } from "@/components/projects/wizard/ChainedPRDProgress";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { PublishToForgeDialog } from "@/components/projects/wizard/PublishToForgeDialog";
import { useState, useRef } from "react";

const TOTAL_STEPS = 4;

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
  4: "Descripción MVP",
};

const ProjectWizardEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    project, steps, costs, totalCost, currentStep,
    loading, generating, chainedPhase,
    runExtraction, approveStep, navigateToStep, runGenericStep, runChainedPRD, updateStepOutputData,
    updateInputContent, updateProjectName,
    budgetData, budgetGenerating, generateBudgetEstimate, updateBudgetData,
  } = useProjectWizard(id);

  const [pricingMode, setPricingMode] = useState<'none' | 'custom' | 'full'>('none');
  const [exportMode, setExportMode] = useState<'client' | 'internal'>('client');
  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [forgeOpen, setForgeOpen] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

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
      <ProjectLiveSummaryPanel projectId={id!} />

      {/* Pipeline */}
      <CollapsibleCard
        id={`pipeline-${id}`}
        title="Pipeline del proyecto"
        icon={<Briefcase className="w-4 h-4 text-primary" />}
        defaultOpen={false}
        badge={
          <Badge variant="outline" className="text-[10px] px-2 py-0">
            Paso {currentStep}/{TOTAL_STEPS}
          </Badge>
        }
      >
        <div className="p-4">
          <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
            {/* Stepper sidebar */}
            <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
              <CardContent className="p-3">
                <ProjectWizardStepper
                  steps={steps}
                  currentStep={currentStep}
                  onNavigate={navigateToStep}
                  maxUnlockedStep={maxUnlocked}
                />
              </CardContent>
            </Card>

            {/* Step content */}
            <div className="min-w-0">
              {currentStep === 1 && (
                <ProjectWizardStep1Edit
                  inputContent={project.inputContent}
                  onUpdateContent={updateInputContent}
                  onGoToExtraction={() => navigateToStep(2)}
                  onReExtract={() => {
                    navigateToStep(2);
                    setTimeout(() => runExtraction(), 300);
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
                  onExtract={runExtraction}
                  onApprove={async (editedBriefing) => {
                    await approveStep(2, editedBriefing);
                  }}
                  projectId={id}
                  projectName={project.name}
                  company={project.company}
                  version={step2Data?.version || 1}
                />
              )}

              {currentStep === 3 && (
                <>
                  {/* Show chained progress when generating */}
                  {generating && chainedPhase !== "idle" && chainedPhase !== "done" ? (
                    <Card className="border-border/50">
                      <CardContent className="p-6">
                        <ChainedPRDProgress currentPhase={chainedPhase} />
                      </CardContent>
                    </Card>
                  ) : (
                    <ProjectWizardGenericStep
                      stepNumber={3}
                      stepName="PRD Técnico"
                      description="Genera internamente Alcance + Auditoría IA + PRD Técnico en una sola operación."
                      outputData={step3Data?.outputData || null}
                      generating={generating && (chainedPhase === "idle" || chainedPhase === "done")}
                      onGenerate={async () => {
                        await runChainedPRD(pricingMode);
                      }}
                      onApprove={async () => {
                        await approveStep(3);
                      }}
                      generateLabel="Generar PRD Técnico"
                      isMarkdown={true}
                      projectId={id}
                      projectName={project.name}
                      company={project.company}
                      version={step3Data?.version || 1}
                      onUpdateOutputData={(newData) => updateStepOutputData(3, newData)}
                      exportMode={exportMode}
                      onExportModeChange={setExportMode}
                      status={step3Data?.status}
                    />
                  )}
                </>
              )}

              {currentStep === 4 && (
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
                    await approveStep(4);
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
              )}
            </div>
          </div>
        </div>
      </CollapsibleCard>

      {/* SaaS Evaluation — right after pipeline */}
      <ProjectSaaSEvaluationPanel
        projectId={id!}
        projectName={project.name}
        company={project.company || ""}
      />

      {/* Publish to Expert Forge — after PRD (step 3) approved */}
      {steps.find(s => s.stepNumber === 3)?.status === "approved" && (() => {
        const sections: string[] = [];
        const step2Out = steps.find(s => s.stepNumber === 2)?.outputData;
        if (step2Out) {
          sections.push("# BRIEFING / EXTRACCIÓN\n\n" + (typeof step2Out === "string" ? step2Out : JSON.stringify(step2Out, null, 2)));
        }
        const step3Out = steps.find(s => s.stepNumber === 3)?.outputData;
        if (step3Out) {
          // Prepend interpretation contract if available, then forge spec
          const contractBlock = step3Out.interpretation_contract
            ? "# CONTRATO DE INTERPRETACIÓN\n\n" + step3Out.interpretation_contract + "\n\n---\n\n"
            : "";
          const forgeContent = step3Out.expert_forge_spec || step3Out.document || step3Out.content || JSON.stringify(step3Out, null, 2);
          sections.push(contractBlock + "# PRD TÉCNICO\n\n" + forgeContent);
        }
        const step4Out = steps.find(s => s.stepNumber === 4)?.outputData;
        if (step4Out) {
          sections.push("# DESCRIPCIÓN MVP\n\n" + (step4Out.document || step4Out.content || JSON.stringify(step4Out, null, 2)));
        }
        const fullDocumentText = sections.join("\n\n---\n\n");

        return (
          <>
            <div className="flex justify-end">
              <Button variant="outline" className="gap-2" onClick={() => setForgeOpen(true)}>
                <Rocket className="h-4 w-4" />
                Publicar en Expert Forge
              </Button>
            </div>
            <PublishToForgeDialog
              open={forgeOpen}
              onOpenChange={setForgeOpen}
              projectId={id!}
              projectName={project.name}
              projectDescription={project.company || ""}
              prdText={fullDocumentText}
            />
          </>
        );
      })()}

      {/* Budget panel — internal, only after step 3 (PRD) approved */}
      {steps.find(s => s.stepNumber === 3)?.status === "approved" && (
        <ProjectBudgetPanel
          projectId={id!}
          projectName={project.name}
          company={project.company || ""}
          budgetData={budgetData}
          generating={budgetGenerating}
          onGenerate={(models) => generateBudgetEstimate(models)}
          onBudgetUpdate={updateBudgetData}
        />
      )}

      {/* Unified client proposal — after budget exists */}
      {budgetData && steps.find(s => s.stepNumber === 3)?.status === "approved" && (
        <ProjectProposalExport
          projectId={id!}
          projectName={project.name}
          company={project.company || ""}
          steps={steps.map(s => ({
            stepNumber: s.stepNumber,
            outputData: s.outputData,
            status: s.status,
            version: s.version || 1,
          }))}
          budgetData={budgetData}
        />
      )}

      {/* Launch panel — after proposal */}
      <ProjectLaunchPanel
        projectId={id!}
        projectName={project.name}
        company={project.company || ""}
        steps={steps.map(s => ({
          stepNumber: s.stepNumber,
          outputData: s.outputData,
          status: s.status,
          version: s.version || 1,
        }))}
      />

      {/* Documents panel */}
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

      {/* Activity timeline — last */}
      <ProjectActivityTimeline projectId={id!} />
    </main>
  );
};

const ProjectWizardPage = () => {
  const { id } = useParams<{ id: string }>();
  if (id === "new") return <ProjectWizardNew />;
  return <ProjectWizardEdit />;
};

export default ProjectWizardPage;
