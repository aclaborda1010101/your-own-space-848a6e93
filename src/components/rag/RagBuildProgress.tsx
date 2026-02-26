import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, CheckCircle2, XCircle, Database, FileText, Variable, Target, AlertTriangle, MessageSquare, Download, Key, ListChecks, RefreshCw } from "lucide-react";
import type { RagProject } from "@/hooks/useRagArchitect";
import { RagChat } from "./RagChat";
import { RagApiTab } from "./RagApiTab";
import { RagIngestionConsole } from "./RagIngestionConsole";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface RagBuildProgressProps {
  rag: RagProject;
  onQuery?: (ragId: string, question: string) => Promise<unknown>;
  onExport?: (ragId: string, format: string) => Promise<unknown>;
  onResume?: (ragId: string) => Promise<unknown>;
  onRegenerateEnrichment?: (ragId: string, step?: string) => Promise<unknown>;
}

const RESEARCH_LEVELS = ["surface", "academic", "datasets", "multimedia", "community", "frontier", "lateral"];

const levelLabels: Record<string, string> = {
  surface: "Superficie",
  academic: "Académico",
  datasets: "Datasets",
  multimedia: "Multimedia",
  community: "Comunidad",
  frontier: "Frontera",
  lateral: "Lateral",
};

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "completed": return <CheckCircle2 className="h-4 w-4 text-green-400" />;
    case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-400" />;
    case "partial": return <Loader2 className="h-4 w-4 text-yellow-400" />;
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

/** Build fixed grid from domain_map.subdomains × 7 levels, using latest run status per cell */
function buildSubdomainGrid(rag: RagProject) {
  const runs = rag.research_runs || [];
  const domainMap = rag.domain_map as Record<string, unknown> | null;
  const subdomains: string[] = [];

  // Extract subdomain names from domain_map (source of truth)
  if (domainMap?.subdomains && Array.isArray(domainMap.subdomains)) {
    for (const sub of domainMap.subdomains as Array<Record<string, unknown>>) {
      const name = (sub.name_technical || sub.name || sub.nombre) as string;
      if (name) subdomains.push(name);
    }
  }

  // Fallback: extract unique subdomains from runs if domain_map is empty
  if (subdomains.length === 0) {
    const seen = new Set<string>();
    for (const run of runs) {
      const sd = run.subdomain as string;
      if (sd && !seen.has(sd)) { seen.add(sd); subdomains.push(sd); }
    }
  }

  // Build latest run map
  const latestByCell = new Map<string, Record<string, unknown>>();
  for (const r of runs) {
    const key = `${r.subdomain}|${r.research_level}`;
    const prev = latestByCell.get(key);
    if (!prev || new Date(r.created_at as string) > new Date(prev.created_at as string)) {
      latestByCell.set(key, r);
    }
  }

  return { subdomains, latestByCell };
}

