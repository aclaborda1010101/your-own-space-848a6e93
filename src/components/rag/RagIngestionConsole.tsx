import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, RefreshCw, Trash2, RotateCcw, ExternalLink, Shield, FlaskConical, Radio } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { RagProject } from "@/hooks/useRagArchitect";

interface RagIngestionConsoleProps {
  rag: RagProject;
}

interface SourceRow {
  id: string;
  source_name: string | null;
  source_url: string;
  source_type: string;
  tier: string;
  status: string;
  word_count: number | null;
  authority_score: number | null;
  evidence_level: string | null;
  peer_reviewed: boolean;
  error: Record<string, unknown> | null;
  created_at: string;
}

type JobStats = Record<string, number>;
type ExternalStats = Record<string, number>;

function TierBadge({ tier }: { tier: string }) {
  if (tier === "tier1_gold" || tier === "A") return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 text-[10px]">🥇 Gold</Badge>;
  if (tier === "tier2_silver" || tier === "B") return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px]">🥈 Silver</Badge>;
  return <Badge className="bg-muted/50 text-muted-foreground border-muted text-[10px]">🥉 Bronze</Badge>;
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NEW: "bg-muted/50 text-muted-foreground",
    PENDING: "bg-blue-500/20 text-blue-400",
    RUNNING: "bg-purple-500/20 text-purple-400",
    DONE: "bg-green-500/20 text-green-400",
    FAILED: "bg-red-500/20 text-red-400",
    DLQ: "bg-orange-500/20 text-orange-400",
    RETRY: "bg-yellow-500/20 text-yellow-400",
    PENDING_EXTERNAL: "bg-cyan-500/20 text-cyan-400",
    fetched: "bg-green-500/20 text-green-400",
    error: "bg-red-500/20 text-red-400",
  };
  return <Badge className={`${colors[status] || colors.NEW} text-[10px]`}>{status}</Badge>;
}

