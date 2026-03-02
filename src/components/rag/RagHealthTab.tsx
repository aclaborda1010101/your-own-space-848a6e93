import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Database, FileText, Variable, GitBranch, Loader2 } from "lucide-react";
import type { RagProject } from "@/hooks/useRagArchitect";

interface HealthMetric {
  label: string;
  value: string;
  status: "green" | "yellow" | "red";
  icon: React.ReactNode;
}

interface RagHealthTabProps {
  rag: RagProject;
}

export function RagHealthTab({ rag }: RagHealthTabProps) {
  const [metrics, setMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [qualityDetails, setQualityDetails] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    const fetchHealth = async () => {
      setLoading(true);
      try {
        const [
          { count: totalSources },
          { count: totalChunks },
          { count: goldSources },
          { count: kgNodes },
          { count: kgEdges },
          { data: variables },
          { data: qcData },
        ] = await Promise.all([
          supabase.from("rag_sources" as any).select("*", { count: "exact", head: true }).eq("rag_id", rag.id),
          supabase.from("rag_chunks" as any).select("*", { count: "exact", head: true }).eq("rag_id", rag.id),
          supabase.from("rag_sources" as any).select("*", { count: "exact", head: true }).eq("rag_id", rag.id).in("tier", ["tier1_gold", "A"]),
          supabase.from("rag_knowledge_graph_nodes" as any).select("*", { count: "exact", head: true }).eq("rag_id", rag.id),
          supabase.from("rag_knowledge_graph_edges" as any).select("*", { count: "exact", head: true }).eq("rag_id", rag.id),
          supabase.from("rag_variables" as any).select("confidence").eq("rag_id", rag.id),
          supabase.from("rag_quality_checks" as any).select("details, verdict, score").eq("rag_id", rag.id).eq("check_type", "quality_gate").order("created_at", { ascending: false }).limit(1),
        ]);

        const chunksPerSource = (totalSources || 1) > 0 ? (totalChunks || 0) / (totalSources || 1) : 0;
        const goldPct = (totalSources || 0) > 0 ? ((goldSources || 0) / (totalSources || 1)) * 100 : 0;
        const edgesPerNode = (kgNodes || 1) > 0 ? (kgEdges || 0) / (kgNodes || 1) : 0;
        const avgConf = variables && variables.length > 0
          ? variables.reduce((s: number, v: any) => s + (v.confidence || 0), 0) / variables.length
          : 0;
        const varsPerHundred = (totalChunks || 0) > 0 ? ((variables?.length || 0) / (totalChunks || 1)) * 100 : 0;

        const qcArr = qcData as any;
        if (qcArr && Array.isArray(qcArr) && qcArr.length > 0) {
          setQualityDetails(qcArr[0].details as Record<string, unknown>);
        }

        setMetrics([
          {
            label: "Chunks / Fuente",
            value: chunksPerSource.toFixed(1),
            status: chunksPerSource >= 5 ? "green" : chunksPerSource >= 2 ? "yellow" : "red",
            icon: <FileText className="h-4 w-4" />,
          },
          {
            label: "% Gold Sources",
            value: `${Math.round(goldPct)}%`,
            status: goldPct >= 30 ? "green" : goldPct >= 15 ? "yellow" : "red",
            icon: <Database className="h-4 w-4" />,
          },
          {
            label: "KG Nodos / Edges",
            value: `${kgNodes || 0} / ${kgEdges || 0}`,
            status: (kgNodes || 0) > 10 && edgesPerNode >= 1.5 ? "green" : (kgNodes || 0) > 0 ? "yellow" : "red",
            icon: <GitBranch className="h-4 w-4" />,
          },
          {
            label: "Variables / 100 chunks",
            value: varsPerHundred.toFixed(1),
            status: varsPerHundred >= 5 ? "green" : varsPerHundred >= 2 ? "yellow" : "red",
            icon: <Variable className="h-4 w-4" />,
          },
          {
            label: "Confianza Variables (avg)",
            value: `${Math.round(avgConf * 100)}%`,
            status: avgConf >= 0.6 ? "green" : avgConf >= 0.4 ? "yellow" : "red",
            icon: <Activity className="h-4 w-4" />,
          },
        ]);
      } catch (err) {
        console.error("Error fetching health metrics:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchHealth();
  }, [rag.id]);

  const statusColor = {
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border-red-500/30",
  };

  const statusDot = {
    green: "bg-green-400",
    yellow: "bg-yellow-400",
    red: "bg-red-400",
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Activity className="h-4 w-4" /> Dashboard de Salud del RAG
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {metrics.map((m, i) => (
            <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${statusDot[m.status]}`} />
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  {m.icon} {m.label}
                </span>
              </div>
              <Badge variant="outline" className={`text-xs ${statusColor[m.status]}`}>
                {m.value}
              </Badge>
            </div>
          ))}
        </CardContent>
      </Card>

      {qualityDetails && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Quality Gate Details</CardTitle>
          </CardHeader>
          <CardContent className="text-xs space-y-1 text-muted-foreground">
            <p>Fitness Score: <span className="font-semibold text-foreground">{qualityDetails.fitness_score as number}/100</span></p>
            <p>Queries evaluadas: {qualityDetails.queries_evaluated as number}</p>
            {qualityDetails.kg_nodes !== undefined && (
              <p>KG: {qualityDetails.kg_nodes as number} nodos, {qualityDetails.kg_edges as number} edges ({qualityDetails.kg_edges_per_node as number} edges/nodo)</p>
            )}
            {qualityDetails.avg_variable_confidence !== undefined && (
              <p>Confianza media variables: {Math.round((qualityDetails.avg_variable_confidence as number) * 100)}%</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
