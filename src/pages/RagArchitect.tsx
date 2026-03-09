import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Database, Plus, Loader2, ArrowLeft, Eye, Layers, Globe, RefreshCw, Trash2, Share2, Zap, FileText, BarChart3 } from "lucide-react";
import { useRagArchitect, RagProject } from "@/hooks/useRagArchitect";
import { RagCreator } from "@/components/rag/RagCreator";
import { RagDomainReview } from "@/components/rag/RagDomainReview";
import { RagBuildProgress } from "@/components/rag/RagBuildProgress";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { cn } from "@/lib/utils";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

const statusConfig: Record<string, { label: string; color: string; pulse?: boolean }> = {
  domain_analysis: { label: "Analizando dominio", color: "bg-primary/15 text-primary border-primary/20", pulse: true },
  waiting_confirmation: { label: "Esperando confirmación", color: "bg-warning/15 text-warning border-warning/20" },
  researching: { label: "Investigando", color: "bg-chart-4/15 text-chart-4 border-chart-4/20", pulse: true },
  building: { label: "Construyendo", color: "bg-chart-4/15 text-chart-4 border-chart-4/20", pulse: true },
  post_processing: { label: "Post-procesando", color: "bg-chart-4/15 text-chart-4 border-chart-4/20", pulse: true },
  completed: { label: "Completado", color: "bg-success/15 text-success border-success/20" },
  failed: { label: "Error", color: "bg-destructive/15 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelado", color: "bg-muted text-muted-foreground border-border" },
};

const modeConfig: Record<string, { icon: React.ComponentType<{ className?: string }>; label: string }> = {
  estandar: { icon: Eye, label: "Estándar" },
  profundo: { icon: Layers, label: "Profundo" },
  total: { icon: Globe, label: "Total" },
};

