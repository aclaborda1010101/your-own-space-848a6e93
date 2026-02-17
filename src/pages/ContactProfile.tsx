import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Progress } from "@/components/ui/progress";
import {
  ArrowLeft, Briefcase, User, Baby, Save, MessageSquare, Calendar,
  X, Trash2, Clock, AlertTriangle, Star, TrendingUp, Phone, Edit2,
  CheckCircle2, ArrowRight, Tag, Plus, Loader2, Upload, RefreshCw,
  BarChart3, Users
} from "lucide-react";
import { format, differenceInDays } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

const BRAIN_OPTIONS = [
  { value: "professional", label: "Profesional", icon: Briefcase, color: "text-blue-400" },
  { value: "personal", label: "Personal", icon: User, color: "text-emerald-400" },
  { value: "bosco", label: "Familiar", icon: Baby, color: "text-amber-400" },
];

function getRelationshipStatus(lastContact: string | null, interactionCount: number) {
  if (!lastContact) return { label: "Sin datos", color: "text-muted-foreground" };
  const days = differenceInDays(new Date(), new Date(lastContact));
  if (days <= 7 && interactionCount >= 5) return { label: "Frecuente", color: "text-emerald-400" };
  if (days <= 14) return { label: "Activo", color: "text-blue-400" };
  if (days <= 60) return { label: "Esporádico", color: "text-amber-400" };
  return { label: "Inactivo", color: "text-red-400" };
}

function getSentimentDot(sentiment: string | null | undefined) {
  if (!sentiment) return null;
  const s = sentiment.toLowerCase();
  if (s === "positive" || s === "positivo") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" title="Positivo" />;
  if (s === "negative" || s === "negativo") return <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Negativo" />;
  return <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" title="Neutro" />;
}

function parseWhatsAppChat(text: string): Array<{ date: string; time: string; sender: string; message: string }> {
  const lines = text.split("\n");
  const messages: Array<{ date: string; time: string; sender: string; message: string }> = [];
  // Support multiple WhatsApp export formats:
  // "dd/mm/yyyy, HH:MM - Name: msg"
  // "[dd/mm/yyyy, HH:MM:SS] Name: msg" (iOS)
  // "dd/mm/yy HH:MM a. m. - Name: msg" (AM/PM)
  // "dd-mm-yyyy HH:MM - Name: msg"
  const regexes = [
    // Standard: 15/01/2024, 10:30 - Juan: Hola
    /^\[?(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[ap]\.?\s*m\.?)?)\]?\s*[-–—]?\s*(.+?):\s*(.+)$/i,
    // Bracket format: [15/01/2024, 10:30:45] Juan: Hola
    /^\[(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}),?\s+(\d{1,2}:\d{2}(?::\d{2})?)\]\s*(.+?):\s*(.+)$/,
  ];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    for (const regex of regexes) {
      const match = trimmed.match(regex);
      if (match) {
        messages.push({ date: match[1], time: match[2].trim(), sender: match[3].trim(), message: match[4].trim() });
        break;
      }
    }
  }
  return messages;
}

