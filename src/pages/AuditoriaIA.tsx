import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { ShareDialog } from "@/components/sharing/ShareDialog";
import { BusinessLeverageTabs } from "@/components/projects/BusinessLeverageTabs";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, Plus, ArrowLeft, Building2, Loader2, Trash2 } from "lucide-react";

interface Audit {
  id: string;
  name: string;
  project_id: string | null;
  sector: string | null;
  business_size: string | null;
  business_type: string | null;
  created_at: string;
}

const AuditoriaIA = () => {
  const { session } = useAuth();
  const { projects, loading: projectsLoading } = useProjects();
  const [audits, setAudits] = useState<Audit[]>([]);
  const [loadingAudits, setLoadingAudits] = useState(true);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [newName, setNewName] = useState("");
  const [newProjectId, setNewProjectId] = useState<string>("_none");
  const [newSector, setNewSector] = useState("");
  const [newSize, setNewSize] = useState("micro");
  const [newType, setNewType] = useState("");

  const activeProjects = projects.filter(
    (p) => p.status !== "closed_won" && p.status !== "closed_lost"
  );

  const loadAudits = async () => {
    if (!session?.user?.id) return;
    setLoadingAudits(true);
    const { data, error } = await supabase
      .from("bl_audits")
      .select("*")
      .eq("user_id", session.user.id)
      .order("created_at", { ascending: false });
    if (!error && data) setAudits(data);
    setLoadingAudits(false);
  };

  useEffect(() => {
    loadAudits();
  }, [session?.user?.id]);

  const handleCreate = async () => {
    if (!newName.trim() || !session?.user?.id) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.from("bl_audits").insert({
        name: newName.trim(),
        user_id: session.user.id,
        project_id: newProjectId !== "_none" ? newProjectId : null,
        sector: newSector || null,
        business_size: newSize || null,
        business_type: newType || null,
      }).select().single();
      if (error) throw error;
      setAudits(prev => [data, ...prev]);
      setSelectedAuditId(data.id);
      setShowCreateDialog(false);
      setNewName("");
      setNewProjectId("_none");
      setNewSector("");
      setNewSize("micro");
      setNewType("");
      toast.success("Auditoría creada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (auditId: string) => {
    if (!confirm("¿Eliminar esta auditoría y todos sus datos?")) return;
    try {
      await Promise.all([
        supabase.from("bl_roadmaps").delete().eq("audit_id", auditId),
        supabase.from("bl_recommendations").delete().eq("audit_id", auditId),
        supabase.from("bl_diagnostics").delete().eq("audit_id", auditId),
        supabase.from("bl_questionnaire_responses").delete().eq("audit_id", auditId),
      ]);
      await supabase.from("bl_audits").delete().eq("id", auditId);
      setAudits(prev => prev.filter(a => a.id !== auditId));
      if (selectedAuditId === auditId) setSelectedAuditId(null);
      toast.success("Auditoría eliminada");
    } catch (e: any) {
      toast.error("Error: " + e.message);
    }
  };

  const selectedAudit = audits.find(a => a.id === selectedAuditId);
  const linkedProject = selectedAudit?.project_id
    ? projects.find(p => p.id === selectedAudit.project_id)
    : null;

  if (selectedAuditId && selectedAudit) {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <Breadcrumbs />
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => setSelectedAuditId(null)} className="gap-1 w-fit">
            <ArrowLeft className="w-4 h-4" /> Volver
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h1 className="text-xl font-bold text-foreground">{selectedAudit.name}</h1>
            {selectedAudit.sector && <Badge variant="outline">{selectedAudit.sector}</Badge>}
          </div>
          <ShareDialog resourceType="bl_audit" resourceName={selectedAudit.name} />
        </div>

        <BusinessLeverageTabs
          auditId={selectedAuditId}
          projectSector={selectedAudit.sector ?? linkedProject?.sector ?? undefined}
          projectSize={selectedAudit.business_size ?? linkedProject?.business_size ?? undefined}
          auditName={selectedAudit.name}
        />
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      <div className="flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="flex items-center gap-2 flex-1">
          <ShieldCheck className="w-5 h-5 text-primary" />
          <h1 className="text-xl font-bold text-foreground">Auditoría IA</h1>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-1">
          <Plus className="w-4 h-4" /> Nueva Auditoría
        </Button>
      </div>

      {loadingAudits ? (
        <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Cargando auditorías…</span>
        </div>
      ) : audits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <ShieldCheck className="w-12 h-12 text-muted-foreground opacity-40 mb-4" />
          <p className="text-sm text-muted-foreground mb-4">
            No tienes auditorías. Crea una para empezar.
          </p>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Nueva Auditoría
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {audits.map(audit => {
            const proj = audit.project_id ? projects.find(p => p.id === audit.project_id) : null;
            return (
              <Card
                key={audit.id}
                className="cursor-pointer hover:border-primary/50 transition-colors border-border bg-card group"
                onClick={() => setSelectedAuditId(audit.id)}
              >
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <h3 className="font-semibold text-foreground text-sm">{audit.name}</h3>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDelete(audit.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5 text-destructive" />
                    </Button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {audit.sector && <Badge variant="outline" className="text-xs">{audit.sector}</Badge>}
                    {audit.business_size && <Badge variant="secondary" className="text-xs">{audit.business_size}</Badge>}
                  </div>
                  {proj && (
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Building2 className="w-3 h-3" /> {proj.name}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">
                    {new Date(audit.created_at).toLocaleDateString("es-ES")}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nueva Auditoría IA</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nombre *</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Ej: Auditoría Farmacia Central" />
            </div>
            <div className="space-y-2">
              <Label>Proyecto vinculado (opcional)</Label>
              <Select value={newProjectId} onValueChange={setNewProjectId}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Sin proyecto</SelectItem>
                  {activeProjects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Sector</Label>
                <Input value={newSector} onChange={e => setNewSector(e.target.value)} placeholder="Ej: farmacia, restauración" />
              </div>
              <div className="space-y-2">
                <Label>Tamaño</Label>
                <Select value={newSize} onValueChange={setNewSize}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="micro">Micro</SelectItem>
                    <SelectItem value="small">Pequeña</SelectItem>
                    <SelectItem value="medium">Mediana</SelectItem>
                    <SelectItem value="large">Grande</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Tipo de negocio (opcional)</Label>
              <Input value={newType} onChange={e => setNewType(e.target.value)} placeholder="Ej: retail, servicios, B2B" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancelar</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || creating}>
              {creating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : null}
              Crear Auditoría
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
};

export default AuditoriaIA;
