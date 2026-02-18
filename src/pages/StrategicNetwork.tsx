import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { SidebarNew } from '@/components/layout/SidebarNew';
import { TopBar } from '@/components/layout/TopBar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { format, formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  User, Briefcase, Heart, Users,
  Loader2, RefreshCw, Search, Mic,
  Mail, MessageCircle, Brain, Tag
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

// Contact appears as SPEAKER in thread (not just mentioned)
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
}

const ContactItem = ({ contact, selected, onClick, hasPlaud }: ContactItemProps) => (
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
            <span className="text-xs px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">🎙️ Plaud</span>
          )}
          {contact.interaction_count > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-muted/20 text-muted-foreground border border-border">
              {contact.interaction_count} interacciones
            </span>
          )}
        </div>
      </div>
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
  const [activeTab, setActiveTab] = useState('plaud');

  // Threads where this contact appears as a SPEAKER (not just mentioned)
  const contactThreads = threads.filter(t => contactIsInThread(contact.name, t));

  // Recordings linked to those threads
  const contactRecordingIds = new Set(contactThreads.flatMap(t => t.recording_ids || []));
  const contactRecordings = recordings.filter(r => contactRecordingIds.has(r.id));

  const profile = contact.personality_profile as Record<string, unknown> | null;

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
                {(contact.ai_tags || []).slice(0, 3).map(tag => (
                  <Badge key={tag} variant="outline" className="text-xs">
                    <Tag className="w-2.5 h-2.5 mr-1" />{tag}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 3 Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="plaud" className="gap-1.5 text-xs">
            <Mic className="w-3.5 h-3.5" />
            Plaud
            {contactRecordings.length > 0 && (
              <Badge variant="outline" className="ml-1 h-4 px-1 text-xs">{contactRecordings.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="email" className="gap-1.5 text-xs">
            <Mail className="w-3.5 h-3.5" />
            Email
          </TabsTrigger>
          <TabsTrigger value="whatsapp" className="gap-1.5 text-xs">
            <MessageCircle className="w-3.5 h-3.5" />
            WhatsApp
          </TabsTrigger>
        </TabsList>

        {/* PLAUD */}
        <TabsContent value="plaud" className="mt-3 space-y-3">
          {contactRecordings.length > 0 ? (
            contactRecordings.map(rec => {
              // Find thread for this recording to get speakers
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
                            👤 {n}
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
              <p className="text-xs text-muted-foreground">
                Solo se muestran grabaciones donde {contact.name} habló directamente
              </p>
            </div>
          )}
        </TabsContent>

        {/* EMAIL */}
        <TabsContent value="email" className="mt-3">
          <div className="py-8 text-center space-y-2">
            <Mail className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Sin emails vinculados</p>
            <p className="text-xs text-muted-foreground">La vinculación de emails llegará próximamente</p>
          </div>
        </TabsContent>

        {/* WHATSAPP */}
        <TabsContent value="whatsapp" className="mt-3">
          <div className="py-8 text-center space-y-2">
            <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto" />
            <p className="text-sm text-muted-foreground">Sin WhatsApp vinculado</p>
            <p className="text-xs text-muted-foreground">La vinculación de WhatsApp llegará próximamente</p>
          </div>
        </TabsContent>
      </Tabs>

      {/* AI Profile — only if personality_profile exists */}
      {profile && Object.keys(profile).length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" />
              Perfil IA
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {profile.como_me_habla && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">CÓMO ME HABLA</p>
                <p className="text-xs text-foreground leading-relaxed">{String(profile.como_me_habla)}</p>
              </div>
            )}
            {profile.estilo_comunicacion && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">ESTILO DE COMUNICACIÓN</p>
                <p className="text-xs text-foreground leading-relaxed">{String(profile.estilo_comunicacion)}</p>
              </div>
            )}
            {Array.isArray(profile.oportunidades_negocio) && profile.oportunidades_negocio.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">OPORTUNIDADES</p>
                <ul className="space-y-1">
                  {(profile.oportunidades_negocio as string[]).map((op, i) => (
                    <li key={i} className="text-xs text-foreground flex items-start gap-1.5">
                      <span className="text-primary mt-0.5">→</span>
                      {op}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {profile.estrategia_abordaje && (
              <div>
                <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">ESTRATEGIA DE ABORDAJE</p>
                <p className="text-xs text-foreground leading-relaxed">{String(profile.estrategia_abordaje)}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function StrategicNetwork() {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { user } = useAuth();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [recordings, setRecordings] = useState<PlaudRecording[]>([]);
  const [threads, setThreads] = useState<PlaudThread[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [brainFilter, setBrainFilter] = useState<BrainFilter>('all');

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
        setContacts(contactsRes.data);
        if (contactsRes.data.length > 0 && !selectedContact) {
          setSelectedContact(contactsRes.data[0]);
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

  // Determine which contacts have Plaud recordings (as speakers)
  const contactHasPlaud = (contact: Contact) =>
    threads.some(t => contactIsInThread(contact.name, t));

  const filteredContacts = contacts.filter(c => {
    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.role || '').toLowerCase().includes(search.toLowerCase());
    const matchBrain = brainFilter === 'all' || c.brain === brainFilter;
    return matchSearch && matchBrain;
  });

  const brainCounts = {
    profesional: contacts.filter(c => c.brain === 'profesional').length,
    personal:    contacts.filter(c => c.brain === 'personal').length,
    familiar:    contacts.filter(c => c.brain === 'familiar').length,
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
                  {contacts.length} CONTACTOS · 💼 {brainCounts.profesional} · ❤️ {brainCounts.personal} · 👨‍👩‍👧 {brainCounts.familiar}
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

              {/* Brain filter */}
              <div className="flex gap-1.5 flex-wrap">
                {(['all', 'profesional', 'personal', 'familiar'] as const).map(f => (
                  <Button
                    key={f}
                    variant={brainFilter === f ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setBrainFilter(f)}
                    className="h-7 text-xs"
                  >
                    {f === 'all' ? `Todos (${contacts.length})` :
                     f === 'profesional' ? `💼 ${brainCounts.profesional}` :
                     f === 'personal' ? `❤️ ${brainCounts.personal}` :
                     `👨‍👩‍👧 ${brainCounts.familiar}`}
                  </Button>
                ))}
              </div>

              {/* List */}
              {loading ? (
                <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
              ) : filteredContacts.length > 0 ? (
                <div className="space-y-2 max-h-[calc(100vh-260px)] overflow-y-auto pr-1">
                  {filteredContacts.map(contact => (
                    <ContactItem
                      key={contact.id}
                      contact={contact}
                      selected={selectedContact?.id === contact.id}
                      onClick={() => setSelectedContact(contact)}
                      hasPlaud={contactHasPlaud(contact)}
                    />
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center">
                  <User className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {search ? `Sin resultados para "${search}"` : 'No hay contactos todavía'}
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
      </div>
    </div>
  );
}
