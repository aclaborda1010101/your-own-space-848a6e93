import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { WhatsAppTab, EmailTab, PlaudTab, ProfileKnownData } from '@/components/contacts/ContactTabs';
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
  CheckSquare, ArrowRight, Activity,
  ThermometerSun, BarChart3, CalendarCheck,
  Baby, HeartHandshake, Zap, Pencil, Trash2,
  Network, TrendingDown, Minus, Wallet, Link2,
  UserPlus, X, Check, ExternalLink, ArrowLeft,
} from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';

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
  category?: string | null;
  categories?: string[] | null;
  email?: string | null;
  context?: string | null;
  metadata?: any;
  scores?: any;
  sentiment?: string | null;
}

type CategoryFilter = 'all' | 'profesional' | 'personal' | 'familiar';

const getCategoryColor = (cat: string | null | undefined) => {
  switch (cat) {
    case 'profesional': return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
    case 'personal':    return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    case 'familiar':    return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
    default:            return 'bg-muted/10 text-muted-foreground border-muted/30';
  }
};

const getCategoryIcon = (cat: string | null | undefined) => {
  switch (cat) {
    case 'profesional': return <Briefcase className="w-3 h-3" />;
    case 'personal':    return <Heart className="w-3 h-3" />;
    case 'familiar':    return <Users className="w-3 h-3" />;
    default:            return <User className="w-3 h-3" />;
  }
};

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
          <Badge variant="outline" className={cn("text-xs h-4 px-1 flex-shrink-0", getCategoryColor(contact.category))}>
            {getCategoryIcon(contact.category)}
          </Badge>
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

// ── Insufficient Data Fallback ──────────────────────────────────────────────
const InsufficientData = ({ label }: { label: string }) => (
  <div className="p-3 rounded-lg bg-muted/10 border border-dashed border-border">
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <AlertTriangle className="w-3 h-3" />
      Datos insuficientes — se necesitan más interacciones para analizar: {label}
    </p>
  </div>
);

const getNivelColor = (nivel: string) => {
  switch (nivel) {
    case 'verde': return 'border-green-500/30 bg-green-500/5';
    case 'amarillo': return 'border-yellow-500/30 bg-yellow-500/5';
    case 'rojo': return 'border-red-500/30 bg-red-500/5';
    default: return 'border-border bg-muted/5';
  }
};

const getTendenciaBadge = (tendencia: string) => {
  switch (tendencia) {
    case 'creciente': return 'bg-green-500/10 text-green-400 border-green-500/30';
    case 'declive': return 'bg-red-500/10 text-red-400 border-red-500/30';
    default: return 'bg-muted/10 text-muted-foreground border-border';
  }
};

const getTermometroWidth = (t: string) => {
  switch (t) { case 'frio': return 25; case 'tibio': return 50; case 'calido': return 75; case 'fuerte': return 100; default: return 50; }
};

const getTermometroColor = (t: string) => {
  switch (t) { case 'frio': return 'bg-blue-400'; case 'tibio': return 'bg-yellow-400'; case 'calido': return 'bg-orange-400'; case 'fuerte': return 'bg-red-400'; default: return 'bg-muted'; }
};

// ── Profile By Scope Component ─────────────────────────────────────────────────

interface ContactLink {
  id: string;
  source_contact_id: string;
  target_contact_id: string;
  mentioned_name: string;
  context: string | null;
  first_mention_date: string | null;
  status: string;
}

interface ProfileByScopeProps {
  profile: Record<string, any>;
  ambito: string;
  contactId: string;
  allContacts: Contact[];
  contactLinks: ContactLink[];
  onLinkContact: (sourceId: string, targetId: string, name: string, context: string) => void;
  onIgnoreContact: (sourceId: string, name: string) => void;
}

