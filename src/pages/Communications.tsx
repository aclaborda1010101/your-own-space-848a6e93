import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Mail, MessageCircle, RefreshCw, Loader2, Inbox,
  Mic, Briefcase, Heart, Users, X, Upload,
  ChevronDown, ChevronUp, Plus
} from "lucide-react";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface EmailCache {
  id: string;
  account: string;
  from_addr: string;
  subject: string;
  preview?: string;
  synced_at: string;
  is_read: boolean;
}

interface WhatsAppCache {
  id: string;
  chat_name: string;
  last_message: string;
  last_time: string;
  is_read: boolean;
}

interface PlaudRecording {
  id: string;
  title: string | null;
  full_text: string | null;
  summary: string | null;
  agent_type: string | null;
  received_at: string | null;
  audio_url?: string | null;
}

interface PlaudThread {
  id: string;
  event_title: string | null;
  event_date: string | null;
  recording_ids: string[] | null;
  unified_transcript: string | null;
  speakers: unknown;
  agent_type: string | null;
}

type BrainFilter = 'all' | 'profesional' | 'personal' | 'familiar';

// ── Helpers ────────────────────────────────────────────────────────────────────

const getBrainColor = (brain: string | null) => {
  switch (brain) {
    case 'profesional': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'personal':    return 'bg-pink-500/10 text-pink-400 border-pink-500/30';
    case 'familiar':    return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
    default:            return 'bg-muted/10 text-muted-foreground border-muted/30';
  }
};

const getBrainIcon = (brain: string | null) => {
  switch (brain) {
    case 'profesional': return <Briefcase className="w-3.5 h-3.5" />;
    case 'familiar':    return <Users className="w-3.5 h-3.5" />;
    default:            return <Heart className="w-3.5 h-3.5" />;
  }
};

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return '—';
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es }); }
  catch { return dateStr; }
};

const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '—';
  try { return format(new Date(dateStr), "d MMM yyyy", { locale: es }); }
  catch { return dateStr; }
};

const getSpeakerNames = (speakers: unknown): string[] => {
  if (!Array.isArray(speakers)) return [];
  return speakers
    .map((s: unknown) => {
      if (typeof s === 'object' && s !== null) {
        const sp = s as Record<string, unknown>;
        return (sp.nombre_detectado || sp.id_original || null) as string | null;
      }
      return null;
    })
    .filter((n): n is string => !!n);
};

// ── Upload Modal ───────────────────────────────────────────────────────────────

interface UploadModalProps {
  onClose: () => void;
}

