import { useState, useEffect } from "react";
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
  Mail, MessageCircle, RefreshCw, Loader2, Inbox, User,
  Mic, Briefcase, Heart, Users, ChevronRight, X,
  MessageSquare, Clock
} from "lucide-react";
import { toast } from "sonner";

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
  title: string;
  full_text: string;
  summary: string;
  agent_type: 'profesional' | 'personal' | 'familiar' | null;
  relevance_category: 'high' | 'medium' | 'low' | null;
  relevance_score: number;
  received_at: string;
  audio_url?: string;
}

interface PlaudThread {
  id: string;
  event_title: string;
  event_date: string;
  recording_ids: string[];
  unified_transcript: string;
  speakers: any[];
  context_type: string;
  context_segments: any[];
  contacts_extracted: any[];
  agent_type: string;
  created_at: string;
}

const Communications = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState("email");
  const [loading, setLoading] = useState(false);
  const [emails, setEmails] = useState<EmailCache[]>([]);
  const [whatsappChats, setWhatsappChats] = useState<WhatsAppCache[]>([]);
  const [plaudRecordings, setPlaudRecordings] = useState<PlaudRecording[]>([]);
  const [plaudThreads, setPlaudThreads] = useState<PlaudThread[]>([]);
  const [selectedThread, setSelectedThread] = useState<PlaudThread | null>(null);
  const [plaudBrainFilter, setPlaudBrainFilter] = useState<'all' | 'profesional' | 'personal' | 'familiar'>('all');
  const [plaudRelevanceFilter, setPlaudRelevanceFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [plaudViewMode, setPlaudViewMode] = useState<'threads' | 'recordings'>('threads');

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [emailsRes, whatsappRes, plaudRes, threadsRes] = await Promise.all([
        supabase.from('jarvis_emails_cache').select('*').order('synced_at', { ascending: false }),
        supabase.from('jarvis_whatsapp_cache').select('*').order('last_time', { ascending: false }),
        supabase.from('plaud_recordings').select('*').order('received_at', { ascending: false }).limit(50),
        supabase.from('plaud_threads').select('*').order('event_date', { ascending: false }).limit(50)
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

  const handleRefresh = () => {
    fetchData();
    toast.success('Comunicaciones actualizadas');
  };

  const emailsByAccount = emails.reduce((acc, email) => {
    if (!acc[email.account]) acc[email.account] = [];
    acc[email.account].push(email);
    return acc;
  }, {} as Record<string, EmailCache[]>);

  const unreadEmails = emails.filter(e => !e.is_read).length;
  const unreadWhatsapp = whatsappChats.filter(c => !c.is_read).length;

  const formatTime = (dateStr: string) => {
    try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es }); }
    catch { return dateStr; }
  };

  const formatDate = (dateStr: string) => {
    try { return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es }); }
    catch { return dateStr; }
  };

  const getContextBadge = (contextType: string) => {
    switch (contextType) {
      case 'conversacion_real': return { emoji: '🗣️', label: 'Conversación', color: 'bg-green-500/10 text-green-400 border-green-500/30' };
      case 'television': return { emoji: '📺', label: 'TV filtrada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'ruido_fondo': return { emoji: '🔇', label: 'Ruido', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' };
      case 'monologico': return { emoji: '🎙️', label: 'Monólogo', color: 'bg-orange-500/10 text-orange-400 border-orange-500/30' };
      default: return { emoji: '🎙️', label: contextType || 'Sin clasificar', color: 'bg-primary/10 text-primary border-primary/30' };
    }
  };

  const getBrainIcon = (agentType: string | null) => {
    switch (agentType) {
      case 'profesional': return <Briefcase className="w-4 h-4 text-blue-500" />;
      case 'familiar': return <Users className="w-4 h-4 text-purple-500" />;
      default: return <Heart className="w-4 h-4 text-pink-500" />;
    }
  };

  const filteredThreads = plaudThreads.filter(t =>
    plaudBrainFilter === 'all' || t.agent_type === plaudBrainFilter
  );

  const filteredRecordings = plaudRecordings.filter(rec => {
    const brainMatch = plaudBrainFilter === 'all' || rec.agent_type === plaudBrainFilter;
    const relevanceMatch = plaudRelevanceFilter === 'all' || rec.relevance_category === plaudRelevanceFilter;
    return brainMatch && relevanceMatch;
  });

  // === THREAD DETAIL VIEW ===
  const ThreadDetail = ({ thread }: { thread: PlaudThread }) => {
    const badge = getContextBadge(thread.context_type);
    const speakers = Array.isArray(thread.speakers) ? thread.speakers : [];

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setSelectedThread(null)} className="gap-1">
            <X className="w-4 h-4" />
            Volver
          </Button>
        </div>

        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-2">
              <CardTitle className="text-base leading-snug">{thread.event_title}</CardTitle>
              <span className={cn("text-xs px-2 py-1 rounded border flex-shrink-0 whitespace-nowrap", badge.color)}>
                {badge.emoji} {badge.label}
              </span>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-1">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDate(thread.event_date)}
              </span>
              <span className="flex items-center gap-1">
                <Mic className="w-3 h-3" />
                {thread.recording_ids?.length || 0} grabaciones
              </span>
              <Badge variant="outline" className="text-xs">
                {getBrainIcon(thread.agent_type)}
                <span className="ml-1">{thread.agent_type || 'sin categoría'}</span>
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Participantes */}
            {speakers.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">PARTICIPANTES</p>
                <div className="flex flex-wrap gap-2">
                  {speakers.map((s: any, i: number) => (
                    <div key={i} className="flex items-center gap-1.5 px-2 py-1 rounded bg-muted/20 border border-border">
                      <div className={cn("w-2 h-2 rounded-full", s.es_agustin ? "bg-primary" : "bg-muted-foreground")} />
                      <span className="text-xs">{s.nombre_detectado || s.id_original || `Hablante ${i+1}`}</span>
                      {s.num_intervenciones && (
                        <span className="text-xs text-muted-foreground">({s.num_intervenciones})</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Transcript limpio */}
            {thread.unified_transcript && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">TRANSCRIPT</p>
                <div className="p-3 rounded-lg bg-muted/10 border border-border max-h-72 overflow-y-auto">
                  <p className="text-xs text-foreground whitespace-pre-line leading-relaxed">
                    {thread.unified_transcript}
                  </p>
                </div>
              </div>
            )}

            {/* Contactos extraídos */}
            {Array.isArray(thread.contacts_extracted) && thread.contacts_extracted.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">CONTACTOS DETECTADOS</p>
                <div className="space-y-1">
                  {thread.contacts_extracted.map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className={cn("px-1.5 py-0.5 rounded text-xs", c.action === 'created' ? "bg-green-500/10 text-green-400" : "bg-blue-500/10 text-blue-400")}>
                        {c.action === 'created' ? '✨ Nuevo' : '🔄 Actualizado'}
                      </span>
                      <span className="text-foreground">{c.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-background">
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
                  {unreadEmails + unreadWhatsapp} MENSAJES SIN LEER · {plaudThreads.length} HILOS
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Mail className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{emails.length}</p>
                  <p className="text-xs text-muted-foreground">Emails ({unreadEmails} sin leer)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <MessageCircle className="w-5 h-5 text-success" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{whatsappChats.length}</p>
                  <p className="text-xs text-muted-foreground">WhatsApp ({unreadWhatsapp} sin leer)</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-4 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                  <Mic className="w-5 h-5 text-purple-500" />
                </div>
                <div>
                  <p className="text-2xl font-bold text-foreground">{plaudThreads.length || plaudRecordings.length}</p>
                  <p className="text-xs text-muted-foreground">Plaud ({plaudThreads.length} hilos)</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3 max-w-2xl">
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
              <TabsTrigger value="plaud" className="gap-2">
                <Mic className="w-4 h-4" />
                Grabaciones
                {(plaudThreads.length || plaudRecordings.length) > 0 && (
                  <Badge variant="outline" className="ml-1 h-5 px-1.5">
                    {plaudThreads.length || plaudRecordings.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            {/* EMAIL */}
            <TabsContent value="email" className="mt-4 space-y-6">
              {loading && emails.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : Object.keys(emailsByAccount).length > 0 ? (
                Object.entries(emailsByAccount).map(([account, accountEmails]) => (
                  <div key={account} className="space-y-3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-primary" />
                      <h3 className="text-sm font-semibold text-foreground">{account}</h3>
                      <Badge variant="outline" className="text-xs">{accountEmails.length} emails</Badge>
                    </div>
                    {accountEmails.map((email) => (
                      <Card key={email.id} className={cn("border-border bg-card cursor-pointer transition-all hover:border-primary/30", !email.is_read && "bg-primary/5 border-primary/20")}>
                        <CardContent className="p-4">
                          <div className="flex items-start gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={cn("text-sm font-medium truncate", !email.is_read && "font-semibold")}>{email.from_addr}</span>
                                <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(email.synced_at)}</span>
                              </div>
                              <p className={cn("text-sm truncate mt-1", !email.is_read ? "text-foreground" : "text-muted-foreground")}>{email.subject}</p>
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
                  <CardContent className="p-6 text-center">
                    <Inbox className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay emails sincronizados</p>
                    <p className="text-xs text-muted-foreground mt-1">Los emails se sincronizarán automáticamente</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* WHATSAPP */}
            <TabsContent value="whatsapp" className="mt-4 space-y-3">
              {loading && whatsappChats.length === 0 ? (
                <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
              ) : whatsappChats.length > 0 ? (
                whatsappChats.map((chat) => (
                  <Card key={chat.id} className={cn("border-border bg-card cursor-pointer transition-all hover:border-success/30", !chat.is_read && "bg-success/5 border-success/20")}>
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
                          <p className={cn("text-sm truncate mt-1", !chat.is_read ? "text-foreground" : "text-muted-foreground")}>{chat.last_message}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                  <CardContent className="p-6 text-center">
                    <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">No hay chats de WhatsApp</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* PLAUD */}
            <TabsContent value="plaud" className="mt-4 space-y-4">
              {/* Si hay un thread seleccionado, mostrar detalle */}
              {selectedThread ? (
                <ThreadDetail thread={selectedThread} />
              ) : (
                <>
                  {/* Controls */}
                  <div className="flex flex-wrap gap-3 items-center justify-between">
                    {/* View toggle */}
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <Button
                        variant={plaudViewMode === 'threads' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPlaudViewMode('threads')}
                        className="rounded-none h-8 text-xs gap-1"
                      >
                        <MessageSquare className="w-3 h-3" />
                        Hilos ({plaudThreads.length})
                      </Button>
                      <Button
                        variant={plaudViewMode === 'recordings' ? 'default' : 'ghost'}
                        size="sm"
                        onClick={() => setPlaudViewMode('recordings')}
                        className="rounded-none h-8 text-xs gap-1"
                      >
                        <Mic className="w-3 h-3" />
                        Grabaciones ({plaudRecordings.length})
                      </Button>
                    </div>

                    {/* Brain filter */}
                    <div className="flex items-center gap-1">
                      {(['all', 'profesional', 'personal', 'familiar'] as const).map(f => (
                        <Button
                          key={f}
                          variant={plaudBrainFilter === f ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPlaudBrainFilter(f)}
                          className="h-7 text-xs"
                        >
                          {f === 'all' ? 'Todos' : f === 'profesional' ? '💼' : f === 'personal' ? '❤️' : '👨‍👩‍👧'}
                          {f !== 'all' && <span className="ml-1 hidden sm:inline">{f}</span>}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* THREADS VIEW */}
                  {plaudViewMode === 'threads' && (
                    <div className="space-y-3">
                      {loading && plaudThreads.length === 0 ? (
                        <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                      ) : filteredThreads.length > 0 ? (
                        filteredThreads.map((thread) => {
                          const badge = getContextBadge(thread.context_type);
                          const speakers = Array.isArray(thread.speakers) ? thread.speakers : [];
                          const speakerNames = speakers.map((s: any) => s.nombre_detectado || s.id_original || '?').join(' · ');

                          return (
                            <Card
                              key={thread.id}
                              className="border-border bg-card cursor-pointer transition-all hover:border-primary/40 hover:bg-primary/5"
                              onClick={() => setSelectedThread(thread)}
                            >
                              <CardContent className="p-4">
                                <div className="flex items-start gap-3">
                                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                                    {getBrainIcon(thread.agent_type)}
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-1">
                                      <p className="text-sm font-medium line-clamp-2">{thread.event_title}</p>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <span className={cn("text-xs px-1.5 py-0.5 rounded border", badge.color)}>
                                          {badge.emoji}
                                        </span>
                                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <Clock className="w-3 h-3" />
                                      <span>{formatTime(thread.event_date)}</span>
                                      {thread.recording_ids?.length > 1 && (
                                        <Badge variant="outline" className="text-xs h-4 px-1">
                                          {thread.recording_ids.length} grabaciones
                                        </Badge>
                                      )}
                                    </div>
                                    {speakerNames && (
                                      <p className="text-xs text-muted-foreground mt-1">
                                        👥 {speakerNames}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })
                      ) : (
                        <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                          <CardContent className="p-6 text-center">
                            <MessageSquare className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No hay hilos procesados aún</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Ejecuta el script plaud-pipeline-v2.py para procesar grabaciones y crear hilos
                            </p>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  )}

                  {/* RECORDINGS VIEW */}
                  {plaudViewMode === 'recordings' && (
                    <>
                      {/* Relevance filter (only in recordings view) */}
                      <div className="flex items-center gap-1 flex-wrap">
                        <span className="text-xs text-muted-foreground">Relevancia:</span>
                        {(['all', 'high', 'medium', 'low'] as const).map(f => (
                          <Button
                            key={f}
                            variant={plaudRelevanceFilter === f ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setPlaudRelevanceFilter(f)}
                            className="h-7 text-xs"
                          >
                            {f === 'all' ? 'Todas' : f === 'high' ? '🔴 Alta' : f === 'medium' ? '🟡 Media' : '⚪ Baja'}
                          </Button>
                        ))}
                      </div>

                      <div className="space-y-3">
                        {loading && filteredRecordings.length === 0 ? (
                          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin text-muted-foreground" /></div>
                        ) : filteredRecordings.length > 0 ? (
                          filteredRecordings.map((recording) => {
                            const relevanceEmoji = recording.relevance_category === 'high' ? '🔴' : recording.relevance_category === 'medium' ? '🟡' : '⚪';
                            return (
                              <Card key={recording.id} className="border-border bg-card cursor-pointer transition-all hover:border-primary/30">
                                <CardContent className="p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                                      {getBrainIcon(recording.agent_type)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 mb-1">
                                        <span className="text-sm font-medium truncate">{recording.title}</span>
                                        <Badge variant="outline" className="text-xs">{relevanceEmoji} {recording.relevance_score}/100</Badge>
                                        <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(recording.received_at)}</span>
                                      </div>
                                      {recording.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{recording.summary}</p>}
                                      {recording.audio_url && (
                                        <div className="mt-2">
                                          <audio controls className="w-full h-8">
                                            <source src={recording.audio_url} type="audio/mpeg" />
                                          </audio>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </CardContent>
                              </Card>
                            );
                          })
                        ) : (
                          <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                            <CardContent className="p-6 text-center">
                              <Mic className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                              <p className="text-sm text-muted-foreground">No hay grabaciones</p>
                            </CardContent>
                          </Card>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default Communications;
