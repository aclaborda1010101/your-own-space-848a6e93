import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Mail, MessageCircle, RefreshCw, Loader2, Inbox,
  Mic, Briefcase, Heart, Users, X, Upload,
  ChevronDown, ChevronUp, Plus, FileText, Volume2, CheckCircle2, AlertCircle
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

type FileKind = 'audio' | 'txt';

interface QueuedFile {
  file: File;
  kind: FileKind;
  status: 'pending' | 'processing' | 'done' | 'error';
  error?: string;
}

const AUDIO_EXTS = ['.mp3', '.m4a', '.wav', '.ogg', '.webm'];
const TXT_EXTS   = ['.txt'];

const detectKind = (file: File): FileKind | null => {
  const lower = file.name.toLowerCase();
  if (AUDIO_EXTS.some(ext => lower.endsWith(ext))) return 'audio';
  if (TXT_EXTS.some(ext => lower.endsWith(ext)))   return 'txt';
  return null;
};

const fileTitle = (name: string) =>
  name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ').trim();

const readTextFile = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = e => resolve((e.target?.result as string) ?? '');
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
    reader.readAsText(file, 'UTF-8');
  });

interface UploadModalProps {
  onClose: () => void;
  onDone: () => void;          // refresca la lista tras importar
  userId: string;
}

