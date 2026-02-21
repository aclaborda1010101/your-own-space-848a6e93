import { useEffect } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBusinessLeverage } from "@/hooks/useBusinessLeverage";
import { QuestionnaireTab } from "./QuestionnaireTab";
import { DiagnosticTab } from "./DiagnosticTab";
import { RecommendationsTab } from "./RecommendationsTab";
import { RoadmapTab } from "./RoadmapTab";
import { ClipboardList, Activity, Layers, FileText } from "lucide-react";

interface Props {
  projectId: string;
  projectSector?: string;
  projectSize?: string;
}

export const BusinessLeverageTabs = ({ projectId, projectSector, projectSize }: Props) => {
  const {
    loading, questionnaire, responses, diagnostic, recommendations, roadmap,
    loadExisting, generateQuestionnaire, saveResponses, analyzeResponses,
    generateRecommendations, generateRoadmap,
  } = useBusinessLeverage(projectId);

  useEffect(() => {
    loadExisting();
  }, [loadExisting]);

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
      </TabsList>

      <TabsContent value="questionnaire" className="mt-4">
        <QuestionnaireTab
          projectSector={projectSector}
          projectSize={projectSize}
          questionnaire={questionnaire}
          responses={responses}
          loading={loading}
          onGenerate={generateQuestionnaire}
          onSaveResponses={saveResponses}
          onAnalyze={analyzeResponses}
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
    </Tabs>
  );
};
