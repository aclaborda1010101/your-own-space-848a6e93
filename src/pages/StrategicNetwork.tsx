import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User, Briefcase, Heart, Users,
  Loader2, RefreshCw, Search, Mic,
  Mail, MessageCircle, Brain, Tag,
  Star, TrendingUp, Eye, Trophy,
  AlertTriangle, Sparkles, Shield, Target,
  Lightbulb, Clock, Phone, Globe,
} from 'lucide-react';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────────

interface Contact {
  id: string;
  name: string;
  role: string | null;
  brain: string | null;
  company: string | null;
  relationship: string | null;
  last_contact: string | null;
  ai_tags: string[] | null;
  personality_profile: any;
  interaction_count: number;
  is_favorite?: boolean;
  wa_message_count?: number;
  phone_numbers?: string[];
}

interface PlaudRecording {
  id: string;
  title: string | null;
  received_at: string | null;
  agent_type: string | null;
  summary: string | null;
  audio_url: string | null;
}

interface PlaudThread {
  id: string;
  event_title: string | null;
  event_date: string | null;
  recording_ids: string[] | null;
  speakers: unknown;
  agent_type: string | null;
}

type ViewFilter = 'active' | 'top100' | 'favorites' | 'all';

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

const getInitial = (name: string) => name.trim().charAt(0).toUpperCase();

