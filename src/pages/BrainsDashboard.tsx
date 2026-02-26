import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import {
  Briefcase, Heart, Users, Brain, TrendingUp, MessageSquare,
  Target, Smile, AlertCircle, Lightbulb, Calendar, RefreshCw, Loader2,
  Mic, FileText, Volume2
} from "lucide-react";
import { toast } from "sonner";

interface PlaudThread {
  id: string;
  event_title: string;
  event_date: string;
  recording_ids: string[];
  unified_transcript: string;
  speakers: any[];
  context_type: string;
  contacts_extracted: any[];
  agent_type: string;
  created_at: string;
}

interface JarvisMemory {
  id: string;
  type: string;
  content: any;
  created_at: string;
  [key: string]: any;
}

interface PeopleContact {
  id: string;
  name: string;
  role: string;
  personality_profile: any;
  ai_tags: string[];
}

const BrainsDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [threads, setThreads] = useState<PlaudThread[]>([]);
  const [memories, setMemories] = useState<JarvisMemory[]>([]);
  const [contacts, setContacts] = useState<PeopleContact[]>([]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [threadsRes, memoriesRes, contactsRes] = await Promise.all([
        supabase.from('plaud_threads').select('*').order('event_date', { ascending: false }).limit(30),
        supabase.from('jarvis_memory').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('people_contacts').select('*').limit(50)
      ]);

      if (threadsRes.data) setThreads(threadsRes.data as any);
      if (memoriesRes.data) setMemories(memoriesRes.data as any);
      if (contactsRes.data) setContacts(contactsRes.data);
    } catch (error) {
      console.error('Error fetching brains dashboard:', error);
      toast.error('Error cargando dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [user]);

  const formatTime = (dateStr: string) => {
    try {
      return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
    } catch { return dateStr; }
  };

  const formatDate = (dateStr: string) => {
    try {
      return format(new Date(dateStr), "d MMM yyyy, HH:mm", { locale: es });
    } catch { return dateStr; }
  };

  const professionalThreads = threads.filter(t => t.agent_type === 'profesional');
  const personalThreads = threads.filter(t => t.agent_type === 'personal');
  const familiarThreads = threads.filter(t => t.agent_type === 'familiar');
  
  const agustinState = memories.find(m => m.type === 'agustin_state');
  
  // Extract business opportunities from professional threads
  const businessOpportunities = professionalThreads.flatMap(t => {
    const contacts_info = Array.isArray(t.contacts_extracted) ? t.contacts_extracted : [];
    return contacts_info.flatMap((c: any) => {
      const profile = contacts.find(ct => ct.id === c.id)?.personality_profile;
      return profile?.oportunidades_negocio || [];
    });
  }).filter(Boolean).slice(0, 6);

  const getContextBadge = (contextType: string) => {
    switch (contextType) {
      case 'conversacion_real': return { icon: <MessageSquare className="w-3 h-3" />, label: 'Conversacion', color: 'bg-green-500/10 text-green-400 border-green-500/30' };
      case 'television': return { icon: <Lightbulb className="w-3 h-3" />, label: 'TV filtrada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' };
      case 'ruido_fondo': return { icon: <AlertCircle className="w-3 h-3" />, label: 'Ruido', color: 'bg-gray-500/10 text-gray-400 border-gray-500/30' };
      default: return { icon: <Mic className="w-3 h-3" />, label: contextType, color: 'bg-primary/10 text-primary border-primary/30' };
    }
  };

  const ThreadCard = ({ thread }: { thread: PlaudThread }) => {
    const badge = getContextBadge(thread.context_type);
    const speakerNames = Array.isArray(thread.speakers)
      ? thread.speakers.map((s: any) => s.nombre_detectado || s.id_original || '?').join(', ')
      : '';

    return (
      <Card className="border-border bg-card hover:border-primary/30 transition-all cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h3 className="text-sm font-medium text-foreground line-clamp-2 flex-1">
              {thread.event_title}
            </h3>
            <span className={cn("text-xs px-2 py-0.5 rounded border flex-shrink-0 flex items-center gap-1", badge.color)}>
              {badge.icon} {badge.label}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{formatDate(thread.event_date)}</p>
          {speakerNames && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="w-3 h-3" /> {speakerNames}
            </p>
          )}
          {thread.unified_transcript && (
            <p className="text-xs text-muted-foreground mt-2 line-clamp-2 opacity-70">
              {thread.unified_transcript.slice(0, 150)}...
            </p>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="p-4 lg:p-6 space-y-6">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center shadow-lg shadow-purple-500/30">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Dashboard 3 Cerebros</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {threads.length} EVENTOS · {contacts.length} CONTACTOS
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="border-border bg-card">
              <CardContent className="p-3 flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-blue-500" />
                <div>
                  <p className="text-lg font-bold">{professionalThreads.length}</p>
                  <p className="text-xs text-muted-foreground">Profesional</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 flex items-center gap-2">
                <Heart className="w-5 h-5 text-pink-500" />
                <div>
                  <p className="text-lg font-bold">{personalThreads.length}</p>
                  <p className="text-xs text-muted-foreground">Personal</p>
                </div>
              </CardContent>
            </Card>
            <Card className="border-border bg-card">
              <CardContent className="p-3 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                <div>
                  <p className="text-lg font-bold">{familiarThreads.length}</p>
                  <p className="text-xs text-muted-foreground">Familiar</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* 3 Cerebros Tabs */}
          <Tabs defaultValue="profesional">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="profesional" className="gap-1.5">
                <Briefcase className="w-4 h-4" />
                Profesional
              </TabsTrigger>
              <TabsTrigger value="personal" className="gap-1.5">
                <Heart className="w-4 h-4" />
                Personal
              </TabsTrigger>
              <TabsTrigger value="familiar" className="gap-1.5">
                <Users className="w-4 h-4" />
                Familiar
              </TabsTrigger>
            </TabsList>

            {/* PROFESIONAL */}
            <TabsContent value="profesional" className="space-y-4 mt-4">
              {/* Oportunidades de negocio */}
              {businessOpportunities.length > 0 && (
                <Card className="border-primary/20 bg-primary/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-primary" />
                      Oportunidades de Negocio Detectadas
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4">
                    <ul className="space-y-1">
                      {businessOpportunities.map((opp, i) => (
                        <li key={i} className="text-sm text-foreground flex items-start gap-2">
                          <span className="text-primary mt-0.5">•</span>
                          {opp}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Reuniones recientes */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  ÚLTIMAS REUNIONES Y CONVERSACIONES
                </h3>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : professionalThreads.length > 0 ? (
                  <div className="space-y-3">
                    {professionalThreads.map(t => <ThreadCard key={t.id} thread={t} />)}
                  </div>
                ) : (
                  <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                    <CardContent className="p-6 text-center">
                      <Briefcase className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No hay conversaciones profesionales procesadas aún</p>
                      <p className="text-xs text-muted-foreground mt-1">Ejecuta el pipeline Plaud para procesar grabaciones</p>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Contactos clave */}
              {contacts.filter(c => c.ai_tags?.some(t => t.includes('profesional'))).length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-muted-foreground mb-3 flex items-center gap-2">
                    <Target className="w-4 h-4" />
                    CONTACTOS CLAVE PROFESIONALES
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {contacts.filter(c => c.ai_tags?.some(t => t.includes('profesional'))).slice(0, 6).map(c => (
                      <Card key={c.id} className="border-border bg-card">
                        <CardContent className="p-3 flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 font-bold text-sm">
                            {c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{c.name}</p>
                            <p className="text-xs text-muted-foreground truncate">{c.role || c.personality_profile?.relacion_con_agustin || '—'}</p>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </TabsContent>

            {/* PERSONAL */}
            <TabsContent value="personal" className="space-y-4 mt-4">
              {/* Estado emocional */}
              {agustinState && (
                <Card className="border-pink-500/20 bg-pink-500/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Smile className="w-4 h-4 text-pink-500" />
                      Estado Actual de Agustín
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-3">
                    {typeof agustinState.content === 'object' ? (
                      <div className="space-y-2">
                        {Object.entries(agustinState.content as Record<string, any>).map(([k, v]) => (
                          <div key={k}>
                            <span className="text-xs text-muted-foreground capitalize">{k.replace(/_/g, ' ')}: </span>
                            <span className="text-xs text-foreground">{typeof v === 'string' ? v : JSON.stringify(v)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm">{String(agustinState.content)}</p>
                    )}
                    <p className="text-xs text-muted-foreground">{formatTime(agustinState.created_at)}</p>
                  </CardContent>
                </Card>
              )}

              {/* Sugerencias de acción */}
              <Card className="border-border bg-card">
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-yellow-500" />
                    Sugerencias de Acción
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {[
                    "Revisar sesion de meditacion si el estado emocional es tenso",
                    "Practicar ingles 20min (nivel actual: intermedio-avanzado)",
                    "Actividad fisica si llevas >2 dias sin ejercicio",
                    "Journaling para procesar conversaciones del dia"
                  ].map((s, i) => (
                    <p key={i} className="text-sm text-foreground flex items-center gap-1.5"><span className="text-primary">-</span> {s}</p>
                  ))}
                </CardContent>
              </Card>

              {/* Conversaciones personales */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">CONVERSACIONES PERSONALES RECIENTES</h3>
                {personalThreads.length > 0 ? (
                  <div className="space-y-3">
                    {personalThreads.map(t => <ThreadCard key={t.id} thread={t} />)}
                  </div>
                ) : (
                  <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                    <CardContent className="p-6 text-center">
                      <Heart className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No hay conversaciones personales procesadas aún</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            {/* FAMILIAR */}
            <TabsContent value="familiar" className="space-y-4 mt-4">
              {/* Eventos familiares detectados */}
              {familiarThreads.length > 0 && (
                <Card className="border-purple-500/20 bg-purple-500/5">
                  <CardHeader className="pb-2 pt-4 px-4">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-purple-500" />
                      Eventos Familiares Detectados
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 pb-4 space-y-2">
                    {familiarThreads.slice(0, 3).map(t => (
                      <div key={t.id} className="flex items-center gap-2">
                        <span className="text-xs text-purple-400"><Calendar className="w-3 h-3 inline" /></span>
                        <span className="text-sm">{t.event_title}</span>
                        <span className="text-xs text-muted-foreground ml-auto">{formatTime(t.event_date)}</span>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {/* Conversaciones familiares */}
              <div>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3">CONVERSACIONES FAMILIARES RECIENTES</h3>
                {familiarThreads.length > 0 ? (
                  <div className="space-y-3">
                    {familiarThreads.map(t => <ThreadCard key={t.id} thread={t} />)}
                  </div>
                ) : (
                  <Card className="border-dashed border-2 border-muted-foreground/30 bg-transparent">
                    <CardContent className="p-6 text-center">
                      <Users className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">No hay conversaciones familiares procesadas aún</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          </Tabs>
    </main>
  );
};

export default BrainsDashboard;