export default function RagArchitect() {
  const {
    rags, selectedRag, setSelectedRag, loading, creating, confirming,
    createRag, confirmDomain, refreshStatus, queryRag, exportRag, rebuildRag, resumeRag, regenerateEnrichment, deleteRag,
  } = useRagArchitect();
  const [showCreator, setShowCreator] = useState(false);
  const [rebuilding, setRebuilding] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleCreate = async (domain: string, moralMode: string) => {
    const result = await createRag(domain, moralMode);
    setShowCreator(false);
    if (result?.ragId) {
      const updated = await refreshStatus(result.ragId);
      if (updated) setSelectedRag(updated);
    }
  };

  const handleSelectRag = async (rag: RagProject) => {
    const updated = await refreshStatus(rag.id);
    if (updated) setSelectedRag(updated);
    else setSelectedRag(rag);
  };

  // ── Detail View ──
  if (selectedRag) {
    const cfg = statusConfig[selectedRag.status] || statusConfig.cancelled;
    const mode = modeConfig[selectedRag.moral_mode];
    const ModeIcon = mode?.icon || Eye;

    return (
      <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4">
        <Breadcrumbs />

        {/* Header */}
        <div className="flex items-start gap-3 flex-wrap">
          <Button variant="ghost" size="icon" onClick={() => setSelectedRag(null)} className="shrink-0 rounded-lg">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <ModeIcon className="h-4 w-4 text-muted-foreground shrink-0" />
              <h1 className="text-lg font-bold truncate">{selectedRag.domain_description.slice(0, 80)}</h1>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className={cn("text-[11px]", cfg.color)}>
                {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5" />}
                {cfg.label}
              </Badge>
              <span className="text-xs text-muted-foreground">{selectedRag.total_sources} fuentes</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{selectedRag.total_chunks} chunks</span>
              <span className="text-xs text-muted-foreground">·</span>
              <span className="text-xs text-muted-foreground">{Math.round(selectedRag.coverage_pct)}% cobertura</span>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <ShareDialog
              resourceType="rag_project"
              resourceId={selectedRag.id}
              resourceName={selectedRag.domain_description.slice(0, 60)}
            />
            {["failed", "completed", "cancelled", "post_processing"].includes(selectedRag.status) && (
              <Button variant="outline" size="sm" disabled={rebuilding} onClick={async () => {
                setRebuilding(true);
                try { await rebuildRag(selectedRag.id); } finally { setRebuilding(false); }
              }}>
                {rebuilding ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
                Regenerar
              </Button>
            )}
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={deleting} className="text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10">
                  {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                  Eliminar
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar este RAG?</AlertDialogTitle>
                  <AlertDialogDescription>Se eliminarán permanentemente todas las fuentes, chunks, grafo y datos asociados.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={async () => {
                    setDeleting(true);
                    try { await deleteRag(selectedRag.id); } finally { setDeleting(false); }
                  }}>Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {selectedRag.status === "waiting_confirmation" ? (
          <RagDomainReview rag={selectedRag} onConfirm={confirmDomain} onCancel={() => setSelectedRag(null)} confirming={confirming} />
        ) : (
          <RagBuildProgress rag={selectedRag} onQuery={queryRag} onExport={exportRag} onResume={resumeRag} onRegenerateEnrichment={regenerateEnrichment} />
        )}
      </main>
    );
  }

  // ── List View ──
  return (
    <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs />

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-chart-4/15 flex items-center justify-center">
              <Database className="h-4 w-4 text-chart-4" />
            </div>
            RAG Architect
          </h1>
          <p className="text-sm text-muted-foreground mt-1 ml-[42px]">
            Construye RAGs hipermegahidratados con análisis doctoral automático
          </p>
        </div>
        <Button onClick={() => setShowCreator(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Nuevo RAG
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rags.length === 0 ? (
        <Card className="border-dashed border-border/60">
          <CardContent className="p-12 text-center space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-chart-4/10 flex items-center justify-center mx-auto">
              <Database className="h-8 w-8 text-chart-4/60" />
            </div>
            <div>
              <p className="text-foreground font-medium">Aún no tienes RAGs creados</p>
              <p className="text-sm text-muted-foreground mt-1">Crea tu primera base de conocimiento inteligente</p>
            </div>
            <Button onClick={() => setShowCreator(true)} className="gap-2">
              <Zap className="h-4 w-4" /> Crear primer RAG
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rags.map((rag) => {
            const cfg = statusConfig[rag.status] || statusConfig.cancelled;
            const mode = modeConfig[rag.moral_mode];
            const ModeIcon = mode?.icon || Eye;

            return (
              <Card
                key={rag.id}
                className="cursor-pointer hover:border-primary/30 transition-all group/rag"
                onClick={() => handleSelectRag(rag)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-chart-4/10 flex items-center justify-center shrink-0 group-hover/rag:bg-chart-4/15 transition-colors">
                      <ModeIcon className="h-5 w-5 text-chart-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate group-hover/rag:text-primary transition-colors">
                        {rag.domain_description.slice(0, 80)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                        <span className="flex items-center gap-1">
                          <FileText className="w-3 h-3" />
                          {rag.total_sources} fuentes
                        </span>
                        <span className="flex items-center gap-1">
                          <BarChart3 className="w-3 h-3" />
                          {rag.total_chunks} chunks
                        </span>
                        <span>{rag.total_variables} variables</span>
                        <span>{Math.round(rag.coverage_pct)}%</span>
                      </div>
                    </div>
                    <Badge variant="outline" className={cn("text-[11px] shrink-0", cfg.color)}>
                      {cfg.pulse && <span className="w-1.5 h-1.5 rounded-full bg-current animate-pulse mr-1.5" />}
                      {cfg.label}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreator} onOpenChange={setShowCreator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4 text-chart-4" /> Nuevo RAG
            </DialogTitle>
          </DialogHeader>
          <RagCreator onStart={handleCreate} creating={creating} />
        </DialogContent>
      </Dialog>
    </main>
  );
}