const formatTime = (dateStr: string | null) => {
  if (!dateStr) return 'Sin contacto reciente';
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

const contactIsInThread = (contactName: string, thread: PlaudThread): boolean => {
  const names = getSpeakerNames(thread.speakers);
  return names.some(n => n.toLowerCase().includes(contactName.toLowerCase().split(' ')[0]));
};

// ── Contact List Item ──────────────────────────────────────────────────────────

interface ContactItemProps {
  contact: Contact;
  selected: boolean;
  onClick: () => void;
  hasPlaud: boolean;
  onToggleFavorite: (e: React.MouseEvent) => void;
}

const ContactItem = ({ contact, selected, onClick, hasPlaud, onToggleFavorite }: ContactItemProps) => (
  <button
    onClick={onClick}
    className={cn(
      "w-full text-left p-3 rounded-xl border transition-all",
      selected
        ? "bg-primary/10 border-primary/40"
        : "bg-card border-border hover:bg-muted/5 hover:border-muted-foreground/30"
    )}
  >
    <div className="flex items-center gap-3">
      {/* Avatar */}
      <div className={cn(
        "w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 border",
        getBrainColor(contact.brain)
      )}>
        {getInitial(contact.name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className="text-sm font-medium text-foreground truncate">{contact.name}</p>
          {contact.brain && (
            <Badge variant="outline" className={cn("text-xs h-4 px-1 flex-shrink-0", getBrainColor(contact.brain))}>
              {getBrainIcon(contact.brain)}
            </Badge>
          )}
        </div>
        {contact.role && <p className="text-xs text-muted-foreground truncate mt-0.5">{contact.role}</p>}
        <p className="text-xs text-muted-foreground mt-0.5">{formatTime(contact.last_contact)}</p>

        {/* Source badges */}
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {hasPlaud && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"><Mic className="w-3 h-3" /> Plaud</span>
          )}
          {(contact.wa_message_count || 0) > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> {contact.wa_message_count} msgs
            </span>
          )}
          {contact.interaction_count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground border border-border">
              {contact.interaction_count} interacciones
            </span>
          )}
        </div>
      </div>

      {/* Favorite star */}
      <button
        onClick={onToggleFavorite}
        className="flex-shrink-0 p-1 rounded-full hover:bg-muted/30 transition-colors"
      >
        <Star className={cn("w-4 h-4", contact.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground/40")} />
      </button>
    </div>
  </button>
);

// ── Contact Detail Panel ───────────────────────────────────────────────────────

interface ContactDetailProps {
  contact: Contact;
  threads: PlaudThread[];
  recordings: PlaudRecording[];
}

const ContactDetail = ({ contact, threads, recordings }: ContactDetailProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [analyzing, setAnalyzing] = useState(false);

  const contactThreads = threads.filter(t => contactIsInThread(contact.name, t));
  const contactRecordingIds = new Set(contactThreads.flatMap(t => t.recording_ids || []));
  const contactRecordings = recordings.filter(r => contactRecordingIds.has(r.id));

  const profile = contact.personality_profile as Record<string, unknown> | null;
  const hasProfile = profile && Object.keys(profile).length > 0 && profile.sinopsis;

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const { data, error } = await supabase.functions.invoke('contact-analysis', {
        body: { contact_id: contact.id },
      });
      if (error) throw error;
      // Update the contact locally with the new profile
      contact.personality_profile = data.profile;
      toast.success('Análisis completado');
    } catch (err) {
      console.error('Analysis error:', err);
      toast.error('Error al analizar el contacto');
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold border-2",
              getBrainColor(contact.brain)
            )}>
              {getInitial(contact.name)}
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-bold text-foreground">{contact.name}</h2>
              {contact.role && <p className="text-sm text-muted-foreground">{contact.role}</p>}
              {contact.company && <p className="text-xs text-muted-foreground mt-0.5">{contact.company}</p>}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {contact.brain && (
                  <Badge variant="outline" className={cn("text-xs flex items-center gap-1", getBrainColor(contact.brain))}>
                    {getBrainIcon(contact.brain)}
                    {contact.brain}
                  </Badge>
                )}
                {contact.relationship && (
                  <Badge variant="outline" className="text-xs">{contact.relationship}</Badge>
                )}
                {(contact.wa_message_count || 0) > 0 && (
                  <Badge variant="outline" className="text-xs text-green-400 border-green-500/30 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {contact.wa_message_count} msgs WA
                  </Badge>
                )}
              </div>
            </div>
            <Button
              size="sm"
              onClick={handleAnalyze}
              disabled={analyzing}
              className="flex-shrink-0"
            >
              {analyzing ? (
                <Loader2 className="w-4 h-4 animate-spin mr-1.5" />
              ) : (
                <Sparkles className="w-4 h-4 mr-1.5" />
              )}
              {analyzing ? 'Analizando...' : 'Analizar IA'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profile" className="gap-1 text-xs">
            <Brain className="w-3.5 h-3.5" />
            Perfil
          </TabsTrigger>
          <TabsTrigger value="plaud" className="gap-1 text-xs">
            <Mic className="w-3.5 h-3.5" />
            Plaud
            {contactRecordings.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">{contactRecordings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1 text-xs">
            <Mail className="w-3.5 h-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1 text-xs">
            <MessageCircle className="w-3.5 h-3.5" />
            WA
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab - AI Analysis */}
        <TabsContent value="profile" className="mt-3 space-y-3">
          {hasProfile ? (
            <>
              {/* Synopsis */}
              {profile.sinopsis && (
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">SINOPSIS</p>
                    <p className="text-sm text-foreground leading-relaxed">{String(profile.sinopsis)}</p>
                  </CardContent>
                </Card>
              )}

              {/* Frequent Topics */}
              {Array.isArray(profile.temas_frecuentes) && profile.temas_frecuentes.length > 0 && (
                <Card className="border-border bg-card">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">TEMAS FRECUENTES</p>
                    <div className="flex flex-wrap gap-1.5">
                      {(profile.temas_frecuentes as string[]).map((tema, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          <Tag className="w-2.5 h-2.5 mr-1" />{tema}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Psychological Profile */}
              {profile.perfil_psicologico && typeof profile.perfil_psicologico === 'object' && (
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">PERFIL PSICOLÓGICO</p>
                    {(() => {
                      const psych = profile.perfil_psicologico as Record<string, unknown>;
                      return (
                        <>
                          {Array.isArray(psych.rasgos) && (
                            <div className="flex flex-wrap gap-1.5">
                              {(psych.rasgos as string[]).map((r, i) => (
                                <Badge key={i} variant="secondary" className="text-xs">{r}</Badge>
                              ))}
                            </div>
                          )}
                          <div className="grid grid-cols-3 gap-2 text-xs">
                            <div className="p-2 rounded-lg bg-muted/30 text-center">
                              <p className="text-muted-foreground mb-0.5">Estilo</p>
                              <p className="font-medium text-foreground capitalize">{String(psych.estilo_comunicacion || '—')}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/30 text-center">
                              <p className="text-muted-foreground mb-0.5">Patrón</p>
                              <p className="font-medium text-foreground capitalize">{String(psych.patron_comunicacion || '—')}</p>
                            </div>
                            <div className="p-2 rounded-lg bg-muted/30 text-center">
                              <p className="text-muted-foreground mb-0.5">Registro</p>
                              <p className="font-medium text-foreground capitalize">{String(psych.registro_emocional || '—')}</p>
                            </div>
                          </div>
                          {psych.descripcion && (
                            <p className="text-xs text-foreground leading-relaxed">{String(psych.descripcion)}</p>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Strategic Analysis */}
              {profile.analisis_estrategico && typeof profile.analisis_estrategico === 'object' && (
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">ANÁLISIS ESTRATÉGICO</p>
                    {(() => {
                      const strat = profile.analisis_estrategico as Record<string, unknown>;
                      return (
                        <>
                          {/* Trust meter */}
                          {typeof strat.nivel_confianza === 'number' && (
                            <div className="flex items-center gap-3">
                              <Shield className="w-4 h-4 text-primary flex-shrink-0" />
                              <div className="flex-1">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-muted-foreground">Nivel de confianza</span>
                                  <span className="text-xs font-bold text-foreground">{strat.nivel_confianza}/10</span>
                                </div>
                                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                                  <div
                                    className="h-full rounded-full bg-primary transition-all"
                                    style={{ width: `${(strat.nivel_confianza as number) * 10}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Attention level */}
                          {strat.nivel_atencion && (
                            <div className="flex items-center gap-2">
                              <Target className="w-4 h-4 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">Atención requerida:</span>
                              <Badge variant="outline" className={cn("text-xs capitalize",
                                strat.nivel_atencion === 'alto' ? 'border-red-500/30 text-red-400' :
                                strat.nivel_atencion === 'medio' ? 'border-yellow-500/30 text-yellow-400' :
                                'border-green-500/30 text-green-400'
                              )}>
                                {String(strat.nivel_atencion)}
                              </Badge>
                            </div>
                          )}

                          {strat.como_nos_percibe && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Cómo nos percibe</p>
                              <p className="text-xs text-foreground leading-relaxed">{String(strat.como_nos_percibe)}</p>
                            </div>
                          )}

                          {Array.isArray(strat.oportunidades) && strat.oportunidades.length > 0 && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Oportunidades</p>
                              <ul className="space-y-1">
                                {(strat.oportunidades as string[]).map((op, i) => (
                                  <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                    <TrendingUp className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                                    {op}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {strat.valor_relacional && (
                            <div>
                              <p className="text-xs text-muted-foreground mb-1">Valor relacional</p>
                              <p className="text-xs text-foreground leading-relaxed">{String(strat.valor_relacional)}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}

              {/* Sensitive Topics */}
              {Array.isArray(profile.temas_sensibles) && profile.temas_sensibles.length > 0 && (
                <Card className="border-border bg-card border-yellow-500/20">
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold text-yellow-400 font-mono mb-2 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      TEMAS SENSIBLES
                    </p>
                    <ul className="space-y-1">
                      {(profile.temas_sensibles as string[]).map((tema, i) => (
                        <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                          <span className="text-yellow-400 mt-0.5">⚠</span>
                          {tema}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {/* Recommendations */}
              {profile.recomendaciones && typeof profile.recomendaciones === 'object' && (
                <Card className="border-border bg-card">
                  <CardContent className="p-4 space-y-3">
                    <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">RECOMENDACIONES</p>
                    {(() => {
                      const rec = profile.recomendaciones as Record<string, unknown>;
                      return (
                        <>
                          {Array.isArray(rec.consejos) && (
                            <ul className="space-y-1.5">
                              {(rec.consejos as string[]).map((c, i) => (
                                <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                                  <Lightbulb className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                                  {c}
                                </li>
                              ))}
                            </ul>
                          )}
                          <div className="flex flex-wrap gap-2 text-xs">
                            {rec.frecuencia_contacto && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30">
                                <Clock className="w-3 h-3 text-muted-foreground" />
                                <span className="capitalize">{String(rec.frecuencia_contacto)}</span>
                              </div>
                            )}
                            {rec.mejor_canal && (
                              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30">
                                {rec.mejor_canal === 'whatsapp' ? <MessageCircle className="w-3 h-3 text-muted-foreground" /> :
                                 rec.mejor_canal === 'email' ? <Mail className="w-3 h-3 text-muted-foreground" /> :
                                 rec.mejor_canal === 'llamada' ? <Phone className="w-3 h-3 text-muted-foreground" /> :
                                 <Globe className="w-3 h-3 text-muted-foreground" />}
                                <span className="capitalize">{String(rec.mejor_canal)}</span>
                              </div>
                            )}
                          </div>
                          {rec.proxima_accion && (
                            <div className="p-2 rounded-lg bg-primary/5 border border-primary/20">
                              <p className="text-xs text-muted-foreground mb-0.5">Próxima acción sugerida</p>
                              <p className="text-xs text-foreground font-medium">{String(rec.proxima_accion)}</p>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <div className="py-12 text-center space-y-3">
              <Brain className="w-10 h-10 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Sin análisis de perfil todavía</p>
              <p className="text-xs text-muted-foreground">Pulsa "Analizar IA" para generar un perfil inteligente</p>
            </div>
          )}
        </TabsContent>

        {/* Plaud Tab */}
        <TabsContent value="plaud" className="mt-3 space-y-3">
          {contactRecordings.length > 0 ? (
            contactRecordings.map(rec => {
              const thread = contactThreads.find(t => (t.recording_ids || []).includes(rec.id));
              const speakers = getSpeakerNames(thread?.speakers);
              return (
                <Card key={rec.id} className="border-border bg-card">
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-foreground line-clamp-1">{rec.title || 'Sin título'}</p>
                      {rec.agent_type && (
                        <Badge variant="outline" className={cn("text-xs flex-shrink-0 flex items-center gap-1", getBrainColor(rec.agent_type))}>
                          {getBrainIcon(rec.agent_type)}
                          {rec.agent_type}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(rec.received_at)}</p>
                    {speakers.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {speakers.map((n, i) => (
                          <span key={i} className={cn(
                            "text-xs px-1.5 py-0.5 rounded-full border",
                            n.toLowerCase().includes(contact.name.toLowerCase().split(' ')[0])
                              ? "bg-primary/15 text-primary border-primary/30 font-medium"
                              : "bg-muted/10 text-muted-foreground border-border"
                          )}>
                            <User className="w-3 h-3 inline mr-0.5" />{n}
                          </span>
                        ))}
                      </div>
                    )}
                    {rec.summary && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{rec.summary}</p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          ) : (
            <div className="py-8 text-center space-y-2">
              <Mic className="w-8 h-8 text-muted-foreground mx-auto" />
              <p className="text-sm text-muted-foreground">Sin grabaciones como hablante</p>
            </div>
          )}
        </TabsContent>

        <TabsContent value="email" className="mt-3">
          <div className="py-8 text-center space-y-2">
            <Mail className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Sin emails vinculados</p>
          </div>
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-3">
          <div className="py-8 text-center space-y-2">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">
              {(contact.wa_message_count || 0) > 0
                ? `${contact.wa_message_count} mensajes importados`
                : 'Sin WhatsApp vinculado'}
            </p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StrategicNetwork() {
  
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recordings, setRecordings] = useState<PlaudRecording[]>([]);
  const [threads, setThreads] = useState<PlaudThread[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [viewFilter, setViewFilter] = useState<ViewFilter>('top100');

  useEffect(() => { fetchData(); }, [user]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, recordingsRes, threadsRes] = await Promise.all([
        supabase.from('people_contacts').select('*').order('name'),
        supabase.from('plaud_recordings').select('id,title,received_at,agent_type,summary,audio_url').limit(200),
        supabase.from('plaud_threads').select('id,event_title,event_date,recording_ids,speakers,agent_type').order('event_date', { ascending: false }).limit(100),
      ]);

      if (contactsRes.data) {
        // Sort by wa_message_count desc by default
        const sorted = [...contactsRes.data].sort((a: any, b: any) => (b.wa_message_count || 0) - (a.wa_message_count || 0));
        setContacts(sorted);
        if (sorted.length > 0 && !selectedContact) {
          setSelectedContact(sorted[0]);
        }
      }
      if (recordingsRes.data) setRecordings(recordingsRes.data);
      if (threadsRes.data) setThreads(threadsRes.data);
    } catch (error) {
      console.error('Error fetching contacts:', error);
      toast.error('Error cargando contactos');
    } finally {
      setLoading(false);
    }
  };

  const toggleFavorite = async (contact: Contact, e: React.MouseEvent) => {
    e.stopPropagation();
    const newVal = !contact.is_favorite;
    try {
      await (supabase as any).from('people_contacts').update({ is_favorite: newVal }).eq('id', contact.id);
      setContacts(prev => prev.map(c => c.id === contact.id ? { ...c, is_favorite: newVal } : c));
      if (selectedContact?.id === contact.id) {
        setSelectedContact({ ...selectedContact, is_favorite: newVal });
      }
      toast.success(newVal ? `${contact.name} marcado como favorito` : `${contact.name} desmarcado`);
    } catch {
      toast.error('Error al actualizar favorito');
    }
  };

  const contactHasPlaud = (contact: Contact) =>
    threads.some(t => contactIsInThread(contact.name, t));

  const filteredContacts = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.role || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    switch (viewFilter) {
      case 'favorites':
        return c.is_favorite === true;
      case 'top100':
        return true; // We'll slice later
      case 'active':
        return (c.wa_message_count || 0) > 0 || c.is_favorite === true || (c.interaction_count || 0) >= 3;
      case 'all':
        return true;
      default:
        return true;
    }
  });

  // For top100, take only first 100 sorted by wa_message_count
  const displayContacts = viewFilter === 'top100' ? filteredContacts.slice(0, 100) : filteredContacts;

  // Sort: favorites first, then by wa_message_count
  const sortedContacts = [...displayContacts].sort((a, b) => {
    if (a.is_favorite && !b.is_favorite) return -1;
    if (!a.is_favorite && b.is_favorite) return 1;
    return (b.wa_message_count || 0) - (a.wa_message_count || 0);
  });

  const favCount = contacts.filter(c => c.is_favorite).length;
  const activeCount = contacts.filter(c => (c.wa_message_count || 0) > 0 || c.is_favorite || (c.interaction_count || 0) >= 3).length;

  return (
    <main className="p-4 lg:p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center shadow-lg shadow-primary/30">
                <Users className="w-6 h-6 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Contactos</h1>
                <p className="text-sm text-muted-foreground font-mono">
                  {contacts.length} TOTAL · {favCount} FAV · {activeCount} ACTIVOS
                </p>
              </div>
            </div>
            <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </Button>
          </div>

          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4">
            {/* ── LEFT: Contact list ──────────────────────────────────────── */}
            <div className="space-y-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar contacto..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="pl-9 h-9 text-sm"
                />
              </div>

              {/* View filter */}
              <div className="flex gap-1.5 flex-wrap">
                <Button
                  variant={viewFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewFilter('active')}
                  className="h-7 text-xs"
                >
                  <TrendingUp className="w-3 h-3 mr-1" />
                  Activos ({activeCount})
                </Button>
                <Button
                  variant={viewFilter === 'top100' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewFilter('top100')}
                  className="h-7 text-xs"
                >
                  <Trophy className="w-3 h-3 mr-1" /> Top 100
                </Button>
                <Button
                  variant={viewFilter === 'favorites' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewFilter('favorites')}
                  className="h-7 text-xs"
                >
                  <Star className="w-3 h-3 mr-1" />
                  Favoritos ({favCount})
                </Button>
                <Button
                  variant={viewFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setViewFilter('all')}
                  className="h-7 text-xs"
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Todos ({contacts.length})
                </Button>
              </div>

              {/* List */}
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : sortedContacts.length > 0 ? (
                <div className="space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto pr-1">
                  {sortedContacts.map(contact => (
                    <ContactItem
                      key={contact.id}
                      contact={contact}
                      selected={selectedContact?.id === contact.id}
                      onClick={() => setSelectedContact(contact)}
                      hasPlaud={contactHasPlaud(contact)}
                      onToggleFavorite={(e) => toggleFavorite(contact, e)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? `Sin resultados para "${search}"` : 
                     viewFilter === 'favorites' ? 'No hay favoritos. Marca contactos con la estrella' :
                     'No hay contactos todavia'}
                  </p>
                </div>
              )}
            </div>

            {/* ── RIGHT: Contact detail ───────────────────────────────────── */}
            <div>
              {selectedContact ? (
                <ContactDetail
                  contact={selectedContact}
                  threads={threads}
                  recordings={recordings}
                />
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-3">
                  <div className="w-16 h-16 rounded-full bg-muted/20 flex items-center justify-center">
                    <User className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <p className="text-sm text-muted-foreground">Selecciona un contacto para ver su ficha</p>
                </div>
              )}
            </div>
          </div>
    </main>
  );
}
