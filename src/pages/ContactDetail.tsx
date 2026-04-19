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
import {
  WhatsAppTab,
  EmailTab,
  PlaudTab,
  ProfileKnownData,
} from "@/components/contacts/ContactTabs";
import SuggestedResponses from "@/components/contacts/SuggestedResponses";
import { useContactHeadlines } from "@/hooks/useContactHeadlines";
import { useContactPodcast } from "@/hooks/useContactPodcast";
import {
  ArrowLeft,
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

  const { payload: headlines, loading: hLoading } = useContactHeadlines(contactId || null);
  const { podcast, segment, busy, regenerate, setFormat } = useContactPodcast(contactId || null);

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
        .select("id,name,category,categories,wa_id,phone_numbers,last_contact,context,role,company,brain,relationship,email,personality_profile,metadata,ai_tags,scores,sentiment")
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

  const healthScore = contact.scores?.health ?? 5;
  const sentimentColor =
    contact.sentiment === "positive" ? "success" :
    contact.sentiment === "negative" ? "destructive" :
    "muted";

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

        {/* HEADER */}
        <GlassCard className="p-6 sm:p-8 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.04] via-transparent to-accent/[0.03] pointer-events-none" />
          <div className="relative flex flex-col lg:flex-row lg:items-center gap-6">
            {/* Avatar + Health */}
            <div className="flex items-center gap-5 shrink-0">
              <div className="relative">
                <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-gradient-to-br from-primary/40 via-primary/15 to-accent/10 border border-primary/30 flex items-center justify-center text-3xl sm:text-4xl font-display font-semibold shadow-[0_0_40px_-10px_hsl(var(--primary)/0.5)]">
                  {initials}
                </div>
                <div className="absolute -bottom-1 -right-1 bg-card border-2 border-background rounded-full p-1">
                  <HealthMeter score={healthScore} size="sm" showLabel={false} />
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-2">
                <Sparkles className="w-3 h-3" />
                <span>Ficha relacional</span>
              </div>
              <h1 className="font-serif text-3xl sm:text-4xl lg:text-5xl font-medium tracking-tight leading-[1.05]">
                {contact.name}
              </h1>
              {(contact.role || contact.company) && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  {[contact.role, contact.company].filter(Boolean).join(" · ")}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {contact.category && (
                  <span className="px-2.5 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[11px] font-medium">
                    {contact.category}
                  </span>
                )}
                {contact.sentiment && (
                  <span className={`px-2.5 py-1 rounded-full bg-${sentimentColor}/10 border border-${sentimentColor}/30 text-${sentimentColor} text-[11px] font-medium capitalize`}>
                    {contact.sentiment}
                  </span>
                )}
                {contact.ai_tags?.slice(0, 3).map((t) => (
                  <span key={t} className="px-2.5 py-1 rounded-full bg-card/50 border border-border text-muted-foreground text-[11px]">
                    {t}
                  </span>
                ))}
                {contact.last_contact && (
                  <span className="text-xs text-muted-foreground font-mono">
                    · último contacto{" "}
                    {formatDistanceToNow(new Date(contact.last_contact), {
                      addSuffix: true,
                      locale: es,
                    })}
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
            </div>
          </div>
        </GlassCard>

        {/* HEADLINES */}
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-muted-foreground mb-3 px-1">
            <Activity className="w-3 h-3" />
            <span>Titulares de IA</span>
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
            ) : (
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
                  accent="warning"
                  value={headlines.pending.title}
                  line2={`Mover ficha: ${headlines.pending.who_owes}`}
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
            )}
          </div>
        </div>

        {/* PODCAST — destacado */}
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 mb-3 px-1">
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
        <Tabs defaultValue="resumen" className="w-full">
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
            <SuggestedResponses contactId={contact.id} contactName={contact.name} />
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

          <TabsContent value="datos" className="mt-6">
            <ProfileKnownData contact={contact as any} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
