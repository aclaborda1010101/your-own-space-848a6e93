import { useParams, useNavigate } from "react-router-dom";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { useProjectWizard } from "@/hooks/useProjectWizard";
import { ProjectWizardStepper } from "@/components/projects/wizard/ProjectWizardStepper";
import { ProjectWizardStep1 } from "@/components/projects/wizard/ProjectWizardStep1";
import { ProjectWizardStep2 } from "@/components/projects/wizard/ProjectWizardStep2";
import { ProjectWizardStep3 } from "@/components/projects/wizard/ProjectWizardStep3";
import { ProjectCostBadge } from "@/components/projects/wizard/ProjectCostBadge";
import { useState } from "react";

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
        <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <h1 className="text-2xl font-bold text-foreground">Nuevo Proyecto Wizard</h1>
      </div>
      <ProjectWizardStep1 onSubmit={handleCreate} saving={saving} />
    </main>
  );
};

const ProjectWizardEdit = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const {
    project, steps, costs, totalCost, currentStep,
    loading, generating,
    runExtraction, generateScope, approveStep, navigateToStep,
  } = useProjectWizard(id);

  if (loading) {
    return (
      <main className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  if (!project) {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <Breadcrumbs />
        <p className="text-muted-foreground">Proyecto no encontrado.</p>
        <Button variant="outline" onClick={() => navigate("/projects")}>Volver a proyectos</Button>
      </main>
    );
  }

  // Calculate max unlocked step
  const maxUnlocked = steps.reduce((max, s) => {
    if (s.status === "approved" && s.stepNumber > max) return s.stepNumber;
    return max;
  }, 0);

  const step2Data = steps.find(s => s.stepNumber === 2);
  const step3Data = steps.find(s => s.stepNumber === 3);

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/projects")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold text-foreground">{project.name}</h1>
            <p className="text-xs text-muted-foreground font-mono">{project.company} • Paso {currentStep}/9</p>
          </div>
        </div>
        <ProjectCostBadge totalCost={totalCost} costs={costs} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[220px_1fr] gap-6">
        {/* Stepper sidebar */}
        <Card className="border-border bg-card p-3">
          <ProjectWizardStepper
            steps={steps}
            currentStep={currentStep}
            onNavigate={navigateToStep}
            maxUnlockedStep={maxUnlocked}
          />
        </Card>

        {/* Step content */}
        <div>
          {currentStep === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-bold text-foreground">Entrada del Proyecto ✅</h2>
              <p className="text-sm text-muted-foreground">El proyecto ya fue creado. Navega al paso 2 para continuar.</p>
              <Button onClick={() => navigateToStep(2)}>Ir a Extracción →</Button>
            </div>
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
            />
          )}

          {currentStep === 3 && (
            <ProjectWizardStep3
              document={step3Data?.outputData?.document || null}
              generating={generating}
              onGenerate={async () => {
                const briefing = step2Data?.outputData;
                if (!briefing) {
                  return;
                }
                await generateScope(briefing, project.company);
              }}
              onApprove={() => approveStep(3)}
            />
          )}

          {currentStep > 3 && (
            <div className="flex flex-col items-center justify-center py-16 space-y-3">
              <p className="text-lg font-bold text-foreground">🔒 Paso bloqueado</p>
              <p className="text-sm text-muted-foreground">Este paso estará disponible en futuros sprints.</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
};

const ProjectWizardPage = () => {
  const { id } = useParams<{ id: string }>();

  if (id === "new") {
    return <ProjectWizardNew />;
  }
  return <ProjectWizardEdit />;
};

export default ProjectWizardPage;
