import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, ArrowLeft, Briefcase } from "lucide-react";
import { useProjectWizard } from "@/hooks/useProjectWizard";
import { ProjectWizardStepper } from "@/components/projects/wizard/ProjectWizardStepper";
import { ProjectWizardStep1 } from "@/components/projects/wizard/ProjectWizardStep1";
import { ProjectWizardStep2 } from "@/components/projects/wizard/ProjectWizardStep2";
import { ProjectWizardStep3 } from "@/components/projects/wizard/ProjectWizardStep3";
import { ProjectWizardGenericStep } from "@/components/projects/wizard/ProjectWizardGenericStep";
import { ProjectDataSnapshot } from "@/components/projects/wizard/ProjectDataSnapshot";
import { ProjectCostBadge } from "@/components/projects/wizard/ProjectCostBadge";
import { ProjectDocumentsPanel } from "@/components/projects/wizard/ProjectDocumentsPanel";
import { ContradictionModal, type Contradiction } from "@/components/projects/wizard/ContradictionModal";
import { useState } from "react";
import { toast } from "sonner";

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
  1: "Entrada", 2: "Briefing", 3: "Borrador", 4: "Auditoría",
  5: "Doc. Final", 6: "Auditoría IA", 7: "PRD", 8: "Blueprint", 9: "RAG", 10: "Patrones",
};

const STEP_CONFIGS: Record<number, { action: string; label: string; description: string; isMarkdown: boolean }> = {
  4: { action: "run_audit", label: "Generar Auditoría", description: "Compara el borrador de alcance contra el material fuente original para detectar omisiones e inconsistencias.", isMarkdown: false },
  5: { action: "generate_final_doc", label: "Generar Documento Final", description: "Aplica las correcciones de la auditoría y genera la versión definitiva del Documento de Alcance.", isMarkdown: true },
  6: { action: "run_ai_leverage", label: "Generar Auditoría IA", description: "Identifica oportunidades concretas de IA con cálculos de ROI basados en datos reales del proyecto.", isMarkdown: false },
  7: { action: "generate_prd", label: "Generar PRD Técnico", description: "Genera un PRD completo con personas, modelo de datos, flujos y criterios de aceptación.", isMarkdown: true },
  8: { action: "generate_pattern_blueprint", label: "Generar Blueprint", description: "Ejecuta análisis de dominio y descubrimiento de fuentes para el detector de patrones. Si no se necesitan patrones, genera RAG genérico.", isMarkdown: false },
  9: { action: "generate_rags", label: "Generar RAG Dirigido", description: "Genera un RAG dirigido con las variables y fuentes del blueprint de patrones.", isMarkdown: false },
  10: { action: "execute_patterns", label: "Ejecutar Patrones", description: "Ejecuta el detector de patrones sobre el RAG con datos reales.", isMarkdown: false },
};

const ProjectWizardEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    project, steps, costs, totalCost, currentStep,
    loading, generating,
    runExtraction, generateScope, approveStep, navigateToStep, runGenericStep, updateStepOutputData,
    dataProfile, setDataProfile, dataPhaseComplete, setDataPhaseComplete,
  } = useProjectWizard(id);

  const [pricingMode, setPricingMode] = useState<'none' | 'custom' | 'full'>('none');
  const [exportMode, setExportMode] = useState<'client' | 'internal'>('client');

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
  const progress = ((currentStep - 1) / 10) * 100;

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")} className="rounded-xl hover:bg-muted/50 shrink-0">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20 shrink-0">
            <Briefcase className="w-5 h-5 text-primary-foreground" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground truncate">{project.name}</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              {project.company && (
                <span className="text-xs text-muted-foreground">{project.company}</span>
              )}
              <span className="text-xs text-muted-foreground">·</span>
              <Badge variant="outline" className="text-[11px] px-2 py-0">
                Paso {currentStep}/10 — {stepLabels[currentStep] || ""}
              </Badge>
            </div>
          </div>
        </div>
        <ProjectCostBadge totalCost={totalCost} costs={costs} />
      </div>

      {/* Mini progress bar */}
      <div className="h-1 bg-muted/40 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-primary/60 rounded-full transition-all duration-700"
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
        {/* Stepper sidebar */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          <CardContent className="p-3">
            {(() => {
              const step6Out = steps.find(s => s.stepNumber === 6)?.outputData;
              const sd = step6Out?.services_decision;
              const needsData = sd?.rag?.necesario || sd?.pattern_detector?.necesario;
              const dataSubStep = needsData
                ? { visible: true, active: currentStep === 7 && !dataPhaseComplete, complete: currentStep === 7 ? dataPhaseComplete : currentStep > 7 }
                : { visible: false, active: false, complete: false };
              return (
                <ProjectWizardStepper
                  steps={steps}
                  currentStep={currentStep}
                  onNavigate={navigateToStep}
                  maxUnlockedStep={maxUnlocked}
                  dataSubStep={dataSubStep}
                />
              );
            })()}
          </CardContent>
        </Card>

        {/* Step content */}
        <div className="min-w-0">
          {currentStep === 1 && (
            <Card className="border-border/50">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-14 h-14 rounded-2xl bg-green-500/10 flex items-center justify-center mx-auto">
                  <span className="text-2xl">✅</span>
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">Entrada completada</h2>
                  <p className="text-sm text-muted-foreground mt-1">
                    El proyecto se ha creado correctamente. Continúa al paso 2 para extraer el briefing.
                  </p>
                </div>
                <Button onClick={() => navigateToStep(2)} className="gap-2">
                  Ir a Extracción <ArrowLeft className="w-4 h-4 rotate-180" />
                </Button>
              </CardContent>
            </Card>
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
            <ProjectWizardStep3
              document={step3Data?.outputData?.document || null}
              generating={generating}
              pricingMode={pricingMode}
              onPricingModeChange={setPricingMode}
              onGenerate={async () => {
                const briefing = step2Data?.outputData;
                if (!briefing) return;
                await generateScope(briefing, project.company, pricingMode);
              }}
              onApprove={(editedDoc?: string) => {
                if (editedDoc) {
                  approveStep(3, { document: editedDoc });
                } else {
                  approveStep(3);
                }
              }}
              projectId={id}
              projectName={project.name}
              company={project.company}
              version={step3Data?.version || 1}
            />
          )}

          {currentStep >= 4 && currentStep <= 10 && (() => {
            const config = STEP_CONFIGS[currentStep];
            const stepData = steps.find(s => s.stepNumber === currentStep);
            if (!config) return null;

            // Step 7: Show DataSnapshot sub-phase if services need data and not yet complete
            if (currentStep === 7 && !dataPhaseComplete) {
              const step6Data = steps.find(s => s.stepNumber === 6)?.outputData;
              const sd = step6Data?.services_decision;
              const needsData = sd?.rag?.necesario || sd?.pattern_detector?.necesario;
              if (needsData) {
                return (
                  <ProjectDataSnapshot
                    projectId={id!}
                    onComplete={(dp) => {
                      setDataProfile(dp);
                      setDataPhaseComplete(true);
                    }}
                    onSkip={() => setDataPhaseComplete(true)}
                  />
                );
              }
            }

            return (
              <ProjectWizardGenericStep
                stepNumber={currentStep}
                stepName={stepLabels[currentStep] || `Paso ${currentStep}`}
                description={config.description}
                outputData={stepData?.outputData || null}
                generating={generating}
                onGenerate={async () => {
                  await runGenericStep(currentStep, config.action);
                }}
                onApprove={() => approveStep(currentStep)}
                generateLabel={config.label}
                isMarkdown={config.isMarkdown}
                projectId={id}
                projectName={project.name}
                company={project.company}
                version={stepData?.version || 1}
                onUpdateOutputData={(newData) => updateStepOutputData(currentStep, newData)}
                exportMode={currentStep === 5 ? exportMode : undefined}
                onExportModeChange={currentStep === 5 ? setExportMode : undefined}
              />
            );
          })()}
        </div>
      </div>

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
    </main>
  );
};

const ProjectWizardPage = () => {
  const { id } = useParams<{ id: string }>();
  if (id === "new") return <ProjectWizardNew />;
  return <ProjectWizardEdit />;
};

export default ProjectWizardPage;