const UploadModal = ({ onClose, onDone, userId }: UploadModalProps) => {
  const [queue, setQueue]   = useState<QueuedFile[]>([]);
  const [brain, setBrain]   = useState<'profesional' | 'personal' | 'familiar'>('profesional');
  const [running, setRunning] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setStatus = (idx: number, status: QueuedFile['status'], error?: string) =>
    setQueue(q => q.map((item, i) => i === idx ? { ...item, status, error } : item));

  const handleFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    const valid: QueuedFile[] = [];
    for (const f of files) {
      const kind = detectKind(f);
      if (kind) valid.push({ file: f, kind, status: 'pending' });
      else toast.warning(`Tipo no soportado: ${f.name}`);
    }
    setQueue(prev => [...prev, ...valid]);
    // reset input so same file can be re-added if needed
    if (fileRef.current) fileRef.current.value = '';
  };

  const removeFile = (idx: number) =>
    setQueue(q => q.filter((_, i) => i !== idx));

  const handleUpload = async () => {
    if (queue.length === 0) { toast.error('No hay archivos en la cola'); return; }
    setRunning(true);

    let doneCount = 0;
    for (let idx = 0; idx < queue.length; idx++) {
      const item = queue[idx];
      if (item.status === 'done') continue;
      setStatus(idx, 'processing');

      try {
        if (item.kind === 'txt') {
          // ── TXT: leer contenido e insertar directo ─────────────────────────
          const fullText = await readTextFile(item.file);
          const { error } = await supabase.from('plaud_recordings').insert({
            user_id:    userId,
            title:      fileTitle(item.file.name),
            full_text:  fullText,
            agent_type: brain,
            processed:  true,
            received_at: new Date().toISOString(),
          });
          if (error) throw new Error(error.message);

        } else {
          // ── AUDIO: subir a storage y crear registro pendiente ──────────────
          const ext       = item.file.name.split('.').pop() ?? 'mp3';
          const storagePath = `plaud/${userId}/${Date.now()}_${item.file.name}`;
          const { error: uploadErr } = await supabase.storage
            .from('plaud-audio')
            .upload(storagePath, item.file, { contentType: item.file.type || 'audio/mpeg' });

          // Si no existe el bucket o falla, continuamos sin audio_url
          const { data: urlData } = uploadErr
            ? { data: null }
            : supabase.storage.from('plaud-audio').getPublicUrl(storagePath);

          const { error: insertErr } = await supabase.from('plaud_recordings').insert({
            user_id:    userId,
            title:      fileTitle(item.file.name),
            agent_type: brain,
            processed:  false,
            audio_url:  urlData?.publicUrl ?? null,
            received_at: new Date().toISOString(),
          });
          if (insertErr) throw new Error(insertErr.message);
        }

        setStatus(idx, 'done');
        doneCount++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido';
        setStatus(idx, 'error', msg);
      }
    }

    setRunning(false);
    if (doneCount > 0) {
      toast.success(`${doneCount} archivo${doneCount > 1 ? 's' : ''} importado${doneCount > 1 ? 's' : ''} correctamente`);
      onDone();
    }
    // Si todos terminaron (done o error) cerramos solo si no quedan errores sin resolver
    const allFinished = queue.every((_item, i) => {
      const updated = queue[i]; // referencia vieja, pero para UX vale
      return updated.status === 'done' || updated.status === 'error';
    });
    if (doneCount === queue.filter(item => item.status !== 'error').length) onClose();
  };

  const audioCount = queue.filter(q => q.kind === 'audio').length;
  const txtCount   = queue.filter(q => q.kind === 'txt').length;
  const canSubmit  = queue.length > 0 && queue.some(q => q.status === 'pending') && !running;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-card border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border flex-shrink-0">
          <div>
            <h2 className="font-semibold text-foreground">Subir archivos</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Audio para transcribir · TXT para importar directo</p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose} disabled={running}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {/* Drop zone */}
          <div>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept=".mp3,.m4a,.wav,.ogg,.webm,.txt"
              className="hidden"
              onChange={handleFiles}
            />
            <div
              className="border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-colors border-muted-foreground/30 hover:border-primary/50 hover:bg-primary/5"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-foreground font-medium">Haz clic para seleccionar archivos</p>
              <p className="text-xs text-muted-foreground mt-1">
                <span className="inline-flex items-center gap-1 mr-3"><Volume2 className="w-3 h-3" /> mp3 · m4a · wav → transcribir</span>
                <span className="inline-flex items-center gap-1"><FileText className="w-3 h-3" /> txt → importar directo</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1 opacity-60">Selección múltiple permitida</p>
            </div>
          </div>

          {/* File queue */}
          {queue.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground font-mono">
                  COLA ({queue.length} archivo{queue.length !== 1 ? 's' : ''})
                  {audioCount > 0 && <span className="ml-2 text-primary">{audioCount} audio</span>}
                  {txtCount   > 0 && <span className="ml-2 text-green-400">{txtCount} txt</span>}
                </p>
                <Button
                  variant="ghost" size="sm"
                  className="text-xs h-6 text-muted-foreground"
                  onClick={() => setQueue(q => q.filter(i => i.status !== 'pending'))}
                  disabled={running}
                >
                  Limpiar pendientes
                </Button>
              </div>

              {queue.map((item, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl border text-sm transition-colors",
                    item.status === 'done'       && "bg-green-500/5 border-green-500/20",
                    item.status === 'error'      && "bg-red-500/5 border-red-500/20",
                    item.status === 'processing' && "bg-primary/5 border-primary/30 animate-pulse",
                    item.status === 'pending'    && "bg-card border-border",
                  )}
                >
                  {/* Kind icon */}
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0",
                    item.kind === 'txt' ? "bg-green-500/10 text-green-400" : "bg-primary/10 text-primary"
                  )}>
                    {item.kind === 'txt' ? <FileText className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </div>

                  {/* Name + meta */}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(item.file.size / 1024).toFixed(0)} KB ·{' '}
                      {item.kind === 'txt'
                        ? <span className="text-green-400">importación directa</span>
                        : <span className="text-primary">cola de transcripción</span>
                      }
                    </p>
                    {item.error && (
                      <p className="text-xs text-red-400 mt-0.5 truncate">{item.error}</p>
                    )}
                  </div>

                  {/* Status icon / remove */}
                  <div className="flex-shrink-0">
                    {item.status === 'done' && <CheckCircle2 className="w-4 h-4 text-green-400" />}
                    {item.status === 'error' && <AlertCircle className="w-4 h-4 text-red-400" />}
                    {item.status === 'processing' && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
                    {item.status === 'pending' && (
                      <Button variant="ghost" size="icon" className="w-6 h-6" onClick={() => removeFile(idx)} disabled={running}>
                        <X className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Brain selector */}
          <div>
            <label className="text-xs font-medium text-muted-foreground font-mono mb-2 block">CEREBRO (para todos los archivos)</label>
            <div className="flex gap-2">
              {(['profesional', 'personal', 'familiar'] as const).map(b => (
                <Button
                  key={b}
                  variant={brain === b ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setBrain(b)}
                  className="flex-1 text-xs"
                  disabled={running}
                >
                  {b === 'profesional' ? <Briefcase className="w-3 h-3 mr-1 inline" /> : b === 'personal' ? <Heart className="w-3 h-3 mr-1 inline" /> : <Users className="w-3 h-3 mr-1 inline" />}{b}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 pt-0 border-t border-border flex-shrink-0 space-y-2">
          {txtCount > 0 && (
            <p className="text-xs text-muted-foreground bg-green-500/5 border border-green-500/20 rounded-lg px-3 py-2">
              Los archivos TXT se guardan directamente como transcripcion completa (sin pasar por IA)
            </p>
          )}
          {audioCount > 0 && (
            <p className="text-xs text-muted-foreground bg-primary/5 border border-primary/20 rounded-lg px-3 py-2">
              Los audios quedan marcados como pendientes — la Edge Function <code className="font-mono">transcribe-audio</code> los procesara
            </p>
          )}
          <Button
            className="w-full"
            onClick={handleUpload}
            disabled={!canSubmit}
          >
            {running
              ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Procesando...</>
              : <><Upload className="w-4 h-4 mr-2" />Importar {queue.filter(q => q.status === 'pending').length} archivo{queue.filter(q => q.status === 'pending').length !== 1 ? 's' : ''}</>
            }
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
    <>
      {showUpload && (
        <UploadModal
          onClose={() => setShowUpload(false)}
          onDone={fetchData}
          userId={user?.id ?? ''}
        />
      )}

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
    </>
  );
};

export default Communications;