export function RagIngestionConsole({ rag }: RagIngestionConsoleProps) {
  const [sources, setSources] = useState<SourceRow[]>([]);
  const [jobStats, setJobStats] = useState<JobStats>({});
  const [externalStats, setExternalStats] = useState<ExternalStats>({});
  const [loadingSources, setLoadingSources] = useState(false);
  const [loadingStats, setLoadingStats] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [purging, setPurging] = useState(false);

  const invoke = useCallback(async (action: string, body: Record<string, unknown> = {}) => {
    const { data, error } = await supabase.functions.invoke("rag-architect", { body: { action, ...body } });
    if (error) throw error;
    if (data?.error) throw new Error(data.error);
    return data;
  }, []);

  const fetchSources = useCallback(async () => {
    setLoadingSources(true);
    try {
      const data = await invoke("fetch_sources", { ragId: rag.id });
      setSources(data.sources || []);
    } catch (err) {
      console.error("fetchSources error:", err);
    } finally {
      setLoadingSources(false);
    }
  }, [rag.id, invoke]);

  const fetchJobStats = useCallback(async () => {
    setLoadingStats(true);
    try {
      const data = await invoke("fetch_job_stats", { ragId: rag.id });
      setJobStats(data.stats || {});
    } catch (err) {
      console.error("fetchJobStats error:", err);
    } finally {
      setLoadingStats(false);
    }
  }, [rag.id, invoke]);

  const fetchExternalStats = useCallback(async () => {
    try {
      const { data } = await supabase.rpc("fetch_external_job_stats", { match_rag_id: rag.id });
      if (data) {
        const stats: ExternalStats = {};
        for (const row of data as Array<{ status: string; count: number }>) {
          stats[row.status] = Number(row.count);
        }
        setExternalStats(stats);
      }
    } catch (err) {
      console.error("fetchExternalStats error:", err);
    }
  }, [rag.id]);

  const retryDlq = async () => {
    setRetrying(true);
    try {
      const data = await invoke("retry_dlq", { ragId: rag.id });
      toast.success(`${data.retried} jobs DLQ reencolados`);
      await fetchJobStats();
    } catch (err) {
      toast.error("Error al reintentar DLQ");
    } finally {
      setRetrying(false);
    }
  };

  const purgeJobs = async () => {
    setPurging(true);
    try {
      const data = await invoke("purge_jobs", { ragId: rag.id });
      toast.success(`${data.purged} jobs archivados`);
      await fetchJobStats();
    } catch (err) {
      toast.error("Error al purgar jobs");
    } finally {
      setPurging(false);
    }
  };

  useEffect(() => {
    fetchSources();
    fetchJobStats();
    fetchExternalStats();
  }, [fetchSources, fetchJobStats, fetchExternalStats]);

  // Auto-refresh when jobs are active
  useEffect(() => {
    const hasActive = (jobStats.PENDING || 0) + (jobStats.RUNNING || 0) + (jobStats.RETRY || 0) > 0;
    const hasExternal = Object.values(externalStats).reduce((a, b) => a + b, 0) > 0;
    if (!hasActive && !hasExternal) return;
    const interval = setInterval(() => {
      fetchSources();
      fetchJobStats();
      fetchExternalStats();
    }, 5000);
    return () => clearInterval(interval);
  }, [jobStats, externalStats, fetchSources, fetchJobStats, fetchExternalStats]);

  const extPending = (externalStats.PENDING || 0) + (externalStats.RETRY || 0);
  const extRunning = externalStats.RUNNING || 0;
  const extDone = externalStats.DONE || 0;
  const extTotal = Object.values(externalStats).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-4">
      {/* Job Stats */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Pipeline de Jobs</CardTitle>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={() => { fetchSources(); fetchJobStats(); fetchExternalStats(); }} disabled={loadingSources || loadingStats}>
                <RefreshCw className={`h-3 w-3 ${loadingSources || loadingStats ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-6 gap-2 mb-3">
            {["PENDING", "RUNNING", "DONE", "FAILED", "DLQ", "RETRY"].map((status) => (
              <div key={status} className="text-center">
                <div className="text-lg font-bold">{jobStats[status] || 0}</div>
                <StatusBadge status={status} />
              </div>
            ))}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={retryDlq} disabled={retrying || !(jobStats.DLQ > 0)} className="text-xs">
              {retrying ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <RotateCcw className="h-3 w-3 mr-1" />}
              Retry DLQ ({jobStats.DLQ || 0})
            </Button>
            <Button variant="outline" size="sm" onClick={purgeJobs} disabled={purging || !(jobStats.DONE > 0)} className="text-xs">
              {purging ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Trash2 className="h-3 w-3 mr-1" />}
              Purge DONE ({jobStats.DONE || 0})
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* B4: External Worker Section */}
      {extTotal > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Radio className="h-4 w-4" />
                Worker Externo (Scraping)
              </CardTitle>
              {extRunning > 0 ? (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-[10px]">
                  <Loader2 className="h-2.5 w-2.5 animate-spin mr-1" />
                  Worker procesando
                </Badge>
              ) : extPending > 0 ? (
                <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px]">
                  Worker no conectado
                </Badge>
              ) : (
                <Badge className="bg-muted/50 text-muted-foreground text-[10px]">
                  Completado
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-2">
              <div className="text-center">
                <div className="text-lg font-bold">{extPending}</div>
                <span className="text-[10px] text-muted-foreground">Pendientes</span>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{extRunning}</div>
                <span className="text-[10px] text-muted-foreground">En curso</span>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{extDone}</div>
                <span className="text-[10px] text-muted-foreground">Completados</span>
              </div>
              <div className="text-center">
                <div className="text-lg font-bold">{externalStats.DLQ || 0}</div>
                <span className="text-[10px] text-muted-foreground">Fallidos</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Sources Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Fuentes ({sources.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="h-[300px]">
            <div className="space-y-0">
              {sources.map((src) => (
                <div key={src.id} className="flex items-center gap-2 px-4 py-2 border-b border-muted/20 text-xs hover:bg-muted/10">
                  <StatusBadge status={src.status} />
                  <TierBadge tier={src.tier} />
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium">{src.source_name || src.source_url}</p>
                    {src.source_url && (
                      <a href={src.source_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground flex items-center gap-0.5">
                        <span className="truncate max-w-[200px]">{src.source_url}</span>
                        <ExternalLink className="h-2.5 w-2.5 flex-shrink-0" />
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-muted-foreground">
                    {src.peer_reviewed && <Shield className="h-3 w-3 text-green-400" />}
                    {src.evidence_level && <FlaskConical className="h-3 w-3" />}
                    {src.word_count && <span>{src.word_count.toLocaleString()}w</span>}
                    {src.authority_score !== null && src.authority_score > 0 && (
                      <span className="text-yellow-400">{Number(src.authority_score).toFixed(1)}★</span>
                    )}
                  </div>
                </div>
              ))}
              {sources.length === 0 && !loadingSources && (
                <p className="text-center text-muted-foreground py-8 text-sm">No hay fuentes aún</p>
              )}
              {loadingSources && (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
