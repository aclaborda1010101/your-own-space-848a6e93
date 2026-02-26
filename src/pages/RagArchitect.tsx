import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Database, Plus, Loader2, ArrowLeft, Eye, Layers, Globe, RefreshCw, Trash2 } from "lucide-react";
import { useRagArchitect, RagProject } from "@/hooks/useRagArchitect";
import { RagCreator } from "@/components/rag/RagCreator";
import { RagDomainReview } from "@/components/rag/RagDomainReview";
import { RagBuildProgress } from "@/components/rag/RagBuildProgress";

const statusLabels: Record<string, string> = {
  domain_analysis: "Analizando dominio...",
  waiting_confirmation: "Esperando confirmación",
  researching: "Investigando...",
  building: "Construyendo...",
  completed: "Completado",
  failed: "Error",
  cancelled: "Cancelado",
};

const statusColors: Record<string, string> = {
  domain_analysis: "bg-blue-500/20 text-blue-400",
  waiting_confirmation: "bg-yellow-500/20 text-yellow-400",
  researching: "bg-purple-500/20 text-purple-400",
  building: "bg-purple-500/20 text-purple-400",
  completed: "bg-green-500/20 text-green-400",
  failed: "bg-red-500/20 text-red-400",
  cancelled: "bg-muted text-muted-foreground",
};

const modeIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  estandar: Eye,
  profundo: Layers,
  total: Globe,
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

  // Detail view
  if (selectedRag) {
    return (
      <div className="p-4 max-w-4xl mx-auto space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelectedRag(null)}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Volver
          </Button>
          <h1 className="text-lg font-bold flex-1 truncate">
            {(() => { const MIcon = modeIconMap[selectedRag.moral_mode]; return MIcon ? <MIcon className="h-4 w-4 shrink-0" /> : null; })()}
            {selectedRag.domain_description.slice(0, 60)}
          </h1>
          {["failed", "completed", "cancelled", "post_processing"].includes(selectedRag.status) && (
            <Button
              variant="outline"
              size="sm"
              disabled={rebuilding}
              onClick={async () => {
                setRebuilding(true);
                try {
                  await rebuildRag(selectedRag.id);
                } finally {
                  setRebuilding(false);
                }
              }}
            >
              {rebuilding ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <RefreshCw className="h-4 w-4 mr-1" />}
              Regenerar
            </Button>
          )}
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" size="sm" disabled={deleting}>
                {deleting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Eliminar
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar este RAG?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se eliminarán permanentemente todas las fuentes, chunks, grafo de conocimiento y datos asociados. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction
                  onClick={async () => {
                    setDeleting(true);
                    try {
                      await deleteRag(selectedRag.id);
                    } finally {
                      setDeleting(false);
                    }
                  }}
                >
                  Eliminar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
          <Badge className={statusColors[selectedRag.status]}>
            {statusLabels[selectedRag.status]}
          </Badge>
        </div>

        {selectedRag.status === "waiting_confirmation" ? (
          <RagDomainReview
            rag={selectedRag}
            onConfirm={confirmDomain}
            onCancel={() => setSelectedRag(null)}
            confirming={confirming}
          />
        ) : (
          <RagBuildProgress rag={selectedRag} onQuery={queryRag} onExport={exportRag} onResume={resumeRag} onRegenerateEnrichment={regenerateEnrichment} />
        )}
      </div>
    );
  }

  // List view
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Database className="h-5 w-5 text-purple-400" />
            RAG Architect
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Construye RAGs hipermegahidratados con análisis doctoral automático
          </p>
        </div>
        <Button onClick={() => setShowCreator(true)} className="bg-purple-600 hover:bg-purple-700">
          <Plus className="h-4 w-4 mr-2" /> Nuevo RAG
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : rags.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Database className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No tienes RAGs creados aún.</p>
            <Button onClick={() => setShowCreator(true)} className="mt-4 bg-purple-600 hover:bg-purple-700">
              <Plus className="h-4 w-4 mr-2" /> Crear primer RAG
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3">
          {rags.map((rag) => (
            <Card
              key={rag.id}
              className="cursor-pointer hover:border-primary/40 transition-all"
              onClick={() => handleSelectRag(rag)}
            >
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {(() => { const MIcon = modeIconMap[rag.moral_mode]; return MIcon ? <MIcon className="h-4 w-4 shrink-0 text-muted-foreground" /> : null; })()}
                      <span className="font-semibold text-sm truncate">{rag.domain_description.slice(0, 80)}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{rag.total_sources} fuentes</span>
                      <span>{rag.total_chunks} chunks</span>
                      <span>{rag.total_variables} variables</span>
                      <span>{Math.round(rag.coverage_pct)}% cobertura</span>
                    </div>
                  </div>
                  <Badge className={statusColors[rag.status]}>
                    {statusLabels[rag.status]}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Creator Dialog */}
      <Dialog open={showCreator} onOpenChange={setShowCreator}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="h-4 w-4" /> Nuevo RAG
            </DialogTitle>
          </DialogHeader>
          <RagCreator onStart={handleCreate} creating={creating} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
