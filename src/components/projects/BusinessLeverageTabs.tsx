import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessLeverage } from "@/hooks/useBusinessLeverage";
import { QuestionnaireTab } from "./QuestionnaireTab";
import { DiagnosticTab } from "./DiagnosticTab";
import { RecommendationsTab } from "./RecommendationsTab";
import { RoadmapTab } from "./RoadmapTab";
import { AuditFinalDocTab } from "./AuditFinalDocTab";
import { ClipboardList, Activity, Layers, FileText, FileCheck, Loader2 } from "lucide-react";

interface Props {
  auditId: string;
  projectSector?: string;
  projectSize?: string;
  auditName?: string;
}

export const BusinessLeverageTabs = ({ auditId, projectSector, projectSize, auditName }: Props) => {
  const {
    loading, initialLoading, questionnaire, responses, diagnostic, recommendations, roadmap,
    loadExisting, generateQuestionnaire, regenerateQuestionnaire, saveResponses, analyzeResponses,
    generateRecommendations, generateRoadmap,
  } = useBusinessLeverage(auditId);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span className="text-sm">Cargando datos guardados…</span>
      </div>
    );
  }

  return (
    <Tabs defaultValue="questionnaire" className="w-full">
      <TabsList className="bg-muted/30 border border-border w-full justify-start overflow-x-auto">
        <TabsTrigger value="questionnaire" className="gap-1 text-xs">
          <ClipboardList className="w-3.5 h-3.5" /> Cuestionario
        </TabsTrigger>
        <TabsTrigger value="diagnostic" className="gap-1 text-xs">
          <Activity className="w-3.5 h-3.5" /> Radiografía
        </TabsTrigger>
        <TabsTrigger value="recommendations" className="gap-1 text-xs">
          <Layers className="w-3.5 h-3.5" /> Plan por Capas
        </TabsTrigger>
        <TabsTrigger value="roadmap" className="gap-1 text-xs">
          <FileText className="w-3.5 h-3.5" /> Roadmap
        </TabsTrigger>
        <TabsTrigger value="final-doc" className="gap-1 text-xs">
          <FileCheck className="w-3.5 h-3.5" /> Documento Final
        </TabsTrigger>
      </TabsList>

      <TabsContent value="questionnaire" className="mt-4">
        <QuestionnaireTab
          auditId={auditId}
          projectSector={projectSector}
          projectSize={projectSize}
          questionnaire={questionnaire}
          responses={responses}
          loading={loading}
          onGenerate={generateQuestionnaire}
          onSaveResponses={saveResponses}
          onAnalyze={analyzeResponses}
          onRegenerate={regenerateQuestionnaire}
        />
      </TabsContent>

      <TabsContent value="diagnostic" className="mt-4">
        <DiagnosticTab diagnostic={diagnostic} />
      </TabsContent>

      <TabsContent value="recommendations" className="mt-4">
        <RecommendationsTab
          recommendations={recommendations}
          hasDiagnostic={!!diagnostic}
          loading={loading}
          onGenerate={generateRecommendations}
        />
      </TabsContent>

      <TabsContent value="roadmap" className="mt-4">
        <RoadmapTab
          roadmap={roadmap}
          hasRecommendations={recommendations.length > 0}
          loading={loading}
          onGenerate={generateRoadmap}
        />
      </TabsContent>

      <TabsContent value="final-doc" className="mt-4">
        <AuditFinalDocTab
          auditId={auditId}
          auditName={auditName}
          questionnaire={questionnaire}
          responses={responses}
          diagnostic={diagnostic}
          recommendations={recommendations}
          roadmap={roadmap}
          loading={loading}
        />
      </TabsContent>
    </Tabs>
  );
};
