import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { cn } from "@/lib/utils";
import {
  FolderSearch, Loader2, FileSpreadsheet, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, ExternalLink, ToggleLeft, ToggleRight,
  PauseCircle, PlayCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface DatasetFile {
  id: string;
  file_name: string;
  file_mime_type: string | null;
  file_size_bytes: number | null;
  relevance_score: number | null;
  relevance_reason: string | null;
  classification: string | null;
  status: string;
  error_message: string | null;
}

interface Props {
  runId: string;
  sector: string;
  businessObjective: string;
}

const classificationLabels: Record<string, string> = {
  financial_report: "Informe financiero",
  lease_contract: "Contrato de alquiler",
  traffic_study: "Estudio de tráfico",
  market_analysis: "Análisis de mercado",
  tenant_data: "Datos de inquilinos",
  demographic_data: "Datos demográficos",
  competitor_analysis: "Análisis competencia",
  operational_data: "Datos operativos",
  legal_document: "Doc. legal",
  marketing_material: "Material marketing",
  other: "Otro",
};

const statusConfig: Record<string, { icon: React.ReactNode; label: string; className: string }> = {
  pending: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Pendiente", className: "text-muted-foreground" },
  processing: { icon: <Loader2 className="w-3 h-3 animate-spin" />, label: "Procesando", className: "text-primary" },
  paused: { icon: <PauseCircle className="w-3 h-3" />, label: "Pausado", className: "text-amber-400" },
  relevant: { icon: <CheckCircle2 className="w-3 h-3" />, label: "Relevante", className: "text-green-400" },
  irrelevant: { icon: <XCircle className="w-3 h-3" />, label: "No relevante", className: "text-muted-foreground" },
  error: { icon: <AlertTriangle className="w-3 h-3" />, label: "Error", className: "text-red-400" },
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DatasetsDriveTab({ runId, sector, businessObjective }: Props) {
  const [driveUrl, setDriveUrl] = useState("");
  const [files, setFiles] = useState<DatasetFile[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, processing: 0, paused: 0, relevant: 0, irrelevant: 0, error: 0 });
  const [listing, setListing] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [polling, setPolling] = useState(false);
  const [resuming, setResuming] = useState(false);

  const fetchStatus = useCallback(async () => {
    const { data, error } = await supabase.functions.invoke("drive-folder-ingest", {
      body: { action: "get_status", run_id: runId },
    });
    if (data && !error) {
      setFiles(data.files || []);
      setStats(data.stats || { total: 0, pending: 0, processing: 0, relevant: 0, irrelevant: 0, error: 0 });
      return data.stats;
    }
    return null;
  }, [runId]);

  // Initial load
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling while classifying
  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(async () => {
      const s = await fetchStatus();
      if (s && s.pending === 0 && s.processing === 0) {
        setPolling(false);
        setClassifying(false);
        toast.success(`Análisis completado: ${s.relevant} archivos relevantes de ${s.total}`);
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [polling, fetchStatus]);

  const handleListFolder = async () => {
    if (!driveUrl.trim()) {
      toast.error("Introduce una URL de carpeta de Google Drive");
      return;
    }
    setListing(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;

      const { data, error } = await supabase.functions.invoke("drive-folder-ingest", {
        body: { action: "list_folder", source_url: driveUrl, run_id: runId, user_id: userId },
      });
      if (error) throw error;
      if (data?.error) {
        toast.error(data.error);
        if (data.setup_instructions) {
          toast.info(data.setup_instructions, { duration: 10000 });
        }
        return;
      }
      toast.success(`${data.total_files} archivos encontrados`);
      await fetchStatus();

      // Auto-start classification
      if (data.total_files > 0) {
        setClassifying(true);
        setPolling(true);
        await supabase.functions.invoke("drive-folder-ingest", {
          body: { action: "classify_files", run_id: runId, sector, business_objective: businessObjective },
        });
      }
    } catch (err) {
      toast.error("Error al listar la carpeta");
      console.error(err);
    } finally {
      setListing(false);
    }
  };

  const handleToggleRelevance = async (fileId: string, currentStatus: string) => {
    const newStatus = currentStatus === "relevant" ? "irrelevant" : "relevant";
    // Optimistic update
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: newStatus } : f));
    await supabase.from("pattern_detector_datasets" as any)
      .update({ status: newStatus })
      .eq("id", fileId);
  };

  const isProcessing = listing || classifying;
  const progressPct = stats.total > 0 ? ((stats.relevant + stats.irrelevant + stats.error) / stats.total) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Drive URL input */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <FolderSearch className="w-4 h-4 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">Conectar carpeta de Google Drive</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Pega el enlace de una carpeta de Drive compartida con la cuenta de servicio. El sistema analizará todos los archivos y clasificará cuáles son relevantes para la detección de patrones.
          </p>
          <div className="flex gap-2">
            <Input
              placeholder="https://drive.google.com/drive/folders/..."
              value={driveUrl}
              onChange={(e) => setDriveUrl(e.target.value)}
              disabled={isProcessing}
              className="flex-1"
            />
            <Button
              onClick={handleListFolder}
              disabled={isProcessing || !driveUrl.trim()}
              className="gap-1 whitespace-nowrap"
            >
              {listing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FolderSearch className="w-4 h-4" />}
              {listing ? "Escaneando..." : "Analizar carpeta"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Progress */}
      {stats.total > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-4 text-xs">
                <span className="text-muted-foreground">{stats.total} archivos</span>
                <span className="text-green-400">✓ {stats.relevant} relevantes</span>
                <span className="text-muted-foreground">✕ {stats.irrelevant} descartados</span>
                {stats.error > 0 && <span className="text-red-400">⚠ {stats.error} errores</span>}
                {(stats.pending > 0 || stats.processing > 0) && (
                  <span className="text-primary flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    {stats.pending + stats.processing} pendientes
                  </span>
                )}
              </div>
              {!isProcessing && stats.total > 0 && (
                <Button variant="ghost" size="sm" onClick={fetchStatus} className="gap-1 text-xs h-7">
                  <RefreshCw className="w-3 h-3" /> Actualizar
                </Button>
              )}
            </div>
            <Progress value={progressPct} className="h-1.5" />
          </CardContent>
        </Card>
      )}

      {/* Files table */}
      {files.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Archivo</TableHead>
                  <TableHead className="text-xs">Tipo</TableHead>
                  <TableHead className="text-xs">Tamaño</TableHead>
                  <TableHead className="text-xs">Clasificación</TableHead>
                  <TableHead className="text-xs text-center">Relevancia</TableHead>
                  <TableHead className="text-xs text-center">Estado</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {files.map(file => {
                  const st = statusConfig[file.status] || statusConfig.pending;
                  return (
                    <TableRow
                      key={file.id}
                      className={cn(
                        file.status === "irrelevant" && "opacity-50",
                        file.status === "relevant" && "bg-green-500/5"
                      )}
                    >
                      <TableCell className="text-xs font-medium max-w-[200px] truncate" title={file.file_name}>
                        {file.file_name}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {file.file_mime_type?.split("/").pop()?.split(".").pop() || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatBytes(file.file_size_bytes)}
                      </TableCell>
                      <TableCell className="text-xs">
                        {file.classification ? (
                          <Badge variant="outline" className="text-xs">
                            {classificationLabels[file.classification] || file.classification}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        {file.relevance_score !== null ? (
                          <Badge
                            variant="outline"
                            className={cn("text-xs",
                              file.relevance_score >= 0.7 ? "text-green-400 border-green-500/30" :
                              file.relevance_score >= 0.4 ? "text-amber-400 border-amber-500/30" :
                              "text-red-400 border-red-500/30"
                            )}
                            title={file.relevance_reason || ""}
                          >
                            {(file.relevance_score * 100).toFixed(0)}%
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className={cn("flex items-center justify-center gap-1 text-xs", st.className)}>
                          {st.icon} {st.label}
                        </span>
                      </TableCell>
                      <TableCell>
                        {(file.status === "relevant" || file.status === "irrelevant") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0"
                            onClick={() => handleToggleRelevance(file.id, file.status)}
                            title={file.status === "relevant" ? "Marcar como no relevante" : "Marcar como relevante"}
                          >
                            {file.status === "relevant" ? (
                              <ToggleRight className="w-4 h-4 text-green-400" />
                            ) : (
                              <ToggleLeft className="w-4 h-4 text-muted-foreground" />
                            )}
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {stats.total === 0 && !isProcessing && (
        <Card className="border-border bg-card">
          <CardContent className="p-8 text-center">
            <FileSpreadsheet className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
            <p className="text-sm text-muted-foreground mb-2">
              Conecta una carpeta de Google Drive con documentos del proyecto para mejorar la detección de patrones.
            </p>
            <p className="text-xs text-muted-foreground">
              Sin datos propios, el cap de confianza máxima es 70%.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
