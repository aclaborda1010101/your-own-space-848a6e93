import { useState, useEffect } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PatternDetector } from "@/components/projects/PatternDetector";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  useProjects,
  BusinessProject,
  ProjectContact,
  ProjectTimelineEntry,
  PROJECT_STATUSES,
  PROJECT_ROLES,
  ProjectStatus,
} from "@/hooks/useProjects";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Briefcase, Plus, Loader2, ArrowLeft, Building2,
  DollarSign, User, TrendingUp, Clock, Mail,
  MessageCircle, Mic, Calendar, PenLine, UserPlus,
  Trash2, FileText, Target, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

const channelIcons: Record<string, any> = {
  plaud: Mic,
  whatsapp: MessageCircle,
  email: Mail,
  manual: PenLine,
  calendar: Calendar,
};

const getStatusConfig = (status: string) =>
  PROJECT_STATUSES.find((s) => s.value === status) || PROJECT_STATUSES[0];

const formatCurrency = (v: number | null) =>
  v != null ? `${v.toLocaleString("es-ES")}€` : "—";

// ── Pipeline View ──────────────────────────────────────────────────────────────

const PipelineView = ({
  projects,
  pipelineValue,
  onSelect,
  onCreate,
}: {
  projects: BusinessProject[];
  pipelineValue: { total: number; weighted: number };
  onSelect: (p: BusinessProject) => void;
  onCreate: () => void;
}) => {
  const activeStatuses: ProjectStatus[] = ["nuevo", "en_conversacion", "propuesta_enviada", "negociacion"];
  const grouped = activeStatuses.map((s) => ({
    ...getStatusConfig(s),
    items: projects.filter((p) => p.status === s),
  }));
  const won = projects.filter((p) => p.status === "ganado");
  const lost = projects.filter((p) => p.status === "perdido");
  const paused = projects.filter((p) => p.status === "pausado");

  return (
    <div className="space-y-6">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">PIPELINE TOTAL</p>
            <p className="text-xl font-bold text-foreground">{formatCurrency(pipelineValue.total)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">PONDERADO</p>
            <p className="text-xl font-bold text-primary">{formatCurrency(pipelineValue.weighted)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">ACTIVOS</p>
            <p className="text-xl font-bold text-foreground">{grouped.reduce((s, g) => s + g.items.length, 0)}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground font-mono">GANADOS</p>
            <p className="text-xl font-bold text-green-400">{won.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline Columns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {grouped.map((col) => (
          <div key={col.value} className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <Badge variant="outline" className={cn("text-xs", col.color)}>
                {col.label} ({col.items.length})
              </Badge>
            </div>
            <div className="space-y-2 min-h-[100px]">
              {col.items.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onSelect(p)}
                  className="w-full text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/5 hover:border-muted-foreground/30 transition-all"
                >
                  <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                  {p.company && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <Building2 className="w-3 h-3" /> {p.company}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs font-mono text-primary">{formatCurrency(p.estimated_value)}</span>
                    {p.primary_contact_name && (
                      <span className="text-xs text-muted-foreground truncate ml-2">{p.primary_contact_name}</span>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Closed / Paused */}
      {(won.length > 0 || lost.length > 0 || paused.length > 0) && (
        <div className="space-y-3">
          {paused.length > 0 && (
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-2">PAUSADOS ({paused.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {paused.map((p) => (
                  <button key={p.id} onClick={() => onSelect(p)} className="text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/5 transition-all opacity-70">
                    <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    <span className="text-xs text-muted-foreground">{formatCurrency(p.estimated_value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          {(won.length > 0 || lost.length > 0) && (
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-2">CERRADOS ({won.length + lost.length})</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[...won, ...lost].map((p) => (
                  <button key={p.id} onClick={() => onSelect(p)} className="text-left p-3 rounded-xl border border-border bg-card hover:bg-muted/5 transition-all opacity-60">
                    <div className="flex items-center gap-2">
                      <span className={p.status === "ganado" ? "text-green-400" : "text-red-400"}>
                        {p.status === "ganado" ? "✅" : "❌"}
                      </span>
                      <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatCurrency(p.estimated_value)}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// ── Project Detail View ────────────────────────────────────────────────────────

const ProjectDetail = ({
  project,
  onBack,
  onUpdate,
  onDelete,
  fetchContacts,
  addContact,
  removeContact,
  fetchTimeline,
  addTimelineEntry,
}: {
  project: BusinessProject;
  onBack: () => void;
  onUpdate: (id: string, u: Partial<BusinessProject>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  fetchContacts: (id: string) => Promise<ProjectContact[]>;
  addContact: (pid: string, cid: string, role: string) => Promise<void>;
  removeContact: (id: string) => Promise<void>;
  fetchTimeline: (id: string) => Promise<ProjectTimelineEntry[]>;
  addTimelineEntry: (e: any) => Promise<void>;
}) => {
  const { user } = useAuth();
  const statusCfg = getStatusConfig(project.status);
  const [contacts, setContacts] = useState<ProjectContact[]>([]);
  const [timeline, setTimeline] = useState<ProjectTimelineEntry[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [editStatus, setEditStatus] = useState(false);
  const [addEventOpen, setAddEventOpen] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventDesc, setEventDesc] = useState("");

  useEffect(() => {
    fetchContacts(project.id).then(setContacts);
    fetchTimeline(project.id).then(setTimeline);
    // Fetch linked tasks
    if (user) {
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setTasks(data || []));
    }
  }, [project.id]);

  const handleAddEvent = async () => {
    if (!eventTitle.trim()) return;
    await addTimelineEntry({
      project_id: project.id,
      event_date: new Date().toISOString(),
      channel: "manual",
      title: eventTitle,
      description: eventDesc || undefined,
    });
    setEventTitle("");
    setEventDesc("");
    setAddEventOpen(false);
    fetchTimeline(project.id).then(setTimeline);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-xl font-bold text-foreground truncate">{project.name}</h2>
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            <Badge variant="outline" className={cn("text-xs cursor-pointer", statusCfg.color)} onClick={() => setEditStatus(true)}>
              {statusCfg.label}
            </Badge>
            {project.company && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Building2 className="w-3 h-3" /> {project.company}
              </span>
            )}
            <span className="text-xs font-mono text-primary">{formatCurrency(project.estimated_value)}</span>
            {project.close_probability && (
              <span className="text-xs text-muted-foreground">• Prob: {project.close_probability}</span>
            )}
          </div>
        </div>
        <Button variant="destructive" size="sm" onClick={() => onDelete(project.id).then(onBack)}>
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>

      {/* Status change dialog */}
      {editStatus && (
        <Dialog open={editStatus} onOpenChange={setEditStatus}>
          <DialogContent>
            <DialogHeader><DialogTitle>Cambiar estado</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-2">
              {PROJECT_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  variant="outline"
                  className={cn("justify-start", project.status === s.value && "ring-2 ring-primary")}
                  onClick={async () => {
                    const updates: any = { status: s.value };
                    if (["ganado", "perdido"].includes(s.value)) updates.closed_at = new Date().toISOString();
                    await onUpdate(project.id, updates);
                    setEditStatus(false);
                  }}
                >
                  <Badge variant="outline" className={cn("text-xs mr-2", s.color)}>{s.label}</Badge>
                </Button>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Tabs defaultValue="need" className="w-full">
        <TabsList className="bg-muted/30 border border-border w-full justify-start overflow-x-auto">
          <TabsTrigger value="need">Necesidad</TabsTrigger>
          <TabsTrigger value="contacts">Contactos ({contacts.length})</TabsTrigger>
          <TabsTrigger value="timeline">Timeline ({timeline.length})</TabsTrigger>
          <TabsTrigger value="tasks">Tareas ({tasks.length})</TabsTrigger>
          <TabsTrigger value="detector">Detector</TabsTrigger>
        </TabsList>

        {/* Need */}
        <TabsContent value="need" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-mono text-muted-foreground flex items-center gap-2">
                <FileText className="w-4 h-4" /> NECESIDAD DETECTADA
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {project.need_summary ? (
                <>
                  <div>
                    <p className="text-xs text-muted-foreground font-mono">¿QUÉ NECESITA?</p>
                    <p className="text-sm text-foreground mt-1">{project.need_summary}</p>
                  </div>
                  {project.need_why && (
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">¿POR QUÉ?</p>
                      <p className="text-sm text-foreground mt-1">{project.need_why}</p>
                    </div>
                  )}
                  {project.need_deadline && (
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">¿PARA CUÁNDO?</p>
                      <p className="text-sm text-foreground mt-1">{project.need_deadline}</p>
                    </div>
                  )}
                  {project.need_budget && (
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">PRESUPUESTO</p>
                      <p className="text-sm text-foreground mt-1">{project.need_budget}</p>
                    </div>
                  )}
                  {project.need_decision_maker && (
                    <div>
                      <p className="text-xs text-muted-foreground font-mono">DECISOR</p>
                      <p className="text-sm text-foreground mt-1">{project.need_decision_maker}</p>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  Sin briefing registrado. Edita el proyecto para añadir la necesidad del cliente.
                </p>
              )}
            </CardContent>
          </Card>
          {project.notes && (
            <Card className="border-border bg-card">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground font-mono mb-1">NOTAS</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{project.notes}</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Contacts */}
        <TabsContent value="contacts" className="space-y-3 mt-4">
          {contacts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin contactos vinculados</p>
          ) : (
            contacts.map((c) => (
              <div key={c.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                  {(c.contact_name || "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{c.contact_name || "Contacto"}</p>
                  <Badge variant="outline" className="text-xs mt-0.5">
                    {PROJECT_ROLES.find((r) => r.value === c.role)?.label || c.role}
                  </Badge>
                </div>
                <Button variant="ghost" size="icon" onClick={() => removeContact(c.id).then(() => fetchContacts(project.id).then(setContacts))}>
                  <Trash2 className="w-4 h-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          )}
        </TabsContent>

        {/* Timeline */}
        <TabsContent value="timeline" className="space-y-3 mt-4">
          <Button variant="outline" size="sm" onClick={() => setAddEventOpen(true)} className="gap-1">
            <Plus className="w-4 h-4" /> Añadir evento
          </Button>
          {timeline.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin eventos en el timeline</p>
          ) : (
            <div className="relative border-l-2 border-border ml-3 space-y-4 pl-6">
              {timeline.map((t) => {
                const ChannelIcon = channelIcons[t.channel] || PenLine;
                return (
                  <div key={t.id} className="relative">
                    <div className="absolute -left-[31px] top-1 w-4 h-4 rounded-full border-2 border-border bg-background flex items-center justify-center">
                      <ChannelIcon className="w-2.5 h-2.5 text-muted-foreground" />
                    </div>
                    <div className="p-3 rounded-xl border border-border bg-card">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-muted-foreground font-mono">
                          {format(new Date(t.event_date), "dd/MM/yyyy", { locale: es })}
                        </span>
                        <Badge variant="outline" className="text-xs capitalize">{t.channel}</Badge>
                        {t.auto_detected && <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">Auto</Badge>}
                      </div>
                      <p className="text-sm font-medium text-foreground">{t.title}</p>
                      {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                      {t.contact_name && (
                        <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                          <User className="w-3 h-3" /> {t.contact_name}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Add event dialog */}
          <Dialog open={addEventOpen} onOpenChange={setAddEventOpen}>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo evento</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Título</Label>
                  <Input value={eventTitle} onChange={(e) => setEventTitle(e.target.value)} placeholder="Qué ocurrió..." />
                </div>
                <div>
                  <Label>Descripción (opcional)</Label>
                  <Textarea value={eventDesc} onChange={(e) => setEventDesc(e.target.value)} placeholder="Detalle..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={handleAddEvent} disabled={!eventTitle.trim()}>Añadir</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        {/* Tasks */}
        <TabsContent value="tasks" className="space-y-3 mt-4">
          {tasks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sin tareas vinculadas a este proyecto</p>
          ) : (
            tasks.map((t) => (
              <div key={t.id} className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card">
                <span className={cn("text-lg", t.completed ? "opacity-50" : "")}>{t.completed ? "☑" : "☐"}</span>
                <p className={cn("text-sm flex-1", t.completed && "line-through text-muted-foreground")}>{t.title}</p>
              </div>
            ))
          )}
        </TabsContent>

        {/* Detector */}
        <TabsContent value="detector" className="mt-4">
          <PatternDetector projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Create Project Dialog ──────────────────────────────────────────────────────

const CreateProjectDialog = ({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (d: any) => Promise<any>;
}) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [need, setNeed] = useState("");
  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && user) {
      supabase
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name")
        .then(({ data }) => setContacts(data || []));
    }
  }, [open, user]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    await onCreate({
      name,
      company: company || undefined,
      estimated_value: value ? parseFloat(value) : undefined,
      need_summary: need || undefined,
      primary_contact_id: contactId || undefined,
    });
    setSaving(false);
    setName(""); setCompany(""); setValue(""); setNeed(""); setContactId("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Nuevo proyecto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nombre del proyecto *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="App Móvil Empresa X" />
          </div>
          <div>
            <Label>Empresa</Label>
            <Input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Empresa S.L." />
          </div>
          <div>
            <Label>Valor estimado (€)</Label>
            <Input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder="25000" />
          </div>
          <div>
            <Label>Contacto principal</Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger><SelectValue placeholder="Seleccionar contacto" /></SelectTrigger>
              <SelectContent>
                {contacts.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Necesidad del cliente</Label>
            <Textarea value={need} onChange={(e) => setNeed(e.target.value)} placeholder="¿Qué necesita?" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim() || saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Crear proyecto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

// ── Main Page ──────────────────────────────────────────────────────────────────

const Projects = () => {
  const {
    projects, activeProjects, pipelineValue, loading,
    createProject, updateProject, deleteProject,
    fetchProjectContacts, addProjectContact, removeProjectContact,
    fetchTimeline, addTimelineEntry, fetchProjects,
  } = useProjects();

  const [selected, setSelected] = useState<BusinessProject | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  // Refresh selected after updates
  useEffect(() => {
    if (selected) {
      const updated = projects.find((p) => p.id === selected.id);
      if (updated) setSelected(updated);
      else setSelected(null);
    }
  }, [projects]);

  if (loading) {
    return (
      <main className="p-4 lg:p-6 flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {!selected ? (
        <>
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Briefcase className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Proyectos</h1>
                <p className="text-sm text-muted-foreground font-mono">{activeProjects.length} ACTIVOS</p>
              </div>
            </div>
            <Button onClick={() => setCreateOpen(true)} className="gap-1">
              <Plus className="w-4 h-4" /> Nuevo
            </Button>
          </div>

          <PipelineView
            projects={projects}
            pipelineValue={pipelineValue}
            onSelect={setSelected}
            onCreate={() => setCreateOpen(true)}
          />
        </>
      ) : (
        <ProjectDetail
          project={selected}
          onBack={() => setSelected(null)}
          onUpdate={updateProject}
          onDelete={deleteProject}
          fetchContacts={fetchProjectContacts}
          addContact={addProjectContact}
          removeContact={removeProjectContact}
          fetchTimeline={fetchTimeline}
          addTimelineEntry={addTimelineEntry}
        />
      )}

      <CreateProjectDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreate={createProject}
      />
    </main>
  );
};

export default Projects;
