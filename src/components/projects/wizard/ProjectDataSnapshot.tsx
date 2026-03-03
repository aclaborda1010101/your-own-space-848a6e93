import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Upload, FileSpreadsheet, Check, X, Loader2, Database,
  BarChart3, MapPin, Calendar, AlertTriangle, ArrowRight, Trash2,
} from "lucide-react";
import { toast } from "sonner";

interface DataFile {
  id: string;
  name: string;
  rows: number;
  columns: string[];
  quality: number;
  status: string;
}

interface DataProfile {
  has_client_data: boolean;
  total_files: number;
  total_rows: number;
  source_modes_used: string[];
  detected_variables: Array<{
    name: string;
    type: string;
    records: number;
    quality: number;
    description: string;
  }>;
  detected_entities: string[];
  temporal_coverage: { from: string; to: string } | null;
  geographic_coverage: string[];
  data_quality_score: number;
  quality_issues: string[];
  business_context: string;
  user_corrections: string | null;
}

interface Props {
  projectId: string;
  onComplete: (dataProfile: DataProfile) => void;
  onSkip: () => void;
}

type Phase = "upload" | "validating" | "validated";

export const ProjectDataSnapshot = ({ projectId, onComplete, onSkip }: Props) => {
  const [phase, setPhase] = useState<Phase>("upload");
  const [files, setFiles] = useState<DataFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [dataProfile, setDataProfile] = useState<DataProfile | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const uploadFiles = useCallback(async (fileList: FileList | File[]) => {
    const filesToUpload = Array.from(fileList);
    if (filesToUpload.length === 0) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("projectId", projectId);
      for (const file of filesToUpload) {
        formData.append(file.name, file);
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("No session");

      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-client-data`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      if (!resp.ok) {
        const err = await resp.text();
        throw new Error(err);
      }

      const result = await resp.json();
      const newFiles: DataFile[] = (result.files || []).map((f: any) => ({
        id: f.file_id,
        name: f.name,
        rows: f.rows || 0,
        columns: f.columns || [],
        quality: f.analysis?.quality_score || 0,
        status: f.status || "analyzed",
      }));

      setFiles(prev => [...prev, ...newFiles]);
      toast.success(`${newFiles.length} archivo(s) analizados`);
    } catch (err: any) {
      console.error("Upload error:", err);
      toast.error(err.message || "Error subiendo archivos");
    } finally {
      setUploading(false);
    }
  }, [projectId]);

  const deleteFile = async (fileId: string) => {
    try {
      await supabase.functions.invoke("analyze-client-data", {
        body: { action: "delete_file", projectId, fileId },
      });
      setFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("Archivo eliminado");
    } catch {
      toast.error("Error eliminando archivo");
    }
  };

  const loadDataProfile = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke("analyze-client-data", {
        body: { action: "get_data_profile", projectId },
      });

      if (error) throw error;
      setDataProfile(data.data_profile);
      setPhase("validated");
    } catch (err: any) {
      toast.error("Error consolidando análisis");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files);
    }
  };

  // ── Upload Phase ──
  if (phase === "upload") {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
              <Database className="w-4 h-4 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">Datos del negocio del cliente</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Con datos reales, el sistema diseña patrones basados en evidencia, no en estimaciones.
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border/50 hover:border-primary/50"
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => document.getElementById("file-input")?.click()}
          >
            <input
              id="file-input"
              type="file"
              multiple
              accept=".csv,.tsv,.xlsx,.xls,.json,.txt,.pdf"
              className="hidden"
              onChange={handleFileInput}
            />
            <Upload className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Arrastra archivos aquí</p>
            <p className="text-xs text-muted-foreground mt-1">
              Excel, CSV, JSON, PDF, TXT — hasta 50 MB / archivo
            </p>
          </div>

          {/* Uploading indicator */}
          {uploading && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-muted-foreground">Subiendo y analizando archivos...</span>
            </div>
          )}

          {/* File list */}
          {files.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-sm font-semibold">Archivos analizados</h4>
              {files.map(f => (
                <div key={f.id} className="flex items-center justify-between p-3 rounded-lg border bg-background">
                  <div className="flex items-center gap-3 min-w-0">
                    <FileSpreadsheet className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {f.rows.toLocaleString()} filas · {f.columns.length} columnas · Calidad {f.quality}%
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={f.quality >= 70 ? "default" : "secondary"} className="text-[10px]">
                      {f.quality}%
                    </Badge>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteFile(f.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onSkip} className="flex-1">
              Continuar sin datos <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
            {files.length > 0 && (
              <Button onClick={loadDataProfile} disabled={analyzing} className="flex-1 gap-2">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Validar análisis
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Validation Phase ──
  if (phase === "validated" && dataProfile) {
    return (
      <Card className="border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-green-500/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-green-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Resumen del análisis</CardTitle>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {dataProfile.total_files} archivos · {dataProfile.total_rows.toLocaleString()} registros
                </p>
              </div>
            </div>
            <Badge variant="outline" className="text-green-500 border-green-500/30">
              Calidad {dataProfile.data_quality_score}/100
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <ScrollArea className="h-[420px]">
            <div className="space-y-4 pr-4">
              {/* Entities */}
              {dataProfile.detected_entities.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Database className="w-3.5 h-3.5 text-primary" /> Entidades detectadas
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {dataProfile.detected_entities.slice(0, 20).map(e => (
                      <Badge key={e} variant="secondary" className="text-[11px]">{e}</Badge>
                    ))}
                    {dataProfile.detected_entities.length > 20 && (
                      <Badge variant="outline" className="text-[11px]">
                        +{dataProfile.detected_entities.length - 20} más
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Variables */}
              {dataProfile.detected_variables.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <BarChart3 className="w-3.5 h-3.5 text-primary" /> Variables clave
                  </h4>
                  <div className="space-y-1.5">
                    {dataProfile.detected_variables.map((v, i) => (
                      <div key={i} className="flex items-center justify-between p-2 rounded border bg-background text-xs">
                        <div className="flex items-center gap-2">
                          <Check className="w-3 h-3 text-green-500" />
                          <span className="font-medium">{v.name}</span>
                          <span className="text-muted-foreground">({v.type})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{v.records} reg.</span>
                          <Badge variant={v.quality >= 80 ? "default" : "secondary"} className="text-[10px]">
                            {v.quality}%
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Coverage */}
              <div className="grid grid-cols-2 gap-3">
                {dataProfile.temporal_coverage && (
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Cobertura temporal</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dataProfile.temporal_coverage.from} — {dataProfile.temporal_coverage.to}
                    </p>
                  </div>
                )}
                {dataProfile.geographic_coverage.length > 0 && (
                  <div className="p-3 rounded-lg border bg-background">
                    <div className="flex items-center gap-2 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="text-xs font-medium">Cobertura geográfica</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {dataProfile.geographic_coverage.join(", ")}
                    </p>
                  </div>
                )}
              </div>

              {/* Quality */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold">Calidad global</h4>
                  <span className="text-sm font-bold text-primary">{dataProfile.data_quality_score}/100</span>
                </div>
                <Progress value={dataProfile.data_quality_score} className="h-2" />
                {dataProfile.quality_issues.length > 0 && (
                  <div className="space-y-1">
                    {dataProfile.quality_issues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                        <AlertTriangle className="w-3 h-3 mt-0.5 text-yellow-500 shrink-0" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Business context */}
              {dataProfile.business_context && (
                <div className="p-3 rounded-lg border bg-muted/20">
                  <h4 className="text-xs font-semibold mb-1">Contexto de negocio</h4>
                  <p className="text-xs text-muted-foreground">{dataProfile.business_context}</p>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setPhase("upload")} className="flex-1">
              Añadir más archivos
            </Button>
            <Button onClick={() => onComplete(dataProfile)} className="flex-1 gap-2">
              <Check className="w-4 h-4" />
              Confirmar y generar PRD
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
};