export function RagBuildProgress({ rag, onQuery, onExport, onResume, onRegenerateEnrichment }: RagBuildProgressProps) {
  const [exporting, setExporting] = useState(false);
  const [resuming, setResuming] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [kgNodeCount, setKgNodeCount] = useState<number>(0);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isActive = ["researching", "building", "domain_analysis"].includes(rag.status);
  const isCompleted = rag.status === "completed";

  // Build the fixed grid
  const { subdomains, latestByCell } = buildSubdomainGrid(rag);

  // Load initial KG node count & cleanup polling on unmount
  useEffect(() => {
    const fetchCount = async () => {
      const { count } = await supabase
        .from('rag_knowledge_graph_nodes' as any)
        .select('*', { count: 'exact', head: true })
        .eq('rag_id', rag.id);
      setKgNodeCount(count || 0);
    };
    fetchCount();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [rag.id]);

  const handleRegenerateKG = useCallback(async () => {
    if (!onRegenerateEnrichment) return;

    // Auth check
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      toast.error("Debes iniciar sesión para regenerar el Knowledge Graph");
      return;
    }

    setIsRegenerating(true);
    toast.info("Regeneración del Knowledge Graph iniciada. Este proceso tarda ~60 segundos.", { duration: 10000 });

    try {
      await onRegenerateEnrichment(rag.id, "knowledge_graph");
    } catch {
      toast.error("Error al invocar regeneración");
      setIsRegenerating(false);
      return;
    }

    // Start polling
    let pollCount = 0;
    let prevCount = 0;
    const maxPolls = 12;

    pollRef.current = setInterval(async () => {
      pollCount++;
      const { count } = await supabase
        .from('rag_knowledge_graph_nodes' as any)
        .select('*', { count: 'exact', head: true })
        .eq('rag_id', rag.id);
      const current = count || 0;
      setKgNodeCount(current);

      // Stable & has nodes after 30s+ → done
      if (current > 0 && pollCount > 3 && current === prevCount) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        toast.success(`Knowledge Graph completado: ${current} nodos creados`);
        setIsRegenerating(false);
      }

      // Timeout
      if (pollCount >= maxPolls) {
        if (pollRef.current) clearInterval(pollRef.current);
        pollRef.current = null;
        if (current === 0) {
          toast.error("El proceso tardó más de lo esperado. Revisa los logs de la Edge Function.");
        } else {
          toast.success(`Knowledge Graph: ${current} nodos creados`);
        }
        setIsRegenerating(false);
      }

      prevCount = current;
    }, 10000);
  }, [rag.id, onRegenerateEnrichment]);

  const handleExport = async () => {
    if (!onExport) return;
    setExporting(true);
    try {
      const result = await onExport(rag.id, "document_md") as { markdown: string };
      // Download as file
      const blob = new Blob([result.markdown], { type: "text/markdown" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `RAG_${rag.domain_description.slice(0, 30).replace(/\s+/g, "_")}.md`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Documento exportado");
    } catch {
      toast.error("Error al exportar");
    } finally {
      setExporting(false);
    }
  };

  const progressContent = (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isActive && <Loader2 className="h-4 w-4 animate-spin text-primary" />}
              <span className="font-semibold text-sm">
                {rag.status === "domain_analysis" ? "Analizando dominio..." :
                 rag.status === "researching" || rag.status === "building" ? "Construyendo RAG..." :
                 rag.status === "post_processing" ? "Post-procesando..." :
                 rag.status === "completed" ? "RAG Completado" :
                 rag.status === "failed" ? "Error" : rag.status}
              </span>
            </div>
            <QualityBadge verdict={rag.quality_verdict} />
          </div>
          <Progress value={isCompleted ? 100 : (rag.coverage_pct || 0)} className="h-2 mb-3" />
          {isCompleted && rag.coverage_pct < 100 && (
            <p className="text-xs text-muted-foreground mb-2">
              Cobertura temática real: {Math.round(rag.coverage_pct)}%
            </p>
          )}
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

      {/* Fixed 11×7 grid: always show ALL subdomains from domain_map */}
      {subdomains.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Progreso por Subdominio ({subdomains.length} subdominios × {RESEARCH_LEVELS.length} niveles)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {subdomains.map((subdomain) => (
              <div key={subdomain} className="space-y-1">
                <p className="text-xs font-semibold">{subdomain}</p>
                <div className="flex gap-1 flex-wrap">
                  {RESEARCH_LEVELS.map((level) => {
                    const key = `${subdomain}|${level}`;
                    const latest = latestByCell.get(key);
                    const status = (latest?.status as string) || "pending";
                    return (
                      <div key={level} className="flex items-center gap-1 text-xs px-2 py-1 bg-muted/30 rounded">
                        <StatusIcon status={status} />
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

      {rag.error_log && (
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-3 text-xs text-red-400">
            <p className="font-semibold">Error:</p>
            <p>{rag.error_log}</p>
          </CardContent>
        </Card>
      )}

      {onResume && (rag.status === "failed" || rag.quality_verdict === "INCOMPLETE" ||
        (rag.status === "completed" && rag.coverage_pct < 90)) && (
        <Button
          variant="outline"
          size="sm"
          disabled={resuming}
          onClick={async () => {
            setResuming(true);
            try { await onResume(rag.id); } finally { setResuming(false); }
          }}
        >
          {resuming ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          Reanudar Ingesta
        </Button>
      )}

      {onRegenerateEnrichment && isCompleted && (
        <Button
          variant="outline"
          size="sm"
          disabled={isRegenerating || regenerating}
          onClick={handleRegenerateKG}
        >
          {isRegenerating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
          {isRegenerating
            ? `Regenerando... (${kgNodeCount} nodos)`
            : kgNodeCount > 0
              ? `Regenerar KG (${kgNodeCount} nodos)`
              : "Regenerar Knowledge Graph"
          }
        </Button>
      )}
    </div>
  );

  // If completed, show tabs
  if (isCompleted && onQuery) {
    return (
      <Tabs defaultValue="progress" className="w-full">
        <TabsList className="w-full">
          <TabsTrigger value="progress" className="flex-1 gap-1">
            <Target className="h-3 w-3" /> Progreso
          </TabsTrigger>
          <TabsTrigger value="chat" className="flex-1 gap-1">
            <MessageSquare className="h-3 w-3" /> Consultar
          </TabsTrigger>
          <TabsTrigger value="export" className="flex-1 gap-1">
            <Download className="h-3 w-3" /> Exportar
          </TabsTrigger>
          <TabsTrigger value="api" className="flex-1 gap-1">
            <Key className="h-3 w-3" /> API
          </TabsTrigger>
          <TabsTrigger value="ingestion" className="flex-1 gap-1">
            <ListChecks className="h-3 w-3" /> Ingestión
          </TabsTrigger>
        </TabsList>
        <TabsContent value="progress">{progressContent}</TabsContent>
        <TabsContent value="chat">
          <RagChat rag={rag} onQuery={onQuery as (ragId: string, question: string) => Promise<{ answer: string; sources: Array<{ subdomain: string; excerpt: string; metadata: unknown }>; confidence: number }>} />
        </TabsContent>
        <TabsContent value="export">
          <Card>
            <CardContent className="p-6 text-center space-y-4">
              <Download className="h-8 w-8 mx-auto text-muted-foreground" />
              <div>
                <h3 className="font-semibold">Exportar Base de Conocimiento</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Descarga todo el conocimiento del RAG como documento Markdown estructurado por taxonomía.
                </p>
              </div>
              <Button onClick={handleExport} disabled={exporting} className="bg-purple-600 hover:bg-purple-700">
                {exporting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                Descargar Markdown
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="api">
          <RagApiTab rag={rag} />
        </TabsContent>
        <TabsContent value="ingestion">
          <RagIngestionConsole rag={rag} />
        </TabsContent>
      </Tabs>
    );
  }

  return progressContent;
}
