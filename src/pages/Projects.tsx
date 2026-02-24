import { useState, useEffect, useCallback } from "react";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { PatternDetector } from "@/components/projects/PatternDetector";
import { BusinessLeverageTabs } from "@/components/projects/BusinessLeverageTabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
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
  Trash2, FileText, Target, AlertTriangle, Upload, CheckCircle2, X,
  Brain, ChevronDown, ChevronRight, Sparkles, Activity,
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
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [allContacts, setAllContacts] = useState<{ id: string; name: string }[]>([]);
  const [selectedContactId, setSelectedContactId] = useState("");
  const [selectedRole, setSelectedRole] = useState("cliente");
  const [contactSearch, setContactSearch] = useState("");

  useEffect(() => {
    fetchContacts(project.id).then(setContacts);
    fetchTimeline(project.id).then(setTimeline);
    if (user) {
      supabase
        .from("tasks")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })
        .then(({ data }) => setTasks(data || []));
      // Load all contacts for the linking dialog
      supabase
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name")
        .then(({ data }) => setAllContacts(data || []));
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
    <div className="space-y-6 overflow-y-auto">
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
          <TabsTrigger value="leverage">AI Leverage</TabsTrigger>
          <TabsTrigger value="detector">Detector</TabsTrigger>
          <TabsTrigger value="patterns" className="gap-1">
            <Brain className="w-3 h-3" /> Patrones
          </TabsTrigger>
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
          <Button variant="outline" size="sm" onClick={() => setAddContactOpen(true)} className="gap-1">
            <UserPlus className="w-4 h-4" /> Vincular contacto
          </Button>
          {contacts.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <User className="w-8 h-8 mx-auto text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">Sin contactos vinculados</p>
              <Button variant="ghost" size="sm" onClick={() => setAddContactOpen(true)} className="gap-1 text-primary">
                <UserPlus className="w-4 h-4" /> Añadir primer contacto
              </Button>
            </div>
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

          {/* Dialog vincular contacto */}
          <Dialog open={addContactOpen} onOpenChange={(open) => { setAddContactOpen(open); if (!open) { setSelectedContactId(""); setSelectedRole("cliente"); setContactSearch(""); } }}>
            <DialogContent>
              <DialogHeader><DialogTitle>Vincular contacto</DialogTitle></DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">BUSCAR CONTACTO</Label>
                  <Input
                    placeholder="Buscar por nombre..."
                    value={contactSearch}
                    onChange={(e) => setContactSearch(e.target.value)}
                    className="mt-1"
                  />
                  <ScrollArea className="h-40 mt-2 border border-border rounded-md">
                    {allContacts
                      .filter((c) => c.name?.toLowerCase().includes(contactSearch.toLowerCase()))
                      .filter((c) => !contacts.some((linked) => linked.contact_id === c.id))
                      .map((c) => (
                        <button
                          key={c.id}
                          onClick={() => setSelectedContactId(c.id)}
                          className={cn(
                            "w-full text-left px-3 py-2 text-sm hover:bg-muted/50 transition-colors",
                            selectedContactId === c.id && "bg-primary/10 text-primary font-medium"
                          )}
                        >
                          {c.name}
                        </button>
                      ))}
                    {allContacts.filter((c) => c.name?.toLowerCase().includes(contactSearch.toLowerCase())).filter((c) => !contacts.some((linked) => linked.contact_id === c.id)).length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">No hay contactos disponibles</p>
                    )}
                  </ScrollArea>
                </div>
                <div>
                  <Label className="text-xs font-mono text-muted-foreground">ROL</Label>
                  <Select value={selectedRole} onValueChange={setSelectedRole}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PROJECT_ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  disabled={!selectedContactId}
                  onClick={async () => {
                    await addContact(project.id, selectedContactId, selectedRole);
                    setAddContactOpen(false);
                    setSelectedContactId("");
                    setSelectedRole("cliente");
                    setContactSearch("");
                    fetchContacts(project.id).then(setContacts);
                  }}
                >
                  Vincular
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

        {/* AI Business Leverage */}
        <TabsContent value="leverage" className="mt-4">
          <BusinessLeverageTabs
            projectId={project.id}
            projectSector={project.sector}
            projectSize={project.business_size}
          />
        </TabsContent>

        {/* Detector */}
        <TabsContent value="detector" className="mt-4">
          <PatternDetector projectId={project.id} />
        </TabsContent>

        {/* Patrones Predictivos */}
        <TabsContent value="patterns" className="mt-4">
          <PatternsTab projectId={project.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Patterns Tab Component ────────────────────────────────────────────────────

const LAYER_COLORS: Record<number, string> = {
  1: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  2: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  3: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  4: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  5: "bg-red-500/20 text-red-400 border-red-500/30",
};

const VALIDATION_BADGE: Record<string, { label: string; className: string }> = {
  validated: { label: "Validado", className: "bg-green-500/20 text-green-400 border-green-500/30" },
  degraded: { label: "Degradado", className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" },
  moved_to_hypothesis: { label: "Hipótesis", className: "bg-muted text-muted-foreground border-border" },
};

interface DetectedPattern {
  id: string;
  name: string;
  description: string | null;
  layer: number;
  layer_name: string;
  impact: number | null;
  confidence: number | null;
  anticipation_days: number | null;
  evidence_summary: string | null;
  counter_evidence: string | null;
  data_sources: any;
  validation_status: string;
  uncertainty_type: string | null;
  retrospective_cases: any;
  evidence_chunk_ids: string[];
}

interface PatternRun {
  id: string;
  status: string;
  validation_results: any;
  created_at: string;
}

const PatternsTab = ({ projectId }: { projectId: string }) => {
  const [run, setRun] = useState<PatternRun | null>(null);
  const [patterns, setPatterns] = useState<DetectedPattern[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null);

  const fetchPatterns = useCallback(async () => {
    // Get latest run
    const { data: runs } = await supabase
      .from("pattern_detection_runs")
      .select("id, status, validation_results, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1);

    if (runs && runs.length > 0) {
      const latestRun = runs[0] as PatternRun;
      setRun(latestRun);

      if (latestRun.status === "COMPLETED") {
        const { data: pats } = await supabase
          .from("detected_patterns")
          .select("*")
          .eq("run_id", latestRun.id)
          .order("layer", { ascending: true });
        setPatterns((pats || []) as DetectedPattern[]);
      }
    }
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    fetchPatterns();
  }, [fetchPatterns]);

  // Polling if run is in progress
  useEffect(() => {
    if (!run || ["COMPLETED", "FAILED"].includes(run.status)) return;
    const interval = setInterval(fetchPatterns, 5000);
    return () => clearInterval(interval);
  }, [run?.status, fetchPatterns]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!run) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center space-y-2">
          <Brain className="w-8 h-8 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            Sin patrones detectados. Crea el proyecto con RAG y detección de patrones activados.
          </p>
        </CardContent>
      </Card>
    );
  }

  // In-progress states
  if (!["COMPLETED", "FAILED"].includes(run.status)) {
    const statusLabels: Record<string, string> = {
      PENDING: "Preparando detección...",
      ANALYZING_DOMAIN: "Analizando dominio desde el RAG...",
      DETECTING_SOURCES: "Detectando fuentes de datos...",
      GENERATING_PATTERNS: "Generando patrones con IA...",
      VALIDATING: "Validando patrones contra evidencia...",
    };
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary" />
          <p className="text-sm font-medium text-foreground">{statusLabels[run.status] || "Procesando..."}</p>
          <p className="text-xs text-muted-foreground">Esto puede tomar unos minutos</p>
        </CardContent>
      </Card>
    );
  }

  if (run.status === "FAILED") {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-12 text-center space-y-2">
          <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
          <p className="text-sm text-red-400">Error en la detección de patrones</p>
        </CardContent>
      </Card>
    );
  }

  // Group patterns by layer
  const byLayer = patterns.reduce<Record<number, DetectedPattern[]>>((acc, p) => {
    (acc[p.layer] = acc[p.layer] || []).push(p);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground font-mono">TOTAL</p>
            <p className="text-xl font-bold text-foreground">{patterns.length}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground font-mono">VALIDADOS</p>
            <p className="text-xl font-bold text-green-400">{run.validation_results?.validated || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground font-mono">DEGRADADOS</p>
            <p className="text-xl font-bold text-yellow-400">{run.validation_results?.degraded || 0}</p>
          </CardContent>
        </Card>
        <Card className="border-border bg-card">
          <CardContent className="p-3 text-center">
            <p className="text-xs text-muted-foreground font-mono">HIPÓTESIS</p>
            <p className="text-xl font-bold text-muted-foreground">{run.validation_results?.hypothesis || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Patterns by layer */}
      {[1, 2, 3, 4, 5].map((layer) => {
        const layerPatterns = byLayer[layer] || [];
        if (layerPatterns.length === 0) return null;
        const isExpanded = expandedLayer === layer;
        const layerName = layerPatterns[0]?.layer_name || `Capa ${layer}`;

        return (
          <Collapsible key={layer} open={isExpanded} onOpenChange={() => setExpandedLayer(isExpanded ? null : layer)}>
            <CollapsibleTrigger className="w-full">
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-card hover:bg-muted/5 transition-all">
                <div className="flex items-center gap-2">
                  {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                  <Badge className={cn("text-xs", LAYER_COLORS[layer])}>Capa {layer}</Badge>
                  <span className="text-sm font-medium text-foreground">{layerName}</span>
                </div>
                <span className="text-xs text-muted-foreground">{layerPatterns.length} patrones</span>
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="space-y-2 mt-2 ml-4">
                {layerPatterns.map((p) => {
                  const vBadge = VALIDATION_BADGE[p.validation_status] || VALIDATION_BADGE.moved_to_hypothesis;
                  return (
                    <Card key={p.id} className="border-border bg-card">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-foreground">{p.name}</p>
                            {p.description && <p className="text-xs text-muted-foreground mt-1">{p.description}</p>}
                          </div>
                          <Badge className={cn("text-xs shrink-0", vBadge.className)}>{vBadge.label}</Badge>
                        </div>

                        <div className="flex flex-wrap gap-3 text-xs">
                          {p.confidence != null && (
                            <span className="text-muted-foreground">
                              Confianza: <span className="text-foreground font-mono">{Math.round(p.confidence * 100)}%</span>
                            </span>
                          )}
                          {p.impact != null && (
                            <span className="text-muted-foreground">
                              Impacto: <span className="text-foreground font-mono">{Math.round(p.impact * 100)}%</span>
                            </span>
                          )}
                          {p.anticipation_days != null && (
                            <span className="text-muted-foreground">
                              Anticipación: <span className="text-foreground font-mono">{p.anticipation_days}d</span>
                            </span>
                          )}
                          {p.uncertainty_type && (
                            <span className="text-muted-foreground">
                              Incertidumbre: <span className="text-foreground">{p.uncertainty_type}</span>
                            </span>
                          )}
                        </div>

                        {p.evidence_summary && (
                          <div>
                            <p className="text-xs font-mono text-muted-foreground">EVIDENCIA</p>
                            <p className="text-xs text-foreground mt-0.5">{p.evidence_summary}</p>
                          </div>
                        )}

                        {p.counter_evidence && (
                          <div>
                            <p className="text-xs font-mono text-muted-foreground">CONTRA-EVIDENCIA</p>
                            <p className="text-xs text-foreground mt-0.5">{p.counter_evidence}</p>
                          </div>
                        )}

                        {p.data_sources && Array.isArray(p.data_sources) && p.data_sources.length > 0 && (
                          <div>
                            <p className="text-xs font-mono text-muted-foreground">FUENTES DE DATOS</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {p.data_sources.map((ds: any, i: number) => (
                                <Badge key={i} variant="outline" className="text-xs">{ds.name || ds}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {p.evidence_chunk_ids?.length > 0 && (
                          <p className="text-xs text-muted-foreground">
                            {p.evidence_chunk_ids.length} chunks de evidencia del RAG
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </CollapsibleContent>
          </Collapsible>
        );
      })}
    </div>
  );
};

// ── Create Project Dialog ──────────────────────────────────────────────────────

const CreateProjectDialog = ({
  open,
  onOpenChange,
  onCreate,
  onAddTimelineEvents,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onCreate: (d: any) => Promise<any>;
  onAddTimelineEvents?: (projectId: string, events: { title: string; description?: string }[]) => Promise<void>;
}) => {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [company, setCompany] = useState("");
  const [value, setValue] = useState("");
  const [need, setNeed] = useState("");
  const [contactId, setContactId] = useState("");
  const [contacts, setContacts] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);

  // RAG fields
  const [ragEnabled, setRagEnabled] = useState(false);
  const [ragDomain, setRagDomain] = useState("");
  const [ragMode, setRagMode] = useState("total");
  const [autoPatterns, setAutoPatterns] = useState(true);

  // Audio extraction state
  const [audioProcessing, setAudioProcessing] = useState(false);
  const [audioStep, setAudioStep] = useState<"idle" | "transcribing" | "extracting" | "done">("idle");
  const [audioFileName, setAudioFileName] = useState("");
  const [extractedData, setExtractedData] = useState<any>(null);
  const [timelineEvents, setTimelineEvents] = useState<{ title: string; description?: string }[]>([]);

  useEffect(() => {
    if (open && user) {
      supabase
        .from("people_contacts")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name")
        .then(({ data }) => setContacts(data || []));
    }
    if (!open) {
      setAudioStep("idle");
      setAudioFileName("");
      setExtractedData(null);
      setTimelineEvents([]);
    }
  }, [open, user]);

  const handleAudioUpload = async (file: File) => {
    if (!file) return;
    setAudioFileName(file.name);
    setAudioProcessing(true);
    setAudioStep("transcribing");

    try {
      // Step 1: Transcribe via speech-to-text
      const formData = new FormData();
      formData.append("file", file);
      formData.append("language", "es");

      const { data: sttData, error: sttError } = await supabase.functions.invoke("speech-to-text", {
        body: formData,
      });

      if (sttError || !sttData?.text) {
        throw new Error(sttError?.message || "Error en la transcripción");
      }

      // Step 2: Extract project data
      setAudioStep("extracting");

      const { data: extractData, error: extractError } = await supabase.functions.invoke("extract-project-from-audio", {
        body: {
          transcription: sttData.text,
          contacts: contacts.map((c) => ({ id: c.id, name: c.name })),
        },
      });

      if (extractError || !extractData) {
        throw new Error(extractError?.message || "Error al extraer datos");
      }

      // Step 3: Fill form
      setExtractedData(extractData);
      if (extractData.project_name) setName(extractData.project_name);
      if (extractData.company) setCompany(extractData.company);
      if (extractData.estimated_value) setValue(String(extractData.estimated_value));
      if (extractData.need_summary) setNeed(extractData.need_summary);
      if (extractData.matched_contact_id) setContactId(extractData.matched_contact_id);
      if (extractData.timeline_events?.length) setTimelineEvents(extractData.timeline_events);

      setAudioStep("done");
      toast.success("Datos extraídos del audio");
    } catch (err: any) {
      console.error("Audio extraction error:", err);
      toast.error(err.message || "Error procesando audio");
      setAudioStep("idle");
      setAudioFileName("");
    } finally {
      setAudioProcessing(false);
    }
  };

  const clearAudioData = () => {
    setAudioStep("idle");
    setAudioFileName("");
    setExtractedData(null);
    setTimelineEvents([]);
    setName(""); setCompany(""); setValue(""); setNeed(""); setContactId("");
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setSaving(true);
    const result = await onCreate({
      name,
      company: company || undefined,
      estimated_value: value ? parseFloat(value) : undefined,
      need_summary: need || undefined,
      primary_contact_id: contactId || undefined,
      origin: extractedData ? "plaud_audio" : "manual",
      auto_patterns: ragEnabled ? autoPatterns : false,
    });

    // Add timeline events if available
    if (result?.id && timelineEvents.length > 0 && onAddTimelineEvents) {
      await onAddTimelineEvents(result.id, timelineEvents);
    }

    // If RAG enabled, create RAG project and link it
    if (result?.id && ragEnabled) {
      try {
        const domain = ragDomain || need || name;
        const { data: ragData, error: ragError } = await supabase.functions.invoke("rag-architect", {
          body: { action: "create", domainDescription: domain, moralMode: ragMode, projectId: result.id },
        });
        if (ragError) throw ragError;
        if (ragData?.ragId) {
          await supabase.from("business_projects").update({ linked_rag_id: ragData.ragId }).eq("id", result.id);
          toast.success("RAG vinculado al proyecto — construcción iniciada");
        }
      } catch (ragErr: any) {
        console.error("RAG creation error:", ragErr);
        toast.error("Proyecto creado pero error al crear RAG: " + (ragErr.message || "Error desconocido"));
      }
    }

    setSaving(false);
    setName(""); setCompany(""); setValue(""); setNeed(""); setContactId("");
    setExtractedData(null); setTimelineEvents([]);
    setRagEnabled(false); setRagDomain(""); setRagMode("total"); setAutoPatterns(true);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Nuevo proyecto</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {/* Audio Upload Area */}
          {audioStep === "idle" && (
            <label className="flex flex-col items-center gap-2 p-4 border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-primary/50 hover:bg-muted/5 transition-all">
              <Upload className="w-6 h-6 text-muted-foreground" />
              <span className="text-sm text-muted-foreground text-center">
                Sube un audio de la reunión para rellenar automáticamente
              </span>
              <span className="text-xs text-muted-foreground/60">.m4a, .mp3, .wav, .webm</span>
              <input
                type="file"
                accept=".m4a,.mp3,.wav,.webm,audio/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAudioUpload(file);
                  e.target.value = "";
                }}
              />
            </label>
          )}

          {(audioStep === "transcribing" || audioStep === "extracting") && (
            <div className="flex items-center gap-3 p-4 border border-border rounded-xl bg-muted/5">
              <Loader2 className="w-5 h-5 text-primary animate-spin shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{audioFileName}</p>
                <p className="text-xs text-muted-foreground">
                  {audioStep === "transcribing" ? "Transcribiendo audio..." : "Extrayendo datos del proyecto..."}
                </p>
              </div>
            </div>
          )}

          {audioStep === "done" && (
            <div className="flex items-center gap-3 p-3 border border-primary/30 rounded-xl bg-primary/5">
              <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">Datos extraídos del audio</p>
                <p className="text-xs text-muted-foreground truncate">{audioFileName}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={clearAudioData} className="shrink-0">
                <X className="w-4 h-4" />
              </Button>
            </div>
          )}

          {/* Form fields */}
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

          {timelineEvents.length > 0 && (
            <div className="p-3 border border-border rounded-xl bg-card">
              <p className="text-xs font-mono text-muted-foreground mb-2">EVENTOS DETECTADOS ({timelineEvents.length})</p>
              {timelineEvents.map((ev, i) => (
                <div key={i} className="text-xs text-foreground py-1">
                  • {ev.title}
                </div>
              ))}
            </div>
          )}

          {/* RAG Section */}
          <div className="space-y-3 p-3 border border-border rounded-xl bg-card">
            <div className="flex items-center gap-2">
              <Checkbox id="rag-enabled" checked={ragEnabled} onCheckedChange={(v) => setRagEnabled(!!v)} />
              <Label htmlFor="rag-enabled" className="flex items-center gap-1 cursor-pointer">
                <Brain className="w-4 h-4 text-primary" /> Generar base de conocimiento (RAG)
              </Label>
            </div>
            {ragEnabled && (
              <div className="space-y-2 ml-6">
                <div>
                  <Label className="text-xs">Dominio de conocimiento</Label>
                  <Textarea value={ragDomain} onChange={(e) => setRagDomain(e.target.value)} placeholder={need || "Descripción del dominio..."} rows={2} />
                </div>
                <div>
                  <Label className="text-xs">Modo de investigación</Label>
                  <Select value={ragMode} onValueChange={setRagMode}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="standard">Estándar (~500 fuentes)</SelectItem>
                      <SelectItem value="deep">Profundo (~2000 fuentes)</SelectItem>
                      <SelectItem value="total">Total (~5000+ fuentes)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox id="auto-patterns" checked={autoPatterns} onCheckedChange={(v) => setAutoPatterns(!!v)} />
                  <Label htmlFor="auto-patterns" className="text-xs cursor-pointer flex items-center gap-1">
                    <Sparkles className="w-3 h-3" /> Detectar patrones predictivos al completar
                  </Label>
                </div>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleCreate} disabled={!name.trim() || saving || audioProcessing}>
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
        onAddTimelineEvents={async (projectId, events) => {
          for (const ev of events) {
            await addTimelineEntry({
              project_id: projectId,
              event_date: new Date().toISOString(),
              channel: "plaud",
              title: ev.title,
              description: ev.description,
            });
          }
        }}
      />
    </main>
  );
};

export default Projects;