const ProfileByScope = ({ profile, ambito, contactId, allContacts, contactLinks, onLinkContact, onIgnoreContact }: ProfileByScopeProps) => {
  const [linkingName, setLinkingName] = useState<string | null>(null);
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);

  // Support both multi-scope { profesional: {...}, familiar: {...} } and legacy flat profiles
  const isMultiScope = profile && typeof profile === 'object' && !profile.ambito && (profile.profesional || profile.personal || profile.familiar);
  const p = isMultiScope ? (profile[ambito] || {}) : profile;

  if (!p || Object.keys(p).length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Sin análisis para el ámbito "{ambito}"</p>
        <p className="text-xs text-muted-foreground">Pulsa "Analizar IA" para generar este análisis</p>
      </div>
    );
  }

  // Auto-detect matches between mentioned names and existing contacts
  const findPotentialMatch = (name: string): Contact | null => {
    const nameLower = name.toLowerCase().trim();
    const firstName = nameLower.split(' ')[0];
    return allContacts.find(c => {
      const cName = c.name.toLowerCase();
      const cFirst = cName.split(' ')[0];
      return c.id !== contactId && (cName === nameLower || cFirst === firstName);
    }) || null;
  };

  // Check if a mentioned name is already linked
  const getLinkForName = (name: string): ContactLink | null => {
    return contactLinks.find(l => 
      l.source_contact_id === contactId && 
      l.mentioned_name.toLowerCase() === name.toLowerCase() &&
      l.status !== 'ignored'
    ) || null;
  };

  const isIgnored = (name: string): boolean => {
    return contactLinks.some(l => 
      l.source_contact_id === contactId && 
      l.mentioned_name.toLowerCase() === name.toLowerCase() &&
      l.status === 'ignored'
    );
  };

  // Get mentions of THIS contact by others
  const mentionedByOthers = contactLinks.filter(l => l.target_contact_id === contactId && l.status === 'linked');

  // Distribution summary — read from global level (Problem 2: consistent across scopes)
  const globalDist = profile?._global_distribution;
  const dist = globalDist || p.metricas_comunicacion?.distribucion_ambitos;

  // Historical analysis
  const historical = profile?._historical_analysis;

  return (
    <div className="space-y-3">
      {/* Distribución de ámbitos — mini-resumen */}
      {dist && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/10 border border-border text-xs">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Este contacto:</span>
          <span className="text-blue-400 font-medium">{dist.profesional_pct ?? '?'}% profesional</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-emerald-400 font-medium">{dist.personal_pct ?? '?'}% personal</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-amber-400 font-medium">{dist.familiar_pct ?? '?'}% familiar</span>
        </div>
      )}

      {/* Historical Analysis Section */}
      {historical && historical.resumen_narrativo && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-primary font-mono mb-1 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5" /> HISTORIA DE LA RELACIÓN
            </p>
            <p className="text-sm text-foreground leading-relaxed">{historical.resumen_narrativo}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Primer contacto</p>
                <p className="font-medium text-foreground">{historical.primer_contacto || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Duración</p>
                <p className="font-medium text-foreground">{historical.duracion_relacion || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Msgs totales</p>
                <p className="font-medium text-foreground">{historical.mensajes_totales?.toLocaleString() || '—'}</p>
              </div>
            </div>
            {Array.isArray(historical.evolucion_anual) && historical.evolucion_anual.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Evolución anual:</p>
                <div className="space-y-1">
                  {historical.evolucion_anual.map((ev: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-12">{ev.ano}{ev.periodo ? ` (${ev.periodo})` : ''}</span>
                      <span className="font-medium text-foreground w-16">{ev.mensajes?.toLocaleString()} msgs</span>
                      <span className="text-muted-foreground flex-1 truncate">{ev.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {Array.isArray(historical.hitos) && historical.hitos.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Hitos clave:</p>
                <div className="space-y-1">
                  {historical.hitos.slice(0, 8).map((h: any, i: number) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className="text-primary">📅</span>
                      <span className="text-muted-foreground font-mono flex-shrink-0">{h.fecha}</span>
                      <span className="text-foreground">{h.descripcion}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground/60 italic">
              Actualizado: {historical.last_updated ? new Date(historical.last_updated).toLocaleDateString('es') : '—'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Estado y última interacción */}
      {p.estado_relacion && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <span className="text-2xl">{p.estado_relacion.emoji || '🔵'}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{p.estado_relacion.descripcion || 'Sin descripción'}</p>
                {p.ultima_interaccion && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Último contacto: {p.ultima_interaccion.fecha || '—'} · {p.ultima_interaccion.canal || '—'}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Situación actual */}
      {p.situacion_actual && !String(p.situacion_actual).toLowerCase().includes('insuficiente') ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">SITUACIÓN ACTUAL</p>
            <p className="text-sm text-foreground leading-relaxed">{String(p.situacion_actual)}</p>
          </CardContent>
        </Card>
      ) : <InsufficientData label="situación actual" />}

      {/* Evolución reciente */}
      {p.evolucion_reciente && (
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-1 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5" /> EVOLUCIÓN RECIENTE
            </p>
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hace 1 mes:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hace_1_mes || 'Sin datos'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/60 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hace 1 semana:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hace_1_semana || 'Sin datos'}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hoy:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hoy || 'Sin datos'}</p>
                </div>
              </div>
            </div>
            {p.evolucion_reciente.tendencia_general && (
              <div className="flex items-center gap-2 text-xs pt-1 border-t border-border">
                {p.evolucion_reciente.tendencia_general === 'mejorando' ? <TrendingUp className="w-3.5 h-3.5 text-green-400" /> :
                 p.evolucion_reciente.tendencia_general === 'deteriorandose' ? <TrendingDown className="w-3.5 h-3.5 text-red-400" /> :
                 <Minus className="w-3.5 h-3.5 text-muted-foreground" />}
                <span className="text-muted-foreground">Tendencia:</span>
                <Badge variant="outline" className={cn("text-xs capitalize",
                  p.evolucion_reciente.tendencia_general === 'mejorando' ? 'border-green-500/30 text-green-400' :
                  p.evolucion_reciente.tendencia_general === 'deteriorandose' ? 'border-red-500/30 text-red-400' :
                  'border-border text-muted-foreground'
                )}>{p.evolucion_reciente.tendencia_general}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Datos clave */}
      {Array.isArray(p.datos_clave) && p.datos_clave.length > 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">DATOS CLAVE</p>
            <ul className="space-y-2">
              {p.datos_clave.map((d: any, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <Tag className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <span className="text-foreground">{d.dato}</span>
                    <span className="text-muted-foreground ml-1.5">— {d.fuente}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : <InsufficientData label="datos clave" />}

      {/* Métricas de comunicación — Enhanced with scope segmentation */}
      {p.metricas_comunicacion ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">MÉTRICAS DE COMUNICACIÓN</p>
            {/* Scope-filtered metrics */}
            {p.metricas_comunicacion.mensajes_ambito && (
              <div className="p-2 rounded-lg bg-primary/5 border border-primary/20 mb-2">
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">Mensajes {ambito}es (30d)</span>
                  <span className="font-bold text-foreground">
                    ~{p.metricas_comunicacion.mensajes_ambito.total} de {p.metricas_comunicacion.total_mensajes_30d ?? '—'} totales ({p.metricas_comunicacion.mensajes_ambito.porcentaje}%)
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(p.metricas_comunicacion.mensajes_ambito.porcentaje || 0, 100)}%` }} />
                </div>
                <p className="text-xs text-muted-foreground mt-1">Media semanal ámbito: {p.metricas_comunicacion.mensajes_ambito.media_semanal ?? '—'} msgs</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Total (30d)</p>
                <p className="font-bold text-foreground text-lg">{p.metricas_comunicacion.total_mensajes_30d ?? p.metricas_comunicacion.frecuencia ?? '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Tendencia</p>
                <Badge variant="outline" className={cn("text-xs capitalize", getTendenciaBadge(p.metricas_comunicacion.tendencia))}>
                  {p.metricas_comunicacion.tendencia_pct !== undefined
                    ? `${p.metricas_comunicacion.tendencia_pct > 0 ? '📈 +' : p.metricas_comunicacion.tendencia_pct < 0 ? '📉 ' : '➡️ '}${p.metricas_comunicacion.tendencia_pct}%`
                    : (p.metricas_comunicacion.tendencia || 'estable')}
                </Badge>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Media semanal</p>
                <p className="font-medium text-foreground">{p.metricas_comunicacion.media_semanal_actual ?? '—'} msgs</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Mes anterior</p>
                <p className="font-medium text-foreground">{p.metricas_comunicacion.media_semanal_anterior ?? '—'} msgs</p>
              </div>
            </div>
            {p.metricas_comunicacion.ratio_iniciativa && (
              <div>
                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
                  <span>Yo inicio: {p.metricas_comunicacion.ratio_iniciativa.usuario}%</span>
                  <span>Contacto: {p.metricas_comunicacion.ratio_iniciativa.contacto}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
                  <div className="h-full bg-primary rounded-l-full" style={{ width: `${p.metricas_comunicacion.ratio_iniciativa.usuario}%` }} />
                  <div className="h-full bg-muted-foreground/30 rounded-r-full flex-1" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {p.metricas_comunicacion.dia_mas_activo && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarCheck className="w-3 h-3" />
                  <span>Día: <span className="text-foreground font-medium">{p.metricas_comunicacion.dia_mas_activo}</span></span>
                </div>
              )}
              {p.metricas_comunicacion.horario_habitual && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>Horario: <span className="text-foreground font-medium">{p.metricas_comunicacion.horario_habitual}</span></span>
                </div>
              )}
            </div>
            {p.metricas_comunicacion.canales && (
              <div className="flex gap-1 flex-wrap">
                {p.metricas_comunicacion.canales.map((c: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs capitalize">{c}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ) : <InsufficientData label="métricas de comunicación" />}

      {/* === SCOPE-SPECIFIC SECTIONS === */}

      {/* Profesional: Pipeline */}
      {ambito === 'profesional' && p.pipeline && (
        <Card className="border-blue-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-blue-400 font-mono mb-1 flex items-center gap-1.5">
              <BarChart3 className="w-3.5 h-3.5" /> PIPELINE
            </p>
            {Array.isArray(p.pipeline.oportunidades) && p.pipeline.oportunidades.length > 0 ? (
              <ul className="space-y-1.5">
                {p.pipeline.oportunidades.map((op: any, i: number) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <Zap className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{op.descripcion}</span>
                    <Badge variant="outline" className="text-xs ml-auto capitalize">{op.estado}</Badge>
                  </li>
                ))}
              </ul>
            ) : <p className="text-xs text-muted-foreground">Sin oportunidades activas</p>}
            {p.pipeline.probabilidad_cierre && (
              <div className="flex items-center gap-2 text-xs">
                <Target className="w-3 h-3 text-muted-foreground" />
                <span className="text-muted-foreground">Prob. cierre:</span>
                <Badge variant="outline" className={cn("text-xs capitalize",
                  p.pipeline.probabilidad_cierre === 'alta' ? 'border-green-500/30 text-green-400' :
                  p.pipeline.probabilidad_cierre === 'media' ? 'border-yellow-500/30 text-yellow-400' :
                  'border-red-500/30 text-red-400'
                )}>{p.pipeline.probabilidad_cierre}</Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Personal: Termómetro + Reciprocidad */}
      {ambito === 'personal' && p.termometro_relacion && (
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-400 font-mono mb-1 flex items-center gap-1.5">
              <ThermometerSun className="w-3.5 h-3.5" /> TERMÓMETRO DE RELACIÓN
            </p>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", getTermometroColor(p.termometro_relacion))}
                    style={{ width: `${getTermometroWidth(p.termometro_relacion)}%` }} />
                </div>
              </div>
              <span className="text-sm font-medium text-foreground capitalize">{p.termometro_relacion}</span>
            </div>
          </CardContent>
        </Card>
      )}
      {ambito === 'personal' && p.reciprocidad && (
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-400 font-mono mb-1 flex items-center gap-1.5">
              <HeartHandshake className="w-3.5 h-3.5" /> RECIPROCIDAD
            </p>
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Yo: {p.reciprocidad.usuario_inicia}%</span>
              <span>Contacto: {p.reciprocidad.contacto_inicia}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
              <div className="h-full bg-emerald-400 rounded-l-full" style={{ width: `${p.reciprocidad.usuario_inicia}%` }} />
              <div className="h-full bg-muted-foreground/30 rounded-r-full flex-1" />
            </div>
            <p className="text-xs text-muted-foreground capitalize">{p.reciprocidad.evaluacion}</p>
          </CardContent>
        </Card>
      )}

      {/* Personal: Gestiones Compartidas */}
      {ambito === 'personal' && Array.isArray(p.gestiones_compartidas) && p.gestiones_compartidas.length > 0 && (
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-emerald-400 font-mono mb-1 flex items-center gap-1.5">
              <Wallet className="w-3.5 h-3.5" /> GESTIONES COMPARTIDAS
            </p>
            <ul className="space-y-2">
              {p.gestiones_compartidas.map((g: any, i: number) => (
                <li key={i} className="text-xs p-2 rounded-lg bg-muted/10 border border-border">
                  <p className="font-medium text-foreground">{g.descripcion}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-muted-foreground">
                    {g.monto && <span className="font-medium text-foreground">{g.monto}</span>}
                    {g.origen && <span>· {g.origen}</span>}
                    {g.estado && (
                      <Badge variant="outline" className={cn("text-xs capitalize",
                        g.estado === 'activo' ? 'border-green-500/30 text-green-400' :
                        g.estado === 'pendiente' ? 'border-yellow-500/30 text-yellow-400' :
                        'border-muted/30 text-muted-foreground'
                      )}>{g.estado}</Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Personal: Dinámica de la Relación */}
      {ambito === 'personal' && p.dinamica_relacion && (
        <Card className="border-emerald-500/20 bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-emerald-400 font-mono mb-1 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" /> DINÁMICA DE LA RELACIÓN
            </p>
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tono predominante:</span>
                <span className="font-medium text-foreground capitalize">{p.dinamica_relacion.tono || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Uso de humor:</span>
                <span className="font-medium text-foreground capitalize">{p.dinamica_relacion.uso_humor || '—'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confianza percibida:</span>
                <Badge variant="outline" className={cn("text-xs capitalize",
                  p.dinamica_relacion.confianza_percibida === 'alta' ? 'border-green-500/30 text-green-400' :
                  p.dinamica_relacion.confianza_percibida === 'media' ? 'border-yellow-500/30 text-yellow-400' :
                  'border-red-500/30 text-red-400'
                )}>{p.dinamica_relacion.confianza_percibida || '—'}</Badge>
              </div>
              {p.dinamica_relacion.evidencia_confianza && (
                <p className="text-muted-foreground italic border-l-2 border-emerald-500/30 pl-2 mt-1">
                  "{p.dinamica_relacion.evidencia_confianza}"
                </p>
              )}
              {Array.isArray(p.dinamica_relacion.temas_no_laborales) && p.dinamica_relacion.temas_no_laborales.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Temas no laborales: </span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.dinamica_relacion.temas_no_laborales.map((t: string, i: number) => (
                      <Badge key={i} variant="outline" className="text-xs border-emerald-500/20">{t}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {p.dinamica_relacion.ultima_conversacion_personal && (
                <div className="pt-1 border-t border-border">
                  <span className="text-muted-foreground">Última conversación personal: </span>
                  <span className="text-foreground font-medium">{p.dinamica_relacion.ultima_conversacion_personal.fecha || '—'}</span>
                  {p.dinamica_relacion.ultima_conversacion_personal.tema && (
                    <span className="text-muted-foreground"> — {p.dinamica_relacion.ultima_conversacion_personal.tema}</span>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
      {ambito === 'familiar' && p.bienestar && (
        <Card className="border-amber-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-400 font-mono mb-1 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5" /> BIENESTAR
            </p>
            <p className="text-sm text-foreground">{p.bienestar.estado_emocional}</p>
            {Array.isArray(p.bienestar.necesidades) && p.bienestar.necesidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {p.bienestar.necesidades.map((n: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs border-amber-500/30 text-amber-400">{n}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
      {ambito === 'familiar' && Array.isArray(p.coordinacion) && p.coordinacion.length > 0 && (
        <Card className="border-amber-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-400 font-mono mb-1 flex items-center gap-1.5">
              <CalendarCheck className="w-3.5 h-3.5" /> COORDINACIÓN FAMILIAR
            </p>
            <ul className="space-y-1.5">
              {p.coordinacion.map((c: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckSquare className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{c.tarea}</span>
                  <span className="text-muted-foreground ml-auto">→ {c.responsable}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
      {ambito === 'familiar' && p.desarrollo_bosco && (
        <Card className="border-amber-500/20 bg-card">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs font-semibold text-amber-400 font-mono mb-1 flex items-center gap-1.5">
              <Baby className="w-3.5 h-3.5" /> DESARROLLO BOSCO
            </p>
            {Array.isArray(p.desarrollo_bosco.hitos) && p.desarrollo_bosco.hitos.length > 0 && (
              <ul className="space-y-1.5">
                {p.desarrollo_bosco.hitos.map((h: any, i: number) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <Star className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{h.hito}</span>
                    <span className="text-muted-foreground ml-auto">{h.fecha}</span>
                  </li>
                ))}
              </ul>
            )}
            {Array.isArray(p.desarrollo_bosco.patrones_emocionales) && p.desarrollo_bosco.patrones_emocionales.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {p.desarrollo_bosco.patrones_emocionales.map((pe: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs">{pe}</Badge>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Patrones detectados */}
      {Array.isArray(p.patrones_detectados) && p.patrones_detectados.length > 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">PATRONES DETECTADOS</p>
            <div className="space-y-2">
              {p.patrones_detectados.map((pat: any, i: number) => (
                <div key={i} className={cn("p-2 rounded-lg border text-xs", getNivelColor(pat.nivel))}>
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-0.5">
                    <span>{pat.emoji}</span><span>{pat.patron}</span>
                  </div>
                  <p className="text-muted-foreground">{pat.evidencia}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : <InsufficientData label="patrones" />}

      {/* Alertas — with [CONTACTO] / [OBSERVACIÓN] labels */}
      {Array.isArray(p.alertas) && p.alertas.length > 0 && (
        <Card className={cn("border-border bg-card", p.alertas.some((a: any) => a.nivel === 'rojo') ? 'border-red-500/30' : 'border-yellow-500/30')}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-red-400 font-mono mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> ALERTAS
            </p>
            <ul className="space-y-2">
              {p.alertas.map((a: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span>{a.nivel === 'rojo' ? '🔴' : '🟡'}</span>
                  <div className="flex-1">
                    {a.tipo && (
                      <Badge variant="outline" className={cn("text-xs mr-1.5 mb-0.5",
                        a.tipo === 'contacto'
                          ? 'border-blue-500/30 text-blue-400 bg-blue-500/5'
                          : 'border-amber-500/30 text-amber-400 bg-amber-500/5'
                      )}>
                        {a.tipo === 'contacto' ? 'CONTACTO' : 'OBSERVACIÓN'}
                      </Badge>
                    )}
                    <span className="text-foreground">{a.texto}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Red de contactos mencionados — with linking UI */}
      {Array.isArray(p.red_contactos_mencionados) && p.red_contactos_mencionados.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
              <Network className="w-3.5 h-3.5" /> RED DE CONTACTOS MENCIONADOS
            </p>
            <ul className="space-y-2">
              {p.red_contactos_mencionados.map((c: any, i: number) => {
                const existingLink = getLinkForName(c.nombre);
                const ignored = isIgnored(c.nombre);
                const potentialMatch = findPotentialMatch(c.nombre);
                const linkedContact = existingLink 
                  ? allContacts.find(ct => ct.id === existingLink.target_contact_id) 
                  : null;

                if (ignored) return null;

                return (
                  <li key={i} className="text-xs p-2 rounded-lg bg-muted/10 border border-border">
                    <div className="flex items-start gap-2">
                      {existingLink ? (
                        <Link2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                      ) : c.relacion === 'no_determinada' ? (
                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-400 mt-0.5 flex-shrink-0" />
                      ) : potentialMatch ? (
                        <Link2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{c.nombre}</span>
                          {existingLink ? (
                            <Badge variant="outline" className="text-xs border-green-500/30 text-green-400 bg-green-500/5">
                              🔗 Vinculado{linkedContact ? `: ${linkedContact.name}` : ''}
                            </Badge>
                          ) : c.relacion === 'no_determinada' ? (
                            <Badge variant="outline" className="text-xs border-yellow-500/30 text-yellow-400 bg-yellow-500/5">⚠️ Relación no determinada</Badge>
                          ) : potentialMatch ? (
                            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/5">🔗 Posible match</Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">{c.relacion}</Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5">{c.contexto}</p>
                        {c.fecha_mencion && (
                          <p className="text-muted-foreground/70 mt-0.5">Mencionado: {c.fecha_mencion}</p>
                        )}

                        {/* Linking actions */}
                        {existingLink && linkedContact ? (
                          <div className="mt-1.5">
                            <Button variant="ghost" size="sm" className="h-6 text-xs text-green-400 hover:text-green-300 px-2"
                              onClick={() => {
                                // scroll to that contact — handled by parent
                              }}>
                              <ExternalLink className="w-3 h-3 mr-1" /> Ver perfil
                            </Button>
                          </div>
                        ) : potentialMatch && !existingLink ? (
                          <div className="mt-1.5 flex gap-1.5 flex-wrap">
                            <Button variant="outline" size="sm" className="h-6 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() => onLinkContact(contactId, potentialMatch.id, c.nombre, c.contexto || '')}>
                              <Check className="w-3 h-3 mr-1" /> Vincular con {potentialMatch.name}
                            </Button>
                            <Popover open={linkingName === c.nombre && linkSearchOpen} onOpenChange={(open) => {
                              setLinkSearchOpen(open);
                              if (!open) setLinkingName(null);
                            }}>
                              <PopoverTrigger asChild>
                                <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground"
                                  onClick={() => { setLinkingName(c.nombre); setLinkSearchOpen(true); }}>
                                  No es esta persona
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-64" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar contacto..." className="h-9" />
                                  <CommandList>
                                    <CommandEmpty>No encontrado</CommandEmpty>
                                    <CommandGroup>
                                      {allContacts.filter(ct => ct.id !== contactId).map(ct => (
                                        <CommandItem key={ct.id} onSelect={() => {
                                          onLinkContact(contactId, ct.id, c.nombre, c.contexto || '');
                                          setLinkSearchOpen(false);
                                          setLinkingName(null);
                                        }}>
                                          <User className="w-3 h-3 mr-2" />
                                          <span>{ct.name}</span>
                                          {ct.category && (
                                            <Badge variant="outline" className={cn("ml-auto text-xs", getCategoryColor(ct.category))}>{ct.category}</Badge>
                                          )}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                          </div>
                        ) : !existingLink ? (
                          <div className="mt-1.5 flex gap-1.5 flex-wrap">
                            <Popover open={linkingName === c.nombre && linkSearchOpen} onOpenChange={(open) => {
                              setLinkSearchOpen(open);
                              if (!open) setLinkingName(null);
                            }}>
                              <PopoverTrigger asChild>
                                <Button variant="outline" size="sm" className="h-6 text-xs px-2"
                                  onClick={() => { setLinkingName(c.nombre); setLinkSearchOpen(true); }}>
                                  <Link2 className="w-3 h-3 mr-1" /> Vincular
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-64" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar contacto..." className="h-9" />
                                  <CommandList>
                                    <CommandEmpty>No encontrado</CommandEmpty>
                                    <CommandGroup>
                                      {allContacts.filter(ct => ct.id !== contactId).map(ct => (
                                        <CommandItem key={ct.id} onSelect={() => {
                                          onLinkContact(contactId, ct.id, c.nombre, c.contexto || '');
                                          setLinkSearchOpen(false);
                                          setLinkingName(null);
                                        }}>
                                          <User className="w-3 h-3 mr-2" />
                                          <span>{ct.name}</span>
                                          {ct.category && (
                                            <Badge variant="outline" className={cn("ml-auto text-xs", getCategoryColor(ct.category))}>{ct.category}</Badge>
                                          )}
                                        </CommandItem>
                                      ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-muted-foreground"
                              onClick={() => onIgnoreContact(contactId, c.nombre)}>
                              <X className="w-3 h-3 mr-1" /> Ignorar
                            </Button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Mencionado por otros contactos */}
      {mentionedByOthers.length > 0 && (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5" /> MENCIONADO POR OTROS CONTACTOS
            </p>
            <ul className="space-y-1.5">
              {mentionedByOthers.map((link, i) => {
                const sourceContact = allContacts.find(c => c.id === link.source_contact_id);
                return (
                  <li key={i} className="text-xs flex items-start gap-2 p-2 rounded-lg bg-muted/10 border border-border">
                    <MessageCircle className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{sourceContact?.name || 'Contacto'}</span>
                      {link.first_mention_date && <span className="text-muted-foreground"> ({link.first_mention_date})</span>}
                      {link.context && <span className="text-muted-foreground">: {link.context}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Acciones pendientes */}
      {Array.isArray(p.acciones_pendientes) && p.acciones_pendientes.length > 0 ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">ACCIONES PENDIENTES</p>
            <ul className="space-y-2">
              {p.acciones_pendientes.map((a: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckSquare className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{a.accion}</p>
                    <p className="text-muted-foreground">Origen: {a.origen} · Sugerido: {a.fecha_sugerida}</p>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : <InsufficientData label="acciones pendientes" />}

      {/* Próxima acción recomendada */}
      {p.proxima_accion && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-primary font-mono mb-2 flex items-center gap-1.5">
              <ArrowRight className="w-3.5 h-3.5" /> PRÓXIMA ACCIÓN RECOMENDADA
            </p>
            <div className="space-y-1 text-sm">
              <p className="font-medium text-foreground">{p.proxima_accion.que}</p>
              <div className="flex flex-wrap gap-2 text-xs">
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30">
                  {p.proxima_accion.canal === 'whatsapp' ? <MessageCircle className="w-3 h-3" /> :
                   p.proxima_accion.canal === 'email' ? <Mail className="w-3 h-3" /> :
                   p.proxima_accion.canal === 'llamada' ? <Phone className="w-3 h-3" /> :
                   <Globe className="w-3 h-3" />}
                  <span className="capitalize">{p.proxima_accion.canal}</span>
                </div>
                <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-muted/30">
                  <Clock className="w-3 h-3" />
                  <span>{p.proxima_accion.cuando}</span>
                </div>
              </div>
              {p.proxima_accion.pretexto && (
                <p className="text-xs text-muted-foreground mt-1">💡 Pretexto: {p.proxima_accion.pretexto}</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

// ── Contact Detail Panel ───────────────────────────────────────────────────────

interface ContactDetailProps {
  contact: Contact;
  threads: PlaudThread[];
  recordings: PlaudRecording[];
  allContacts: Contact[];
  onEdit: (contact: Contact) => void;
  onDelete: (contact: Contact) => void;
  analyzingContactId: string | null;
  onStartAnalysis: (contactId: string, scopes: string[]) => void;
}

const ContactDetail = ({ contact, threads, recordings, allContacts, onEdit, onDelete, analyzingContactId, onStartAnalysis }: ContactDetailProps) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('profile');
  const analyzing = analyzingContactId === contact.id;
  const [contactLinks, setContactLinks] = useState<ContactLink[]>([]);
  const [contactCategories, setContactCategories] = useState<string[]>(
    contact.categories && Array.isArray(contact.categories) && contact.categories.length > 0
      ? contact.categories
      : [contact.category || 'profesional']
  );
  const [activeScope, setActiveScope] = useState(contactCategories[0] || 'profesional');

  // Fetch contact_links for this contact (as source OR target)
  useEffect(() => {
    if (!user) return;
    const fetchLinks = async () => {
      const { data } = await (supabase as any)
        .from('contact_links')
        .select('*')
        .eq('user_id', user.id)
        .or(`source_contact_id.eq.${contact.id},target_contact_id.eq.${contact.id}`);
      setContactLinks(data || []);
    };
    fetchLinks();
  }, [contact.id, user]);

  // Sync when contact changes
  useEffect(() => {
    const cats = contact.categories && Array.isArray(contact.categories) && contact.categories.length > 0
      ? contact.categories
      : [contact.category || 'profesional'];
    setContactCategories(cats);
    setActiveScope(cats[0] || 'profesional');
  }, [contact.id]);

  const handleLinkContact = async (sourceId: string, targetId: string, name: string, context: string) => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any).from('contact_links').insert({
        user_id: user.id,
        source_contact_id: sourceId,
        target_contact_id: targetId,
        mentioned_name: name,
        context: context || null,
        status: 'linked',
      }).select().single();
      if (error) throw error;
      setContactLinks(prev => [...prev, data]);
      toast.success(`${name} vinculado correctamente`);
    } catch (err) {
      console.error('Link error:', err);
      toast.error('Error al vincular contacto');
    }
  };

  const handleIgnoreContact = async (sourceId: string, name: string) => {
    if (!user) return;
    try {
      const { data, error } = await (supabase as any).from('contact_links').insert({
        user_id: user.id,
        source_contact_id: sourceId,
        target_contact_id: sourceId, // self-ref for ignored
        mentioned_name: name,
        status: 'ignored',
      }).select().single();
      if (error) throw error;
      setContactLinks(prev => [...prev, data]);
      toast.success(`${name} ignorado`);
    } catch (err) {
      toast.error('Error al ignorar contacto');
    }
  };

  const toggleScope = async (cat: string) => {
    let newCats: string[];
    if (contactCategories.includes(cat)) {
      // Don't allow removing the last one
      if (contactCategories.length <= 1) return;
      newCats = contactCategories.filter(c => c !== cat);
    } else {
      newCats = [...contactCategories, cat];
    }
    setContactCategories(newCats);
    if (!newCats.includes(activeScope)) setActiveScope(newCats[0]);
    try {
      await (supabase as any).from('people_contacts').update({ categories: newCats, category: newCats[0] }).eq('id', contact.id);
      contact.categories = newCats;
      contact.category = newCats[0];
      toast.success(`Ámbitos: ${newCats.join(', ')}`);
    } catch { toast.error('Error al actualizar categorías'); }
  };

  const contactThreads = threads.filter(t => contactIsInThread(contact.name, t));
  const contactRecordingIds = new Set(contactThreads.flatMap(t => t.recording_ids || []));
  const contactRecordings = recordings.filter(r => contactRecordingIds.has(r.id));

  const profile = contact.personality_profile as Record<string, any> | null;
  const isMultiScope = profile && typeof profile === 'object' && !profile.ambito && (profile.profesional || profile.personal || profile.familiar);
  const hasProfile = profile && Object.keys(profile).length > 0 && (profile.sinopsis || profile.ambito || profile.estado_relacion || isMultiScope);

  const handleAnalyze = () => {
    onStartAnalysis(contact.id, contactCategories);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="border-border bg-card">
        <CardContent className="p-4 lg:p-5">
          <div className="space-y-3">
            {/* Row 1: Avatar + Name + Buttons (desktop only) */}
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-12 h-12 lg:w-16 lg:h-16 rounded-2xl flex items-center justify-center text-xl lg:text-2xl font-bold border-2 flex-shrink-0",
                getBrainColor(contact.brain)
              )}>
                {getInitial(contact.name)}
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg lg:text-xl font-bold text-foreground truncate">{contact.name}</h2>
                {contact.role && <p className="text-sm text-muted-foreground truncate">{contact.role}</p>}
                {contact.company && <p className="text-xs text-muted-foreground mt-0.5 truncate">{contact.company}</p>}
              </div>
              {/* Buttons - desktop only */}
              <div className="hidden lg:flex gap-2 flex-shrink-0">
                <Button size="sm" variant="outline" onClick={() => onEdit(contact)}>
                  <Pencil className="w-4 h-4" />
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="text-destructive hover:text-destructive">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
                      <AlertDialogDescription>
                        ¿Seguro que quieres eliminar a <strong>{contact.name}</strong>? Se borrarán también todos sus mensajes. Esta acción no se puede deshacer.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onDelete(contact)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Eliminar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <Button size="sm" onClick={handleAnalyze} disabled={analyzing}>
                  {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                  {analyzing ? 'Analizando...' : 'Analizar IA'}
                </Button>
              </div>
            </div>

            {/* Row 2: Buttons - mobile only */}
            <div className="grid grid-cols-3 lg:hidden gap-2">
              <Button size="sm" variant="outline" onClick={() => onEdit(contact)} className="flex-1">
                <Pencil className="w-4 h-4 mr-1.5" /> Editar
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button size="sm" variant="outline" className="text-destructive hover:text-destructive flex-1">
                    <Trash2 className="w-4 h-4 mr-1.5" /> Eliminar
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Eliminar contacto</AlertDialogTitle>
                    <AlertDialogDescription>
                      ¿Seguro que quieres eliminar a <strong>{contact.name}</strong>? Se borrarán también todos sus mensajes. Esta acción no se puede deshacer.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={() => onDelete(contact)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                      Eliminar
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
              <Button size="sm" onClick={handleAnalyze} disabled={analyzing} className="flex-1">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <Sparkles className="w-4 h-4 mr-1.5" />}
                {analyzing ? 'Analizando...' : 'IA'}
              </Button>
            </div>

            {/* Row 3: Category toggles (compact pills) */}
            <div className="flex flex-wrap gap-1">
              {['profesional', 'personal', 'familiar'].map(cat => (
                <button
                  key={cat}
                  onClick={() => toggleScope(cat)}
                  className={cn(
                    "text-xs px-1.5 py-0.5 rounded-full border flex items-center gap-1 transition-all whitespace-nowrap",
                    contactCategories.includes(cat)
                      ? getCategoryColor(cat) + " font-medium"
                      : "border-border text-muted-foreground hover:border-muted-foreground/50"
                  )}
                >
                  {getCategoryIcon(cat)}
                  <span className="capitalize">{cat}</span>
                </button>
              ))}
            </div>

            {/* Row 4: Scope selector (dropdown) */}
            {contactCategories.length > 1 && (
              <Select value={activeScope} onValueChange={(val) => setActiveScope(val)}>
                <SelectTrigger className="h-7 text-xs">
                  <SelectValue placeholder="Ámbito" />
                </SelectTrigger>
                <SelectContent>
                  {contactCategories.map(cat => (
                    <SelectItem key={cat} value={cat} className="text-xs capitalize">
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Row 5: Badges */}
            <div className="flex flex-wrap gap-1.5">
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

        {/* Profile Tab - Intelligence by Scope */}
        <TabsContent value="profile" className="mt-3 space-y-3">
          <ProfileKnownData contact={contact} />
          {hasProfile ? (
            <ProfileByScope profile={profile} ambito={activeScope} contactId={contact.id} allContacts={allContacts} contactLinks={contactLinks} onLinkContact={handleLinkContact} onIgnoreContact={handleIgnoreContact} />
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
          <PlaudTab contact={contact} contactRecordings={contactRecordings} contactThreads={contactThreads} />
        </TabsContent>

        <TabsContent value="email" className="mt-3">
          <EmailTab contact={contact} />
        </TabsContent>

        <TabsContent value="whatsapp" className="mt-3">
          <WhatsAppTab contact={contact} />
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
  const [viewFilter, setViewFilter] = useState<ViewFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [deduplicating, setDeduplicating] = useState(false);
  const [analyzingContactId, setAnalyzingContactId] = useState<string | null>(null);
  const analysisPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Background analysis: fire edge function + poll DB for completion
  const startAnalysis = useCallback(async (contactId: string, scopes: string[]) => {
    setAnalyzingContactId(contactId);
    toast.info('Análisis en segundo plano iniciado. Puedes navegar libremente.');

    // Fire the edge function (don't await completion in UI)
    supabase.functions.invoke('contact-analysis', {
      body: { contact_id: contactId, scopes },
    }).then(({ data, error }) => {
      if (error) {
        console.error('Analysis error:', error);
        toast.error('Error en el análisis del contacto');
        setAnalyzingContactId(null);
        return;
      }
      // Edge function finished — refresh the contact from DB
      refreshContactAfterAnalysis(contactId);
    }).catch((err) => {
      console.error('Analysis error:', err);
      toast.error('Error en el análisis del contacto');
      setAnalyzingContactId(null);
    });
  }, []);

  const refreshContactAfterAnalysis = useCallback(async (contactId: string) => {
    try {
      const { data } = await supabase
        .from('people_contacts')
        .select('*')
        .eq('id', contactId)
        .single();
      if (data) {
        setContacts(prev => prev.map(c => c.id === contactId ? data : c));
        setSelectedContact(prev => prev?.id === contactId ? data : prev);
        toast.success('Análisis completado');
      }
    } catch (err) {
      console.error('Error refreshing contact:', err);
    } finally {
      setAnalyzingContactId(null);
    }
  }, []);

  // ── Edit contact state ────────────────────────────────────────────────────
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => { fetchData(); }, []);

  const handleEditContact = (contact: Contact) => {
    setEditContact(contact);
    setEditName(contact.name);
    setEditRole(contact.role || '');
    setEditCompany(contact.company || '');
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editContact || !editName.trim()) return;
    setEditSaving(true);
    try {
      await (supabase as any).from('people_contacts').update({
        name: editName.trim(),
        role: editRole.trim() || null,
        company: editCompany.trim() || null,
      }).eq('id', editContact.id);

      setContacts(prev => prev.map(c => c.id === editContact.id
        ? { ...c, name: editName.trim(), role: editRole.trim() || null, company: editCompany.trim() || null }
        : c
      ));
      if (selectedContact?.id === editContact.id) {
        setSelectedContact({ ...selectedContact, name: editName.trim(), role: editRole.trim() || null, company: editCompany.trim() || null });
      }
      setEditDialogOpen(false);
      toast.success('Contacto actualizado');
    } catch {
      toast.error('Error al actualizar contacto');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDeleteContact = async (contact: Contact) => {
    try {
      // Delete messages first (FK constraint)
      await (supabase as any).from('contact_messages').delete().eq('contact_id', contact.id);
      await (supabase as any).from('people_contacts').delete().eq('id', contact.id);
      setContacts(prev => prev.filter(c => c.id !== contact.id));
      if (selectedContact?.id === contact.id) {
        setSelectedContact(null);
      }
      toast.success(`"${contact.name}" eliminado`);
    } catch {
      toast.error('Error al eliminar contacto');
    }
  };


  const fetchAllContacts = async () => {
    const pageSize = 1000;
    let allData: any[] = [];
    let from = 0;
    let done = false;
    while (!done) {
      const { data, error } = await supabase
        .from('people_contacts')
        .select('*')
        .order('name')
        .range(from, from + pageSize - 1);
      if (error) throw error;
      if (data) allData = allData.concat(data);
      if (!data || data.length < pageSize) done = true;
      from += pageSize;
    }
    return { data: allData, error: null };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const [contactsRes, recordingsRes, threadsRes] = await Promise.all([
        fetchAllContacts(),
        supabase.from('plaud_recordings').select('id,title,received_at,agent_type,summary,audio_url').limit(200),
        supabase.from('plaud_threads').select('id,event_title,event_date,recording_ids,speakers,agent_type').order('event_date', { ascending: false }).limit(100),
      ]);

      if (contactsRes.data) {
        // Sort by wa_message_count desc by default
        const sorted = [...contactsRes.data].sort((a: any, b: any) => (b.wa_message_count || 0) - (a.wa_message_count || 0));
        setContacts(sorted);
        // Don't auto-select here; let the filtered list determine the selection
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
    // Solo mostrar contactos con alguna vinculación (WhatsApp o Plaud)
    const hasWhatsApp = (c.wa_message_count || 0) > 0;
    const hasPlaud = contactHasPlaud(c);
    if (!hasWhatsApp && !hasPlaud) return false;

    const matchSearch = !search || c.name.toLowerCase().includes(search.toLowerCase()) ||
      (c.role || '').toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;

    // Category filter
    if (!search && categoryFilter !== 'all' && (c.category || 'profesional') !== categoryFilter) return false;

    switch (viewFilter) {
      case 'favorites':
        return c.is_favorite === true;
      case 'top100':
        return true;
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

  // ── Deduplication ────────────────────────────────────────────────────────────
  const handleDeduplicateContacts = async () => {
    if (!user) return;
    setDeduplicating(true);
    try {
      // Group contacts by normalized name
      const nameGroups = new Map<string, Contact[]>();
      for (const c of contacts) {
        const key = c.name.toLowerCase().trim().replace(/\s+/g, ' ');
        if (!nameGroups.has(key)) nameGroups.set(key, []);
        nameGroups.get(key)!.push(c);
      }

      let totalMerged = 0;
      let totalDeleted = 0;

      for (const [, group] of nameGroups) {
        if (group.length <= 1) continue;

        // Pick winner: highest wa_message_count, then has personality_profile, then is_favorite
        const sorted = [...group].sort((a, b) => {
          const aScore = (a.wa_message_count || 0) * 1000 + (a.personality_profile ? 100 : 0) + (a.is_favorite ? 10 : 0);
          const bScore = (b.wa_message_count || 0) * 1000 + (b.personality_profile ? 100 : 0) + (b.is_favorite ? 10 : 0);
          return bScore - aScore;
        });

        const winner = sorted[0];
        const losers = sorted.slice(1);
        const loserIds = losers.map(l => l.id);

        // Reassign contact_messages from losers to winner
        for (const loserId of loserIds) {
          await (supabase as any)
            .from('contact_messages')
            .update({ contact_id: winner.id })
            .eq('contact_id', loserId);
        }

        // Recalculate wa_message_count from actual messages
        const { count } = await (supabase as any)
          .from('contact_messages')
          .select('id', { count: 'exact', head: true })
          .eq('contact_id', winner.id);

        // Merge metadata: preserve is_favorite, category, personality_profile from best source
        const bestProfile = sorted.find(c => c.personality_profile && Object.keys(c.personality_profile).length > 0);
        const bestFavorite = sorted.some(c => c.is_favorite);
        const bestCategory = sorted.find(c => c.category)?.category;

        await (supabase as any)
          .from('people_contacts')
          .update({
            wa_message_count: count || 0,
            is_favorite: bestFavorite || winner.is_favorite,
            category: winner.category || bestCategory,
            personality_profile: winner.personality_profile || bestProfile?.personality_profile || null,
          })
          .eq('id', winner.id);

        // Delete losers
        for (const loserId of loserIds) {
          await (supabase as any)
            .from('people_contacts')
            .delete()
            .eq('id', loserId);
        }

        totalMerged++;
        totalDeleted += loserIds.length;
      }

      if (totalMerged > 0) {
        toast.success(`Deduplicación: ${totalMerged} nombres fusionados, ${totalDeleted} duplicados eliminados`);
        await fetchData();
      } else {
        toast.info('No se encontraron duplicados');
      }
    } catch (err) {
      console.error('Dedup error:', err);
      toast.error('Error durante la deduplicación');
    } finally {
      setDeduplicating(false);
    }
  };

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
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleDeduplicateContacts} disabled={deduplicating || loading}>
                {deduplicating ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <Zap className="w-4 h-4 mr-1" />}
                {deduplicating ? 'Limpiando...' : 'Limpiar duplicados'}
              </Button>
              <Button variant="outline" size="icon" onClick={fetchData} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {/* 2-column layout */}
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-4 overflow-hidden">
            {/* ── LEFT: Contact list ──────────────────────────────────────── */}
            <div className={cn("space-y-3", selectedContact && "hidden lg:block")}>
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

              {/* Filters row */}
              <div className="flex gap-2">
                <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v as CategoryFilter)}>
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue placeholder="Categoría" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="all"><span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Todos</span></SelectItem>
                    <SelectItem value="profesional"><span className="flex items-center gap-1.5"><Briefcase className="w-3 h-3" /> Profesional</span></SelectItem>
                    <SelectItem value="personal"><span className="flex items-center gap-1.5"><Heart className="w-3 h-3" /> Personal</span></SelectItem>
                    <SelectItem value="familiar"><span className="flex items-center gap-1.5"><Users className="w-3 h-3" /> Familiar</span></SelectItem>
                  </SelectContent>
                </Select>

                <Select value={viewFilter} onValueChange={(v) => setViewFilter(v as ViewFilter)}>
                  <SelectTrigger className="h-9 text-xs flex-1">
                    <SelectValue placeholder="Vista" />
                  </SelectTrigger>
                  <SelectContent className="bg-popover z-50">
                    <SelectItem value="active"><span className="flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> Activos</span></SelectItem>
                    <SelectItem value="top100"><span className="flex items-center gap-1.5"><Trophy className="w-3 h-3" /> Top 100</span></SelectItem>
                    <SelectItem value="favorites"><span className="flex items-center gap-1.5"><Star className="w-3 h-3" /> Favoritos</span></SelectItem>
                    <SelectItem value="all"><span className="flex items-center gap-1.5"><Eye className="w-3 h-3" /> Todos</span></SelectItem>
                  </SelectContent>
                </Select>
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
            <div className={cn("min-w-0", !selectedContact && "hidden lg:block")}>
              {selectedContact ? (
                <div className="overflow-y-auto max-h-[calc(100vh-120px)]">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedContact(null)}
                    className="mb-2 lg:hidden"
                  >
                    <ArrowLeft className="w-4 h-4 mr-1" /> Volver a contactos
                  </Button>
                  <ContactDetail
                    contact={selectedContact}
                    threads={threads}
                    recordings={recordings}
                    allContacts={contacts}
                    onEdit={handleEditContact}
                    onDelete={handleDeleteContact}
                    analyzingContactId={analyzingContactId}
                    onStartAnalysis={startAnalysis}
                  />
                </div>
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

      {/* Edit Contact Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar contacto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Nombre</Label>
              <Input id="edit-name" value={editName} onChange={e => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-role">Rol</Label>
              <Input id="edit-role" value={editRole} onChange={e => setEditRole(e.target.value)} placeholder="Ej: CEO, Amigo, Hermano..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-company">Empresa</Label>
              <Input id="edit-company" value={editCompany} onChange={e => setEditCompany(e.target.value)} placeholder="Ej: Google, Freelance..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveEdit} disabled={editSaving || !editName.trim()}>
              {editSaving ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : null}
              Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