const UploadModal = ({ onClose }: UploadModalProps) => {
  const [file, setFile] = useState<File | null>(null);
  const [brain, setBrain] = useState<'profesional' | 'personal' | 'familiar'>('profesional');
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleTranscribe = async () => {
    if (!file) { toast.error('Selecciona un archivo de audio'); return; }
    setUploading(true);
    try {
      // Edge Function: transcribe-audio (placeholder — UI only for now)
      await supabase.functions.invoke('transcribe-audio', {
        body: { brain, filename: file.name },
      });
      toast.success('Audio enviado a transcripción');
      onClose();
    } catch {
      toast.error('Error al transcribir (Edge Function pendiente de implementar)');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-border">
          <h2 className="font-semibold text-foreground">Subir Audio Manual</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="w-4 h-4" /></Button>
        </div>

        <div className="p-5 space-y-4">
          {/* File input */}
          <div>
            <label className="text-xs font-medium text-muted-foreground font-mono mb-2 block">ARCHIVO DE AUDIO</label>
            <input
              ref={fileRef}
              type="file"
              accept=".mp3,.m4a,.wav,.ogg,.webm"
              className="hidden"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
            />
            <div
              className={cn(
                "border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors",
                file ? "border-primary bg-primary/5" : "border-muted-foreground/30 hover:border-primary/50"
              )}
              onClick={() => fileRef.current?.click()}
            >
              {file ? (
                <div className="space-y-1">
                  <Mic className="w-6 h-6 text-primary mx-auto" />
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</p>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="w-6 h-6 text-muted-foreground mx-auto" />
                  <p className="text-sm text-muted-foreground">Haz clic para seleccionar</p>
                  <p className="text-xs text-muted-foreground">mp3 · m4a · wav</p>
                </div>
              )}
            </div>
          </div>

          {/* Brain selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground font-mono mb-2 block">CEREBRO</label>
            <div className="flex gap-2">
              {(['profesional', 'personal', 'familiar'] as const).map(b => (
                <Button
                  key={b}
                  variant={brain === b ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrain(b)}
                  className="flex-1 text-xs"
                >
                  {b === 'profesional' ? '💼' : b === 'personal' ? '❤️' : '👨‍👩‍👧'} {b}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div className="p-5 pt-0">
          <Button
            className="w-full"
            onClick={handleTranscribe}
            disabled={uploading || !file}
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Mic className="w-4 h-4 mr-2" />}
            Transcribir
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Plaud Recording Card ───────────────────────────────────────────────────────

interface RecordingCardProps {
  recording: PlaudRecording;
  thread?: PlaudThread;
}

const RecordingCard = ({ recording, thread }: RecordingCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const speakers = getSpeakerNames(thread?.speakers);

  return (
    <Card className="border-border bg-card transition-all hover:border-primary/30">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 border", getBrainColor(recording.agent_type))}>
            {getBrainIcon(recording.agent_type)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground line-clamp-1">
              {recording.title || 'Sin título'}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{formatDate(recording.received_at)}</p>
          </div>
          <Badge variant="outline" className={cn("text-xs flex-shrink-0 flex items-center gap-1", getBrainColor(recording.agent_type))}>
            {getBrainIcon(recording.agent_type)}
            {recording.agent_type || 'sin cerebro'}
          </Badge>
        </div>

        {/* Speakers */}
        {speakers.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {speakers.map((name, i) => (
              <span key={i} className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                👤 {name}
              </span>
            ))}
          </div>
        )}

        {/* Summary (2 lines) */}
        {recording.summary && (
          <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
            {recording.summary}
          </p>
        )}

        {/* Expand button */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full h-7 text-xs gap-1 text-muted-foreground hover:text-foreground"
          onClick={() => setExpanded(v => !v)}
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? 'Ocultar' : 'Ver completo'}
        </Button>

        {/* Expanded content */}
        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border">
            {recording.full_text && (
              <div className="max-h-64 overflow-y-auto rounded-lg bg-muted/10 border border-border p-3">
                <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                  {recording.full_text}
                </p>
              </div>
            )}
            {recording.audio_url && (
              <audio controls className="w-full h-8">
                <source src={recording.audio_url} type="audio/mpeg" />
              </audio>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

const Communications = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("plaud");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<EmailCache[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppCache[]>([]);
  const [plaudRecordings, setPlaudRecordings] = useState<PlaudRecording[]>([]);
  const [plaudThreads, setPlaudThreads] = useState<PlaudThread[]>([]);
  const [brainFilter, setBrainFilter] = useState<BrainFilter>('all');
  const [showUpload, setShowUpload] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [emailsRes, whatsappRes, plaudRes, threadsRes] = await Promise.all([
        supabase.from('jarvis_emails_cache').select('*').order('synced_at', { ascending: false }),
        supabase.from('jarvis_whatsapp_cache').select('*').order('last_time', { ascending: false }),
        supabase.from('plaud_recordings').select('*').order('received_at', { ascending: false }).limit(50),
        supabase.from('plaud_threads').select('id,event_title,event_date,recording_ids,speakers,agent_type,unified_transcript').order('event_date', { ascending: false }).limit(50),
      ]);

      if (emailsRes.data) setEmails(emailsRes.data);
      if (whatsappRes.data) setWhatsappChats(whatsappRes.data);
      if (plaudRes.data) setPlaudRecordings(plaudRes.data);
      if (threadsRes.data) setPlaudThreads(threadsRes.data);
    } catch (error) {
      console.error('Error fetching communications:', error);
      toast.error('Error al cargar comunicaciones');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  // Build a map: recording_id → thread (to get speakers)
  const recordingThreadMap = new Map<string, PlaudThread>();
  plaudThreads.forEach(thread => {
    (thread.recording_ids || []).forEach(rid => {
      if (!recordingThreadMap.has(rid)) recordingThreadMap.set(rid, thread);
    });
  });

  const filteredRecordings = plaudRecordings.filter(r =>
    brainFilter === 'all' || r.agent_type === brainFilter
  );

  const unreadEmails = emails.filter(e => !e.is_read).length;
  const unreadWhatsapp = whatsappChats.filter(c => !c.is_read).length;

  const emailsByAccount = emails.reduce((acc, email) => {
    if (!acc[email.account]) acc[email.account] = [];
    acc[email.account].push(email);
    return acc;
  }, {} as Record<string, EmailCache[]>);

  return (
    <div className="min-h-screen bg-background">
      {showUpload && <UploadModal onClose={() => setShowUpload(false)} />}

      <SidebarNew
        isOpen={sidebarOpen}
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <div className={cn("transition-all duration-300", sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")}>
        <TopBar onMenuClick={openSidebar} />

        <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Mail className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Comunicaciones</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {plaudRecordings.length} GRABACIONES · {unreadEmails + unreadWhatsapp} SIN LEER
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
              <TabsTrigger value="plaud" className="gap-2">
                <Mic className="w-4 h-4" />
                Plaud
                {plaudRecordings.length > 0 && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5">{plaudRecordings.length}</Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="email" className="gap-2">
                <Mail className="w-4 h-4" />
                Email
                {unreadEmails > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{unreadEmails}</Badge>}
              </TabsTrigger>
              <TabsTrigger value="whatsapp" className="gap-2">
                <MessageCircle className="w-4 h-4" />
                WhatsApp
                {unreadWhatsapp > 0 && <Badge variant="destructive" className="ml-1 h-5 px-1.5">{unreadWhatsapp}</Badge>}
              </TabsTrigger>
            </TabsList>

            {/* ── PLAUD TAB ─────────────────────────────────────────────────── */}
            <TabsContent value="plaud" className="mt-4 space-y-4">
              {/* Plaud Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-foreground">Grabaciones Plaud</h2>
                <Button onClick={() => setShowUpload(true)} className="gap-2 self-start sm:self-auto">
                  <Plus className="w-4 h-4" />
                  Subir Audio Manual
                </Button>
              </div>

              {/* Brain filters */}
              <div className="flex flex-wrap gap-2">
                {(['all', 'profesional', 'personal', 'familiar'] as const).map(f => (
                  <Button
                    key={f}
                    variant={brainFilter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBrainFilter(f)}
                    className="h-8 text-xs"
                  >
                    {f === 'all' ? 'Todos' : f === 'profesional' ? '💼 Profesional' : f === 'personal' ? '❤️ Personal' : '👨‍👩‍👧 Familiar'}
                  </Button>
                ))}
              </div>

              {/* Recording list */}
              {loading && filteredRecordings.length === 0 ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : filteredRecordings.length > 0 ? (
                <div className="space-y-3">
                  {filteredRecordings.map(rec => (
                    <RecordingCard
                      key={rec.id}
                      recording={rec}
                      thread={recordingThreadMap.get(rec.id)}
                    />
                  ))}
                </div>
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                  <CardContent className="p-10 text-center space-y-3">
                    <Mic className="w-10 h-10 text-muted-foreground mx-auto" />
                    <div>
                      <p className="text-sm font-medium text-foreground">No hay grabaciones</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {brainFilter !== 'all'
                          ? `No hay grabaciones de tipo "${brainFilter}"`
                          : 'Sube un audio para empezar o conecta tu Plaud via email'}
                      </p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => setShowUpload(true)} className="gap-2">
                      <Plus className="w-3.5 h-3.5" />
                      Subir Audio Manual
                    </Button>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── EMAIL TAB ─────────────────────────────────────────────────── */}
            <TabsContent value="email" className="mt-4 space-y-6">
              {loading && emails.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : Object.keys(emailsByAccount).length > 0 ? (
                Object.entries(emailsByAccount).map(([account, accountEmails]) => (
                  <div key={account} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Mail className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{account}</h3>
                      <Badge variant="outline" className="text-xs">{accountEmails.length}</Badge>
                    </div>
                    {accountEmails.map(email => (
                      <Card key={email.id} className={cn("border-border bg-card", !email.is_read && "bg-primary/5 border-primary/20")}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium truncate", !email.is_read && "font-semibold")}>{email.from_addr}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(email.synced_at)}</span>
                              </div>
                              <p className={cn("text-sm truncate mt-0.5", !email.is_read ? "text-foreground" : "text-muted-foreground")}>{email.subject}</p>
                              {email.preview && <p className="text-xs text-muted-foreground truncate mt-0.5">{email.preview}</p>}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ))
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                  <CardContent className="p-8 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay emails sincronizados</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ── WHATSAPP TAB ──────────────────────────────────────────────── */}
            <TabsContent value="whatsapp" className="mt-4 space-y-3">
              {loading && whatsappChats.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : whatsappChats.length > 0 ? (
                whatsappChats.map(chat => (
                  <Card key={chat.id} className={cn("border-border bg-card", !chat.is_read && "bg-success/5 border-success/20")}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-success/10 flex items-center justify-center">
                          <MessageCircle className="w-5 h-5 text-success" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={cn("text-sm font-medium", !chat.is_read && "font-semibold")}>{chat.chat_name}</span>
                            <span className="text-xs text-muted-foreground">{formatTime(chat.last_time)}</span>
                          </div>
                          <p className={cn("text-sm truncate mt-0.5", !chat.is_read ? "text-foreground" : "text-muted-foreground")}>{chat.last_message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                  <CardContent className="p-8 text-center">
                    <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay chats de WhatsApp</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Communications;
