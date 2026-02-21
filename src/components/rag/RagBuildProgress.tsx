import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, CheckCircle2, XCircle, Database, FileText, Variable, Target, AlertTriangle } from "lucide-react";
import type { RagProject } from "@/hooks/useRagArchitect";

interface RagBuildProgressProps {
  rag: RagProject;
}

const RESEARCH_LEVELS = ["surface", "academic", "datasets", "multimedia", "community", "frontier", "lateral"];

const levelLabels: Record<string, string> = {
  surface: "🌐 Superficie",
  academic: "🎓 Académico",
  datasets: "📊 Datasets",
  multimedia: "🎬 Multimedia",
  community: "👥 Comunidad",
  frontier: "🔬 Frontera",
  lateral: "🔀 Lateral",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "failed": return <XCircle className="h-4 w-4 text-red-400" />;
    default: return <div className="h-4 w-4 rounded-full border border-muted-foreground/30" />;
  }
}

function QualityBadge({ verdict }: { verdict: string | null }) {
  if (!verdict) return null;
  switch (verdict) {
    case "PRODUCTION_READY": return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">PRODUCTION READY</Badge>;
    case "GOOD_ENOUGH": return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">GOOD ENOUGH</Badge>;
    case "INCOMPLETE": return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">INCOMPLETE</Badge>;
    default: return null;
  }
}

export function RagBuildProgress({ rag }: RagBuildProgressProps) {
  const runs = rag.research_runs || [];
  const isActive = ["researching", "building", "domain_analysis"].includes(rag.status);

  // Group runs by subdomain
  const runsBySubdomain: Record<string, Array<Record<string, unknown>>> = {};
  for (const run of runs) {
    const sd = run.subdomain as string;
    if (!runsBySubdomain[sd]) runsBySubdomain[sd] = [];
    runsBySubdomain[sd].push(run);
  }

  return (
    <div className="space-y-4">
      {/* Overall progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <span className="font-semibold text-sm">
                {rag.status === "domain_analysis" ? "Analizando dominio..." :
                 rag.status === "researching" || rag.status === "building" ? "Construyendo RAG..." :
                 rag.status === "completed" ? "RAG Completado" :
                 rag.status === "failed" ? "Error" : rag.status}
              </span>
            </div>
            <QualityBadge verdict={rag.quality_verdict} />
          </div>
          <Progress value={rag.coverage_pct || 0} className="h-2 mb-3" />

          {/* Metrics */}
          <div className="grid grid-cols-4 gap-3">
            <div className="text-center">
              <Database className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{rag.total_sources}</div>
              <div className="text-xs text-muted-foreground">Fuentes</div>
            </div>
            <div className="text-center">
              <FileText className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{rag.total_chunks}</div>
              <div className="text-xs text-muted-foreground">Chunks</div>
            </div>
            <div className="text-center">
              <Variable className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{rag.total_variables}</div>
              <div className="text-xs text-muted-foreground">Variables</div>
            </div>
            <div className="text-center">
              <Target className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
              <div className="text-lg font-bold">{Math.round(rag.coverage_pct)}%</div>
              <div className="text-xs text-muted-foreground">Cobertura</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Research runs by subdomain */}
      {Object.keys(runsBySubdomain).length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progreso por Subdominio</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(runsBySubdomain).map(([subdomain, subRuns]) => (
              <div key={subdomain} className="space-y-1">
                <p className="text-xs font-semibold">{subdomain}</p>
                <div className="flex gap-1 flex-wrap">
                  {RESEARCH_LEVELS.map((level) => {
                    const run = subRuns.find((r) => r.research_level === level);
                    return (
                      <div key={level} className="flex items-center gap-1 text-xs px-2 py-1 bg-muted/30 rounded">
                        <StatusIcon status={(run?.status as string) || "pending"} />
                        <span>{levelLabels[level] || level}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Contradictions and gaps */}
      {(rag.contradictions_count || 0) > 0 && (
        <div className="flex items-center gap-2 text-xs text-yellow-400">
          <AlertTriangle className="h-3 w-3" />
          {rag.contradictions_count} contradicciones detectadas
        </div>
      )}
      {(rag.gaps_count || 0) > 0 && (
        <div className="flex items-center gap-2 text-xs text-orange-400">
          <AlertTriangle className="h-3 w-3" />
          {rag.gaps_count} gaps de cobertura
        </div>
      )}

      {/* Error */}
      {rag.error_log && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-xs text-red-400">
            <p className="font-semibold">Error:</p>
            <p>{rag.error_log}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