export default function ContactProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newNote, setNewNote] = useState("");
  const [showWhatsAppImport, setShowWhatsAppImport] = useState(false);
  const [whatsAppText, setWhatsAppText] = useState("");
  const [importingWhatsApp, setImportingWhatsApp] = useState(false);
  const [form, setForm] = useState({
    name: "", company: "", role: "", relationship: "", brain: "", email: "",
  });

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("people_contacts")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && !!user,
  });

  const { data: threads = [] } = useQuery({
    queryKey: ["contact-threads", contact?.name],
    queryFn: async () => {
      if (!contact?.name) return [];
      const { data } = await supabase
        .from("conversation_embeddings")
        .select("id, date, brain, summary, people, transcription_id, metadata")
        .contains("people", [contact.name])
        .order("date", { ascending: false })
        .limit(100);
      const seen = new Set<string>();
      const unique: any[] = [];
      for (const row of data || []) {
        const key = row.transcription_id || row.id;
        if (seen.has(key)) continue;
        seen.add(key);
        unique.push(row);
      }
      return unique;
    },
    enabled: !!contact?.name,
  });

  const { data: commitments = [] } = useQuery({
    queryKey: ["contact-commitments", contact?.name],
    queryFn: async () => {
      if (!contact?.name) return [];
      const { data } = await supabase
        .from("commitments")
        .select("*")
        .ilike("person_name", contact.name)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!contact?.name,
  });

  const { data: followUps = [] } = useQuery({
    queryKey: ["contact-followups", contact?.name],
    queryFn: async () => {
      if (!contact?.name) return [];
      const { data } = await supabase
        .from("follow_ups")
        .select("*")
        .ilike("topic", `%${contact.name}%`)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!contact?.name,
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["contact-interactions", contact?.id],
    queryFn: async () => {
      if (!contact?.id) return [];
      const { data } = await supabase
        .from("interactions")
        .select("*")
        .eq("contact_id", contact.id)
        .order("date", { ascending: false })
        .limit(30);
      return data || [];
    },
    enabled: !!contact?.id,
  });

  // Top contacts for "Personas clave" section
  const { data: topContacts = [] } = useQuery({
    queryKey: ["top-contacts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("people_contacts")
        .select("id, name, interaction_count, last_contact, brain, sentiment")
        .order("interaction_count", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user,
  });

  const updateContact = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const oldName = contact?.name;
      const { error } = await supabase.from("people_contacts").update(updates).eq("id", id);
      if (error) throw error;
      if (updates.name && updates.name !== oldName) {
        const { data: rows } = await supabase.from("conversation_embeddings").select("id, people").contains("people", [oldName]);
        for (const row of rows || []) {
          const updatedPeople = (row.people || []).map((p: string) => p === oldName ? updates.name : p);
          await supabase.from("conversation_embeddings").update({ people: updatedPeople }).eq("id", row.id);
        }
      }
    },
    onSuccess: () => {
      toast.success("Contacto actualizado");
      setEditing(false);
      queryClient.invalidateQueries({ queryKey: ["contact-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["people-contacts"] });
    },
    onError: () => toast.error("Error al guardar"),
  });

  const deleteContact = useMutation({
    mutationFn: async () => {
      await supabase.from("people_contacts").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Contacto eliminado");
      navigate("/contacts");
    },
  });

  const addTag = () => {
    if (!newTag.trim() || !contact) return;
    const tags = [...(contact.ai_tags || []), newTag.trim()];
    updateContact.mutate({ ai_tags: tags });
    setNewTag("");
  };

  const removeTag = (tag: string) => {
    if (!contact) return;
    const tags = (contact.ai_tags || []).filter((t: string) => t !== tag);
    updateContact.mutate({ ai_tags: tags });
  };

  const contactNotes: Array<{ text: string; date: string }> = (() => {
    if (!contact) return [];
    const meta = contact.metadata as any;
    return Array.isArray(meta?.notes) ? meta.notes : [];
  })();

  const addNote = () => {
    if (!newNote.trim() || !contact) return;
    const notes = [...contactNotes, { text: newNote.trim(), date: new Date().toISOString() }];
    const meta = (contact?.metadata as any) || {};
    updateContact.mutate({ metadata: { ...meta, notes } });
    setNewNote("");
  };

  const handleWhatsAppImport = async () => {
    if (!whatsAppText.trim() || !contact) return;
    setImportingWhatsApp(true);
    try {
      const parsed = parseWhatsAppChat(whatsAppText);
      if (parsed.length === 0) {
        toast.error("No se detectaron mensajes de WhatsApp válidos");
        return;
      }
      // Process as transcription text
      const fullText = parsed.map(m => `[${m.date} ${m.time}] ${m.sender}: ${m.message}`).join("\n");
      const { error } = await supabase.functions.invoke("process-transcription", {
        body: { text: fullText, source: "whatsapp", contact_name: contact.name },
      });
      if (error) throw error;
      toast.success(`${parsed.length} mensajes importados y procesados`);
      setWhatsAppText("");
      setShowWhatsAppImport(false);
      queryClient.invalidateQueries({ queryKey: ["contact-threads"] });
      queryClient.invalidateQueries({ queryKey: ["contact-detail", id] });
    } catch (e: any) {
      toast.error(e.message || "Error al importar");
    } finally {
      setImportingWhatsApp(false);
    }
  };

  if (isLoading) {
    return (
      <main className="p-4 lg:p-6 flex items-center justify-center min-h-[50vh]">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </main>
    );
  }

  if (!contact) {
    return (
      <main className="p-4 lg:p-6 space-y-6">
        <Breadcrumbs />
        <p className="text-muted-foreground text-center py-12">Contacto no encontrado</p>
      </main>
    );
  }

  const brainInfo = BRAIN_OPTIONS.find(b => b.value === contact.brain) || BRAIN_OPTIONS[1];
  const status = getRelationshipStatus(contact.last_contact, contact.interaction_count || 0);
  const daysSince = contact.last_contact ? differenceInDays(new Date(), new Date(contact.last_contact)) : null;

  // Scoring metrics
  const frequencyScore = Math.min(100, ((contact.interaction_count || 0) / 20) * 100);
  const recencyScore = daysSince !== null ? Math.max(0, 100 - daysSince * 2) : 0;
  const overallScore = Math.round((frequencyScore + recencyScore) / 2);

  // Personality profile
  const pp = (contact as any).personality_profile as any;

  // Observations & tips from metadata
  const obs = (contact.metadata as any)?.observations as any;

  // Generate insights
  const insights: Array<{ icon: string; text: string; type: "info" | "warning" | "success" }> = [];
  if (threads.length > 0) {
    const topPeople: Record<string, number> = {};
    threads.forEach((t: any) => {
      (t.people || []).filter((p: string) => p !== contact.name).forEach((p: string) => {
        topPeople[p] = (topPeople[p] || 0) + 1;
      });
    });
    const sorted = Object.entries(topPeople).sort((a, b) => b[1] - a[1]);
    if (sorted.length > 0) {
      insights.push({ icon: "👥", text: `Persona más activa: ${sorted[0][0]} con ${sorted[0][1]} interacciones`, type: "info" });
    }
  }
  if (daysSince !== null && daysSince > 30) {
    insights.push({ icon: "⚠️", text: `Llevas ${daysSince} días que no hablas con ${contact.name}`, type: "warning" });
  }
  if ((contact.interaction_count || 0) >= 10) {
    insights.push({ icon: "🔥", text: `${contact.name} es uno de tus contactos más activos con ${contact.interaction_count} interacciones`, type: "success" });
  }
  if (contact.sentiment) {
    const sentLabel = contact.sentiment === "positive" || contact.sentiment === "positivo" ? "positivo" : contact.sentiment === "negative" || contact.sentiment === "negativo" ? "negativo" : "neutro";
    insights.push({ icon: "💬", text: `Sentimiento general de las conversaciones: ${sentLabel}`, type: "info" });
  }

  return (
    <>
      <main className="p-4 lg:p-6 space-y-6 max-w-5xl mx-auto">
        <Breadcrumbs />

        {/* Header */}
        <div className="flex items-start gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="mt-1">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-2xl font-bold text-primary">
              {contact.name?.charAt(0)?.toUpperCase() || "?"}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-foreground">{contact.name}</h1>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              <Badge variant="outline" className={brainInfo.color}>
                <brainInfo.icon className="w-3 h-3 mr-1" />
                {brainInfo.label}
              </Badge>
              <Badge variant="secondary" className={status.color}>{status.label}</Badge>
              {contact.relationship && <Badge variant="outline">{contact.relationship}</Badge>}
              {contact.company && <Badge variant="secondary">🏢 {contact.company}</Badge>}
              {contact.role && <Badge variant="secondary">💼 {contact.role}</Badge>}
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button size="sm" variant="outline" onClick={() => setShowWhatsAppImport(!showWhatsAppImport)}>
              📱 {showWhatsAppImport ? "Cerrar" : "Importar WhatsApp"}
            </Button>
            <Button size="sm" variant="outline" onClick={() => { setForm({ name: contact.name || "", company: contact.company || "", role: contact.role || "", relationship: contact.relationship || "", brain: contact.brain || "personal", email: contact.email || "" }); setEditing(!editing); }}>
              <Edit2 className="w-4 h-4 mr-1" /> {editing ? "Cancelar" : "Editar"}
            </Button>
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`¿Eliminar "${contact.name}"?`)) deleteContact.mutate(); }}>
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* WhatsApp Import */}
        {showWhatsAppImport && (
          <Card className="border-emerald-500/20 bg-emerald-500/5">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">💬 Importar chat de WhatsApp</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Pega la exportación de WhatsApp (formato: dd/mm/yyyy, HH:MM - nombre: mensaje)</p>
              <Textarea
                value={whatsAppText}
                onChange={e => setWhatsAppText(e.target.value)}
                placeholder="01/02/2025, 10:30 - Juan: Hola, ¿cómo va el proyecto?"
                className="min-h-[100px] text-xs"
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">
                  {whatsAppText.trim() ? `${parseWhatsAppChat(whatsAppText).length} mensajes detectados` : ""}
                </span>
                <Button size="sm" onClick={handleWhatsAppImport} disabled={importingWhatsApp || !whatsAppText.trim()}>
                  {importingWhatsApp ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
                  Importar y procesar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Edit form */}
        {editing && (
          <Card>
            <CardContent className="pt-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-xs">Nombre</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="h-9" /></div>
                <div><Label className="text-xs">Email</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="h-9" type="email" /></div>
                <div><Label className="text-xs">Empresa</Label><Input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className="h-9" /></div>
                <div><Label className="text-xs">Rol</Label><Input value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="h-9" /></div>
                <div><Label className="text-xs">Relación</Label><Input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} className="h-9" /></div>
                <div><Label className="text-xs">Cerebro</Label>
                  <Select value={form.brain} onValueChange={v => setForm(f => ({ ...f, brain: v }))}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>{BRAIN_OPTIONS.map(b => <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <Button size="sm" onClick={() => updateContact.mutate({ name: form.name.trim() || contact.name, company: form.company || null, role: form.role || null, relationship: form.relationship || null, brain: form.brain, email: form.email || null })} disabled={updateContact.isPending}>
                <Save className="w-3.5 h-3.5 mr-1" /> Guardar
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{contact.interaction_count || 0}</p>
              <p className="text-xs text-muted-foreground">Interacciones</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold" style={{ color: daysSince !== null && daysSince > 30 ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}>
                {daysSince !== null ? `${daysSince}d` : "—"}
              </p>
              <p className="text-xs text-muted-foreground">Último contacto</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{overallScore}%</p>
              <p className="text-xs text-muted-foreground">Score CRM</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-2xl font-bold text-primary">{threads.length}</p>
              <p className="text-xs text-muted-foreground">Conversaciones</p>
            </CardContent>
          </Card>
        </div>

        {/* Personas clave */}
        {topContacts.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-primary" />
                Personas clave del período
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-3">
                {topContacts.map((tc: any) => {
                  const isCurrent = tc.id === id;
                  return (
                    <div
                      key={tc.id}
                      className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${isCurrent ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}
                      onClick={() => !isCurrent && navigate(`/contacts/${tc.id}`)}
                    >
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                        {tc.name?.charAt(0)?.toUpperCase()}
                      </div>
                      <div>
                        <p className="text-xs font-medium text-foreground">{tc.name}</p>
                        <div className="flex items-center gap-1">
                          <span className="text-[10px] text-muted-foreground">{tc.interaction_count || 0} interacciones</span>
                          {getSentimentDot(tc.sentiment)}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Personality & Profile Section */}
        {pp && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                🧠 Personalidad y perfil
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {pp.traits?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Perfil psicológico</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pp.traits.map((t: string) => {
                      const traitColors: Record<string, string> = {
                        "Analítico": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
                        "Empático": "bg-purple-500/20 text-purple-400 border-purple-500/30",
                        "Impuntual": "bg-red-500/20 text-red-400 border-red-500/30",
                        "Organizado": "bg-blue-500/20 text-blue-400 border-blue-500/30",
                        "Creativo": "bg-amber-500/20 text-amber-400 border-amber-500/30",
                        "Directo": "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
                        "Reservado": "bg-slate-500/20 text-slate-400 border-slate-500/30",
                      };
                      return (
                        <Badge key={t} variant="outline" className={traitColors[t] || "bg-muted text-muted-foreground border-border"}>
                          {t}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}
              {pp.communication_style && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Comunicación</p>
                  <Badge className={{
                    "Formal": "bg-blue-500/20 text-blue-400",
                    "Informal": "bg-amber-500/20 text-amber-400",
                    "Técnico": "bg-cyan-500/20 text-cyan-400",
                    "Emocional": "bg-pink-500/20 text-pink-400",
                  }[pp.communication_style] || "bg-muted text-muted-foreground"}>
                    {pp.communication_style}
                  </Badge>
                </div>
              )}
              {pp.interests?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Intereses</p>
                  <div className="flex flex-wrap gap-1.5">
                    {pp.interests.map((i: string) => (
                      <Badge key={i} variant="secondary" className="text-xs">{i}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {pp.interaction_description && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-1.5">Cómo es conmigo</p>
                  <p className="text-sm text-foreground/80 italic leading-relaxed">"{pp.interaction_description}"</p>
                </div>
              )}
              {(pp.trust_level ?? 0) > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-medium text-muted-foreground">Confianza</p>
                    <span className="text-xs font-bold text-primary">{pp.trust_level}/10</span>
                  </div>
                  <Progress value={pp.trust_level * 10} className="h-2" />
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Observaciones y consejos */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                💡 Observaciones y consejos
              </CardTitle>
              <Button size="sm" variant="ghost" className="text-xs gap-1 text-muted-foreground hover:text-primary" onClick={() => {
                toast.info("Regeneración con IA próximamente disponible");
              }}>
                <RefreshCw className="w-3 h-3" /> Regenerar con IA
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Interaction tips */}
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1.5">Consejos de interacción</p>
              {obs?.tips?.length > 0 ? (
                <ul className="space-y-1.5">
                  {obs.tips.map((tip: string, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-foreground/80">
                      <span className="text-primary mt-0.5">•</span>
                      {tip}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-muted-foreground italic">
                  {threads.length > 0
                    ? "Los consejos se generarán automáticamente al procesar más conversaciones"
                    : "Sin datos suficientes aún"}
                </p>
              )}
            </div>

            {/* Detected interests */}
            {obs?.detected_interests?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">Intereses detectados</p>
                <div className="flex flex-wrap gap-1.5">
                  {obs.detected_interests.map((interest: string, i: number) => (
                    <Badge key={i} variant="secondary" className="text-xs">{interest}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Sensitive topics */}
            {obs?.sensitive_topics?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1.5">⚠️ Temas sensibles / evitar</p>
                <div className="flex flex-wrap gap-1.5">
                  {obs.sensitive_topics.map((topic: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs bg-red-500/10 text-red-400 border-red-500/20">{topic}</Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column: Timeline */}
          <div className="lg:col-span-2 space-y-6">
            {/* Timeline */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" />
                  Timeline de conversaciones ({threads.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 max-h-[500px] overflow-y-auto">
                {threads.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Sin conversaciones registradas</p>
                ) : threads.map((thread: any) => (
                  <div key={thread.id} className="p-3 rounded-lg border border-border hover:border-primary/20 transition-colors">
                    <div className="flex items-center gap-2 mb-1">
                      <Calendar className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(thread.date), "d MMM yyyy", { locale: es })}
                      </span>
                      {thread.brain && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {thread.brain === "professional" ? "Prof" : thread.brain === "personal" ? "Pers" : "Fam"}
                        </Badge>
                      )}
                      {/* Sentiment dot */}
                      {getSentimentDot(thread.metadata?.sentiment)}
                    </div>
                    {thread.metadata?.title && (
                      <p className="text-xs font-medium text-foreground mb-0.5">{thread.metadata.title}</p>
                    )}
                    <p className="text-sm text-muted-foreground line-clamp-2">{thread.summary}</p>
                    {thread.people?.length > 1 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {thread.people.filter((p: string) => p !== contact.name).map((p: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] px-1.5 py-0">{p}</Badge>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Commitments & Follow-ups */}
            {(commitments.length > 0 || followUps.length > 0) && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-orange-400" />
                    Compromisos y seguimientos ({commitments.length + followUps.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {commitments.map((c: any) => (
                    <div key={c.id} className="p-2 rounded bg-muted/50 text-sm">
                      <p>{c.description}</p>
                      <div className="flex gap-2 text-xs text-muted-foreground mt-1">
                        <Badge variant={c.status === "pending" ? "default" : "secondary"} className="text-[10px]">{c.status}</Badge>
                        {c.deadline && <span>📅 {c.deadline}</span>}
                      </div>
                    </div>
                  ))}
                  {followUps.map((f: any) => (
                    <div key={f.id} className="p-2 rounded bg-muted/50 text-sm flex items-center gap-2">
                      <ArrowRight className="w-3 h-3 text-violet-400 shrink-0" />
                      <span>{f.topic}</span>
                      {f.resolve_by && <span className="text-xs text-muted-foreground ml-auto">antes de {f.resolve_by}</span>}
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          {/* Right column: Tags, Notes, Scoring */}
          <div className="space-y-6">
            {/* Tags */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  Etiquetas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-1">
                  {(contact.ai_tags || []).map((tag: string, i: number) => (
                    <Badge key={i} variant="outline" className="text-xs group">
                      {tag}
                      <button onClick={() => removeTag(tag)} className="ml-1 opacity-0 group-hover:opacity-100"><X className="w-3 h-3" /></button>
                    </Badge>
                  ))}
                  {(!contact.ai_tags || contact.ai_tags.length === 0) && (
                    <p className="text-xs text-muted-foreground">Sin etiquetas</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Input value={newTag} onChange={e => setNewTag(e.target.value)} placeholder="Nueva etiqueta" className="h-8 text-xs" onKeyDown={e => e.key === "Enter" && addTag()} />
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0" onClick={addTag}><Plus className="w-3.5 h-3.5" /></Button>
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Edit2 className="w-4 h-4 text-primary" />
                  Notas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {contactNotes.map((note: any, i: number) => (
                  <div key={i} className="p-2 rounded bg-muted/50 text-xs">
                    <p>{note.text || note}</p>
                    {note.date && <p className="text-muted-foreground mt-1">{format(new Date(note.date), "d MMM yyyy", { locale: es })}</p>}
                  </div>
                ))}
                <Textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Añadir nota..." className="min-h-[60px] text-xs" />
                <Button size="sm" variant="outline" className="w-full" onClick={addNote} disabled={!newNote.trim()}>
                  <Plus className="w-3.5 h-3.5 mr-1" /> Añadir nota
                </Button>
              </CardContent>
            </Card>

            {/* Scoring */}
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-primary" />
                  Métricas CRM
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Frecuencia</span>
                    <span>{Math.round(frequencyScore)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${frequencyScore}%` }} />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Recencia</span>
                    <span>{Math.round(recencyScore)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${recencyScore}%` }} />
                  </div>
                </div>
                <Separator />
                <div className="flex justify-between text-sm font-medium">
                  <span>Score general</span>
                  <span className="text-primary">{overallScore}%</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Insights del período */}
        {insights.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary" />
                📊 Insights
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {insights.map((insight, i) => (
                <div key={i} className={`flex items-start gap-2 p-2 rounded-lg text-sm ${
                  insight.type === "warning" ? "bg-amber-500/10 border border-amber-500/20" :
                  insight.type === "success" ? "bg-emerald-500/10 border border-emerald-500/20" :
                  "bg-muted/50 border border-border"
                }`}>
                  <span>{insight.icon}</span>
                  <span className="text-foreground/80">{insight.text}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </main>
    </>
  );
}
