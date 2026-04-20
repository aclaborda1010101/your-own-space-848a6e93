import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HeadlineCard } from "@/components/contact/HeadlineCard";
import { PodcastPlayer } from "@/components/contact/PodcastPlayer";
import { HealthMeter } from "@/components/contact/HealthMeter";
import { ConversationTimeline } from "@/components/contact/ConversationTimeline";
import { JarvisSuggestionHero } from "@/components/contact/JarvisSuggestionHero";
import { ContactKpiStrip } from "@/components/contact/ContactKpiStrip";
import { formatDistanceToNowStrict } from "date-fns";
import {
  WhatsAppTab,
  EmailTab,
  PlaudTab,
  ProfileKnownData,
} from "@/components/contacts/ContactTabs";
import SuggestedResponses from "@/components/contacts/SuggestedResponses";
import { useContactHeadlines } from "@/hooks/useContactHeadlines";
import { useContactPodcast } from "@/hooks/useContactPodcast";
import { useContactProfile } from "@/hooks/useContactProfile";
import { ProfileByScope } from "@/components/contact/ProfileByScope";
import { RelationshipTimelineChart } from "@/components/contact/RelationshipTimelineChart";
import {
  ArrowLeft,
  ArrowRight,
  Phone,
  MessageCircle,
  Bell,
  Activity,
  AlertCircle,
  MessageSquare,
  Network,
  Loader2,
  Save,
  Brain,
  Mail,
  Mic,
  Sparkles,
  RefreshCw,
  Briefcase,
  Heart,
  Users,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { toast } from "sonner";

interface Contact {
  id: string;
  name: string;
  category: string | null;
  categories?: string[] | null;
  wa_id: string | null;
  phone_numbers: string[] | null;
  last_contact: string | null;
  context: string | null;
  personality_profile?: any;
  role?: string | null;
  company?: string | null;
  brain?: string | null;
  relationship?: string | null;
  email?: string | null;
  wa_message_count?: number | null;
  scores?: { health?: number } | null;
  sentiment?: string | null;
  ai_tags?: string[] | null;
}

interface MsgRow {
  id: string;
  direction: "incoming" | "outgoing";
  sender: string | null;
  content: string;
  message_date: string;
}

export default function ContactDetail() {
  const { contactId } = useParams<{ contactId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [contact, setContact] = useState<Contact | null>(null);
  const [messages, setMessages] = useState<MsgRow[]>([]);
  const [totalMessages, setTotalMessages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [refreshingProfile, setRefreshingProfile] = useState(false);
  const [activeScope, setActiveScope] = useState<"profesional" | "personal" | "familiar">("profesional");
  const [linkedTasks, setLinkedTasks] = useState<Array<{
    id: string;
    title: string;
    completed: boolean;
    priority: string;
    created_at: string;
    completed_at: string | null;
  }>>([]);

  const { payload: headlines, loading: hLoading, refresh: refreshHeadlines } = useContactHeadlines(contactId || null);
  const { podcast, segment, busy, regenerate, setFormat } = useContactPodcast(contactId || null);
  const { profile, allContacts, contactLinks, linkContact, ignoreContact, reload: reloadProfile } =
    useContactProfile(contactId, user?.id);

  async function refreshProfile() {
    if (!contactId || !user || refreshingProfile) return;
    setRefreshingProfile(true);
    const tId = toast.loading("Reanalizando perfil…", { description: "Tarda 30-90s." });
    try {
      const { error } = await supabase.functions.invoke("contact-analysis", {
        body: {
          contact_id: contactId,
          user_id: user.id,
          scopes: ["profesional", "personal", "familiar"],
          include_historical: false,
        },
      });
      if (error) throw error;
      toast.success("Perfil actualizado", { id: tId });
      await Promise.all([load(), reloadProfile()]);
    } catch (e) {
      toast.error("No se pudo actualizar", { id: tId, description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRefreshingProfile(false);
    }
  }

  useEffect(() => {
    if (!contactId || !user) return;
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, user?.id]);

  const [plaudRecordings, setPlaudRecordings] = useState<any[]>([]);
  const [plaudThreads, setPlaudThreads] = useState<any[]>([]);

  async function load() {
    setLoading(true);
    try {
      const { data: c } = await supabase
        .from("people_contacts")
        .select("id,name,category,categories,wa_id,phone_numbers,last_contact,context,role,company,brain,relationship,email,wa_message_count,personality_profile,metadata,ai_tags,scores,sentiment")
        .eq("id", contactId!)
        .maybeSingle();
      setContact((c as Contact) || null);
      setNotes((c as Contact)?.context || "");

      const { count } = await supabase
        .from("contact_messages")
        .select("id", { count: "exact", head: true })
        .eq("contact_id", contactId!)
        .eq("user_id", user!.id);
      setTotalMessages(count || 0);

      const { data: msgs } = await supabase
        .from("contact_messages")
        .select("id, direction, sender, content, message_date")
        .eq("contact_id", contactId!)
        .eq("user_id", user!.id)
        .order("message_date", { ascending: false })
        .limit(150);
      setMessages(((msgs as MsgRow[]) || []).reverse());

      // Plaud data (recordings + threads linked to this contact)
      try {
        const { data: recs } = await (supabase as any)
          .from("plaud_recordings")
          .select("id, title, received_at, agent_type, summary, audio_url")
          .contains("linked_contact_ids", [contactId!])
          .order("received_at", { ascending: false })
          .limit(50);
        setPlaudRecordings(recs || []);
      } catch { /* table may not exist for some users */ }

      try {
        const { data: thr } = await (supabase as any)
          .from("plaud_threads")
          .select("id, event_title, event_date, recording_ids, speakers, agent_type")
          .contains("linked_contact_ids", [contactId!])
          .order("event_date", { ascending: false })
          .limit(50);
        setPlaudThreads(thr || []);
      } catch { /* ignore */ }

      // Tareas vinculadas a este contacto
      try {
        const { data: lt } = await supabase
          .from("tasks")
          .select("id, title, completed, priority, created_at, completed_at")
          .eq("contact_id", contactId!)
          .eq("user_id", user!.id)
          .order("created_at", { ascending: false })
          .limit(50);
        setLinkedTasks((lt as any) || []);
      } catch { /* ignore */ }
    } finally {
      setLoading(false);
    }
  }

  const phone = contact?.wa_id || contact?.phone_numbers?.[0] || "";
  const initials = useMemo(
    () =>
      (contact?.name || "")
        .split(/\s+/)
        .slice(0, 2)
        .map((p) => p[0]?.toUpperCase() || "")
        .join("") || "?",
    [contact?.name],
  );

  async function saveNotes() {
    if (!contactId) return;
    setSavingNotes(true);
    try {
      const { error } = await supabase
        .from("people_contacts")
        .update({ context: notes })
        .eq("id", contactId);
      if (error) throw error;
      toast.success("Notas guardadas");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSavingNotes(false);
    }
  }

  // Quotable moments: longest user-side messages with letters
  const quotables = useMemo(() => {
    return [...messages]
      .filter((m) => m.direction === "incoming" && /\p{L}/u.test(m.content))
      .sort((a, b) => b.content.length - a.content.length)
      .slice(0, 4);
  }, [messages]);

  if (loading || !contact) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasHealth = typeof contact.scores?.health === "number";
  const healthScore = contact.scores?.health ?? 5;
  const sentimentCls =
    contact.sentiment === "positive" ? "bg-success/10 border-success/30 text-success" :
    contact.sentiment === "negative" ? "bg-destructive/10 border-destructive/30 text-destructive" :
    "bg-muted/20 border-border text-muted-foreground";
  const scopedProfile = profile && typeof profile === "object"
    ? (!profile.ambito && (profile.profesional || profile.personal || profile.familiar)
        ? (profile[activeScope] || {})
        : profile)
    : null;
  const nextAction = scopedProfile?.proxima_accion;
  const brainMeta = contact.brain === "profesional"
    ? { icon: <Briefcase className="w-3 h-3" />, label: "profesional" }
    : contact.brain === "familiar"
    ? { icon: <Users className="w-3 h-3" />, label: "familiar" }
    : contact.brain === "personal"
    ? { icon: <Heart className="w-3 h-3" />, label: "personal" }
    : null;

  return (
    <div className="min-h-screen bg-background relative">
      {/* Ambient glow */}
      <div className="absolute inset-x-0 top-0 h-[400px] pointer-events-none overflow-hidden">
        <div className="absolute -top-32 left-1/4 w-[600px] h-[500px] bg-primary/10 blur-[120px] rounded-full opacity-60" />
        <div className="absolute top-10 right-10 w-[400px] h-[400px] bg-accent/10 blur-[100px] rounded-full opacity-40" />
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/red-estrategica")}
          className="text-muted-foreground hover:text-primary -ml-2"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Volver a la red
        </Button>

        {/* HEADER COMPACTO — identidad */}
        <GlassCard className="p-5 sm:p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03] pointer-events-none" />
          <div className="relative flex flex-col sm:flex-row sm:items-center gap-5">
            {/* Avatar */}
            <div className="shrink-0">
              <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl bg-gradient-to-br from-primary/40 via-primary/15 to-accent/10 border border-primary/30 flex items-center justify-center text-2xl sm:text-3xl font-display font-semibold shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]">
                {initials}
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-1.5 font-mono">
                <Sparkles className="w-3 h-3" />
                <span>Red estratégica · Expediente</span>
              </div>
              <h1 className="font-serif text-2xl sm:text-3xl lg:text-4xl font-medium tracking-tight leading-[1.05]">
                {contact.name}
                {contact.role && (
                  <span className="text-muted-foreground font-sans font-normal text-lg sm:text-xl ml-2">
                    / {contact.role}
                  </span>
                )}
              </h1>
              {contact.company && (
                <p className="text-sm text-muted-foreground mt-1">{contact.company}</p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-2.5">
                {contact.category && (
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium">
                    {contact.category}
                  </span>
                )}
                {contact.sentiment && (
                  <span className={`px-2.5 py-1 rounded-full border text-[11px] font-medium capitalize ${sentimentCls}`}>
                    {contact.sentiment}
                  </span>
                )}
                {contact.ai_tags?.slice(0, 3).map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-card/50 border border-border text-muted-foreground text-[11px]">
                    {t}
                  </span>
                ))}
                {brainMeta && (
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium inline-flex items-center gap-1.5">
                    {brainMeta.icon}
                    {brainMeta.label}
                  </span>
                )}
                {contact.relationship && (
                  <span className="px-2.5 py-1 rounded-full bg-card/50 border border-border text-foreground/80 text-[11px]">
                    {contact.relationship}
                  </span>
                )}
                {!!(contact.wa_message_count ?? totalMessages) && (
                  <span className="px-2.5 py-1 rounded-full bg-success/10 border border-success/30 text-success text-[11px] font-medium">
                    {contact.wa_message_count ?? totalMessages} msgs WA
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              {phone && (
                <a href={`tel:${phone}`}>
                  <Button variant="outline" size="sm" className="rounded-full">
                    <Phone className="w-4 h-4 mr-2" /> Llamar
                  </Button>
                </a>
              )}
              {phone && (
                <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button size="sm" className="rounded-full">
                    <MessageCircle className="w-4 h-4 mr-2" /> WhatsApp
                  </Button>
                </a>
              )}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => navigate(`/tasks?contact=${contact.id}`)}
              >
                <Bell className="w-4 h-4 mr-2" /> Recordatorio
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={refreshProfile}
                disabled={refreshingProfile}
                title="Reanaliza el perfil con los últimos WhatsApp y emails"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshingProfile ? "animate-spin" : ""}`} />
                {refreshingProfile ? "Analizando…" : "Actualizar"}
              </Button>
            </div>
          </div>
        </GlassCard>

        {/* JARVIS SUGIERE — bloque protagonista */}
        {headlines && (() => {
          const fresh = headlines.pending.freshness_status ?? "active";
          const isExpired = fresh === "expired";
          const isExpiring = fresh === "expiring";
          const isStale = fresh === "stale";
          const hasLivePending = !isExpired && !isStale && headlines.pending.title !== "Sin asunto vivo";
          // Fallback: si headlines no tiene asunto vivo pero el perfil tiene proxima_accion,
          // úsala como asunto vivo para evitar la incoherencia visual.
          const useNextActionFallback = !hasLivePending && !!nextAction?.que;
          return (
            <JarvisSuggestionHero
              headline={
                useNextActionFallback ? (
                  <>
                    {String(nextAction.que).split(/(:|—|·)/)[0]}{" "}
                    {headlines.health.trend && (
                      <span className="text-foreground/80">{headlines.health.trend}</span>
                    )}
                  </>
                ) : !hasLivePending ? (
                  <span className="text-muted-foreground">
                    Sin asunto vivo · la recomendación anterior ya pasó o perdió vigencia.{" "}
                    {headlines.health.trend && (
                      <span className="text-foreground/70">{headlines.health.trend}</span>
                    )}
                  </span>
                ) : (
                  <>
                    {headlines.pending.title.split(/(:|—|·)/)[0]}{" "}
                    <span className="text-success">{headlines.pending.who_owes}</span>.{" "}
                    {headlines.health.trend && (
                      <span className="text-foreground/80">{headlines.health.trend}</span>
                    )}
                  </>
                )
              }
              pretext={
                useNextActionFallback
                  ? `Sugerencia desde perfil · canal: ${nextAction.canal || "—"}`
                  : !hasLivePending
                  ? "Recomendación caducada · movida a historial"
                  : isExpiring
                  ? "⏳ Caduca en las próximas horas · " + headlines.pending.last_mentioned
                  : isStale
                  ? "Sin evidencia reciente · " + headlines.pending.last_mentioned
                  : headlines.pending.last_mentioned
              }
              context={`${headlines.health.relationship_type} — salud relacional ${headlines.health.score}/10 (${headlines.health.label}).`}
              confidence={Math.round((headlines.health.score / 10) * 100)}
              priority={useNextActionFallback ? "media" : !hasLivePending ? "baja" : healthScore < 4 ? "alta" : healthScore < 7 ? "media" : "baja"}
              detectedAgo={
                contact.last_contact
                  ? formatDistanceToNowStrict(new Date(contact.last_contact), { locale: es })
                  : undefined
              }
              tags={[
                contact.category || "personal",
                totalMessages > 1000 ? "histórico denso" : "activo",
                ...(useNextActionFallback ? ["desde perfil"] : isExpired ? ["caducada"] : isExpiring ? ["caduca hoy"] : isStale ? ["sin novedades"] : []),
              ]}
              onAccept={(!hasLivePending && !useNextActionFallback) ? undefined : () => navigate(`/tasks?contact=${contact.id}&suggest=1`)}
              acceptLabel={(!hasLivePending && !useNextActionFallback) ? undefined : "Aceptar y agendar"}
              onEvidence={() => {
                const el = document.getElementById("contact-tabs");
                el?.scrollIntoView({ behavior: "smooth" });
              }}
              evidenceLabel={`Ver evidencia (${totalMessages.toLocaleString("es")} mensajes)`}
            />
          );
        })()}

        {/* KPI STRIP — datos crudos tipo fichero */}
        <ContactKpiStrip
          items={[
            {
              label: "Salud relación",
              value: hasHealth ? healthScore : "—",
              hint: hasHealth ? `score · /10` : "sin calcular",
              tone: hasHealth
                ? (healthScore >= 7 ? "success" : healthScore >= 4 ? "warning" : "destructive")
                : "default",
            },
            {
              label: "Último contacto",
              value: contact.last_contact
                ? formatDistanceToNowStrict(new Date(contact.last_contact), { locale: es })
                : "—",
              hint: contact.last_contact
                ? new Date(contact.last_contact).toLocaleDateString("es", { day: "2-digit", month: "short", year: "numeric" })
                : "sin registro",
              tone: "primary",
            },
            {
              label: "Mensajes totales",
              value: totalMessages >= 1000
                ? `${(totalMessages / 1000).toFixed(1)}k`
                : totalMessages.toString(),
              hint: "whatsapp",
              tone: "accent",
            },
            {
              label: "Tier",
              value: hasHealth
                ? (healthScore >= 9 ? "S" : healthScore >= 7 ? "A" : healthScore >= 4 ? "B" : "C")
                : "—",
              hint: hasHealth
                ? (healthScore >= 9 ? "inner circle" : healthScore >= 7 ? "core" : "periphery")
                : "sin calcular",
              tone: "success",
            },
          ]}
        />

        {nextAction?.que && (
          <GlassCard className="p-5 sm:p-6 border border-primary/20 bg-primary/5">
            <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-3 font-mono">
              <ArrowRight className="w-3 h-3" />
              <span>Próxima acción recomendada</span>
            </div>
            <div className="space-y-3">
              <p className="text-base sm:text-lg font-medium text-foreground">{nextAction.que}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                {nextAction.canal && (
                  <span className="px-2.5 py-1 rounded-full bg-card/60 border border-border text-muted-foreground">
                    Canal: {nextAction.canal}
                  </span>
                )}
                {nextAction.cuando && (
                  <span className="px-2.5 py-1 rounded-full bg-card/60 border border-border text-muted-foreground">
                    Cuándo: {nextAction.cuando}
                  </span>
                )}
              </div>
              {nextAction.pretexto && (
                <p className="text-sm text-muted-foreground">💡 Pretexto: {nextAction.pretexto}</p>
              )}
            </div>
          </GlassCard>
        )}

        {/* TAREAS VINCULADAS */}
        {linkedTasks.length > 0 && (() => {
          const pending = linkedTasks.filter((t) => !t.completed);
          const done = linkedTasks.filter((t) => t.completed);
          return (
            <GlassCard className="p-5 sm:p-6">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 font-mono">
                <Bell className="w-3 h-3" />
                <span>Tareas asociadas · {linkedTasks.length}</span>
              </div>
              <div className="space-y-2">
                {pending.map((t) => (
                  <div
                    key={t.id}
                    className="flex items-center justify-between gap-3 p-2.5 rounded-lg border border-border bg-card/40"
                  >
                    <span className="text-sm text-foreground truncate">{t.title}</span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                      {t.priority}
                    </span>
                  </div>
                ))}
                {done.length > 0 && (
                  <details className="pt-2">
                    <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                      Completadas ({done.length})
                    </summary>
                    <div className="space-y-1.5 mt-2">
                      {done.slice(0, 10).map((t) => (
                        <div key={t.id} className="px-2.5 py-1.5 opacity-60">
                          <span className="text-xs line-through text-muted-foreground truncate">
                            {t.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                className="mt-3 rounded-full"
                onClick={() => navigate(`/tasks?contact=${contact.id}`)}
              >
                Nueva tarea para {contact.name.split(/\s+/)[0]}
              </Button>
            </GlassCard>
          );
        })()}

        {/* HEADLINES — análisis IA secundario */}
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 px-1 font-mono">
            <Activity className="w-3 h-3" />
            <span>Análisis profundo</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {hLoading || !headlines ? (
              <>
                {[0, 1, 2].map((i) => (
                  <GlassCard key={i} className="p-6 h-[180px] animate-pulse">
                    <div className="h-3 w-24 bg-white/10 rounded mb-3" />
                    <div className="h-7 w-32 bg-white/10 rounded mb-2" />
                    <div className="h-3 w-full bg-white/5 rounded mb-1" />
                    <div className="h-3 w-3/4 bg-white/5 rounded" />
                  </GlassCard>
                ))}
              </>
            ) : (() => {
              const pendingFreshness = headlines.pending.freshness_status ?? "active";
              const pendingInactive = pendingFreshness === "expired" || pendingFreshness === "stale";
              return (
              <>
                <HeadlineCard
                  label="Relación y salud"
                  icon={<Activity className="w-4 h-4" />}
                  accent="success"
                  value={
                    <span>
                      <span className="font-mono">{headlines.health.score}/10</span>{" "}
                      · {headlines.health.label}
                    </span>
                  }
                  line2={headlines.health.relationship_type}
                  line3={headlines.health.trend}
                />
                <HeadlineCard
                  label="Asunto pendiente"
                  icon={<AlertCircle className="w-4 h-4" />}
                  accent={headlines.pending.freshness_status === "expiring" ? "warning" : "primary"}
                  value={
                    <span>
                      {headlines.pending.freshness_status === "expired" && (
                        <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] uppercase tracking-wider align-middle">
                          caducada
                        </span>
                      )}
                      {headlines.pending.freshness_status === "stale" && (
                        <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-muted text-muted-foreground text-[10px] uppercase tracking-wider align-middle">
                          historial
                        </span>
                      )}
                      {headlines.pending.freshness_status === "expiring" && (
                        <span className="inline-block mr-2 px-1.5 py-0.5 rounded bg-warning/20 text-warning text-[10px] uppercase tracking-wider align-middle">
                          caduca hoy
                        </span>
                      )}
                      {pendingInactive ? "Sin asunto vivo" : headlines.pending.title}
                    </span>
                  }
                  line2={pendingInactive ? "Movido a historial" : `Mover ficha: ${headlines.pending.who_owes}`}
                  line3={`Última mención: ${headlines.pending.last_mentioned}`}
                />
                <HeadlineCard
                  label="Temas y tono"
                  icon={<MessageSquare className="w-4 h-4" />}
                  value={
                    <span>
                      <span className="mr-2 text-2xl">{headlines.topics.tone_emoji}</span>
                      {headlines.topics.tone_label}
                    </span>
                  }
                  line2={
                    headlines.topics.top_topics
                      .map((t) => `${t.name} ${t.percentage}%`)
                      .join(" · ") || "—"
                  }
                  line3={headlines.topics.tone_evolution}
                />
              </>
              );
            })()}
          </div>
        </div>

        {/* PODCAST — destacado */}
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-3 px-1 font-mono">
            <Mic className="w-3 h-3" />
            <span>Podcast de la relación</span>
          </div>
          <PodcastPlayer
            podcast={podcast}
            segment={segment}
            busy={busy}
            totalMessages={totalMessages}
            contactName={contact.name}
            onRegenerate={(opts) => regenerate(opts)}
            onSetFormat={setFormat}
          />
        </div>


        {/* DETAIL TABS — toda la información detallada */}
        <Tabs defaultValue="resumen" className="w-full" id="contact-tabs">
          <TabsList className="grid grid-cols-5 w-full bg-card/40 backdrop-blur-md border border-border h-auto p-1">
            <TabsTrigger value="resumen" className="text-xs sm:text-sm py-2">
              <Sparkles className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Resumen
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-xs sm:text-sm py-2">
              <MessageCircle className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> WhatsApp
            </TabsTrigger>
            <TabsTrigger value="email" className="text-xs sm:text-sm py-2">
              <Mail className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Email
            </TabsTrigger>
            <TabsTrigger value="plaud" className="text-xs sm:text-sm py-2">
              <Mic className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Plaud
            </TabsTrigger>
            <TabsTrigger value="datos" className="text-xs sm:text-sm py-2">
              <Brain className="w-3.5 h-3.5 mr-1.5 hidden sm:inline" /> Perfil
            </TabsTrigger>
          </TabsList>

          <TabsContent value="resumen" className="mt-6 space-y-6">
            <RelationshipTimelineChart contactId={contact.id} contactName={contact.name} />
            <ConversationTimeline messages={messages} contactName={contact.name} />

            {quotables.length > 0 && (
              <GlassCard className="p-6">
                <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
                  Momentos destacables
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {quotables.map((q) => (
                    <div key={q.id} className="border-l-2 border-primary/40 pl-4 py-1">
                      <p className="text-sm font-serif italic leading-relaxed">"{q.content.slice(0, 240)}{q.content.length > 240 ? "…" : ""}"</p>
                      <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                        {formatDistanceToNow(new Date(q.message_date), { addSuffix: true, locale: es })}
                      </p>
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            <GlassCard className="p-6">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Tus notas
              </h3>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Cosas que recordar de esta persona…"
                className="min-h-[120px] bg-white/[0.02] border-white/[0.06]"
              />
              <div className="flex justify-end mt-3">
                <Button size="sm" onClick={saveNotes} disabled={savingNotes}>
                  {savingNotes ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Guardar notas
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="p-6">
              <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-3">
                Red de contactos compartidos
              </h3>
              <div className="flex items-center justify-center py-8 text-muted-foreground/60">
                <Network className="w-8 h-8 mr-3 opacity-50" />
                <span className="text-sm">Próximamente</span>
              </div>
            </GlassCard>
          </TabsContent>

          <TabsContent value="whatsapp" className="mt-6 space-y-6">
            <WhatsAppTab contact={contact as any} />
          </TabsContent>

          <TabsContent value="email" className="mt-6">
            <EmailTab contact={contact as any} />
          </TabsContent>

          <TabsContent value="plaud" className="mt-6">
            <PlaudTab
              contact={contact as any}
              contactRecordings={plaudRecordings as any}
              contactThreads={plaudThreads as any}
            />
          </TabsContent>

          <TabsContent value="datos" className="mt-6 space-y-4">
            {/* Selector de ámbito */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70 mr-1">Ámbito</span>
              {(["profesional", "personal", "familiar"] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setActiveScope(s)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    activeScope === s
                      ? "bg-primary/15 border-primary/50 text-primary shadow-[0_0_16px_-4px_hsl(var(--primary)/0.5)]"
                      : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-primary bg-card/30"
                  }`}
                >
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {profile && Object.keys(profile).length > 0 ? (
              <ProfileByScope
                profile={profile}
                ambito={activeScope}
                contactId={contact.id}
                allContacts={allContacts}
                contactLinks={contactLinks}
                onLinkContact={linkContact}
                onIgnoreContact={ignoreContact}
              />
            ) : (
              <GlassCard className="p-6 text-center space-y-3">
                <Brain className="w-10 h-10 text-muted-foreground mx-auto" />
                <p className="text-sm text-muted-foreground">Sin análisis de perfil todavía</p>
                <Button size="sm" onClick={refreshProfile} disabled={refreshingProfile}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshingProfile ? "animate-spin" : ""}`} />
                  Generar perfil ahora
                </Button>
              </GlassCard>
            )}

            <ProfileKnownData contact={contact as any} />
          </TabsContent>
        </Tabs>

        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground px-1 font-mono">
            <MessageCircle className="w-3 h-3" />
            <span>Borradores sugeridos</span>
          </div>
          <SuggestedResponses contactId={contact.id} contactName={contact.name} />
        </div>
      </div>
    </div>
  );
}
