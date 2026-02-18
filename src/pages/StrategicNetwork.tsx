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
  CheckSquare, ArrowRight, Activity,
  ThermometerSun, BarChart3, CalendarCheck,
  Baby, HeartHandshake, Zap,
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
  category?: string | null;
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

const ProfileByScope = ({ profile, ambito }: { profile: Record<string, any>; ambito: string }) => {
  const p = profile;
  return (
    <div className="space-y-3">
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

      {/* Métricas de comunicación */}
      {p.metricas_comunicacion ? (
        <Card className="border-border bg-card">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground font-mono mb-1">MÉTRICAS DE COMUNICACIÓN</p>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Frecuencia</p>
                <p className="font-medium text-foreground">{p.metricas_comunicacion.frecuencia || '—'}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Tendencia</p>
                <Badge variant="outline" className={cn("text-xs capitalize", getTendenciaBadge(p.metricas_comunicacion.tendencia))}>
                  {p.metricas_comunicacion.tendencia || 'estable'}
                </Badge>
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

      {/* Familiar: Bienestar + Coordinación + Bosco */}
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

      {/* Alertas */}
      {Array.isArray(p.alertas) && p.alertas.length > 0 && (
        <Card className={cn("border-border bg-card", p.alertas.some((a: any) => a.nivel === 'rojo') ? 'border-red-500/30' : 'border-yellow-500/30')}>
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-red-400 font-mono mb-2 flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> ALERTAS
            </p>
            <ul className="space-y-1.5">
              {p.alertas.map((a: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span>{a.nivel === 'rojo' ? '🔴' : '🟡'}</span>
                  <span className="text-foreground">{a.texto}</span>
                </li>
              ))}
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
}

const ContactDetail = ({ contact, threads, recordings }: ContactDetailProps) => {
  const [activeTab, setActiveTab] = useState('profile');
  const [analyzing, setAnalyzing] = useState(false);
  const [currentCategory, setCurrentCategory] = useState(contact.category || 'profesional');

  // Sync when contact changes
  useEffect(() => { setCurrentCategory(contact.category || 'profesional'); }, [contact.id]);

  const updateCategory = async (newCat: string) => {
    setCurrentCategory(newCat);
    try {
      await (supabase as any).from('people_contacts').update({ category: newCat }).eq('id', contact.id);
      contact.category = newCat;
      toast.success(`Categoría: ${newCat}`);
    } catch { toast.error('Error al actualizar categoría'); }
  };

  const contactThreads = threads.filter(t => contactIsInThread(contact.name, t));
  const contactRecordingIds = new Set(contactThreads.flatMap(t => t.recording_ids || []));
  const contactRecordings = recordings.filter(r => contactRecordingIds.has(r.id));

  const profile = contact.personality_profile as Record<string, unknown> | null;
  const hasProfile = profile && Object.keys(profile).length > 0 && (profile.sinopsis || profile.ambito || profile.estado_relacion);

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
              {/* Category selector */}
              <div className="flex gap-1 mt-2">
                {['profesional', 'personal', 'familiar'].map(cat => (
                  <button
                    key={cat}
                    onClick={() => updateCategory(cat)}
                    className={cn(
                      "text-xs px-2 py-1 rounded-full border flex items-center gap-1 transition-all",
                      currentCategory === cat
                        ? getCategoryColor(cat) + " font-medium"
                        : "border-border text-muted-foreground hover:border-muted-foreground/50"
                    )}
                  >
                    {getCategoryIcon(cat)}
                    <span className="capitalize">{cat}</span>
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
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

        {/* Profile Tab - Intelligence by Scope */}
        <TabsContent value="profile" className="mt-3 space-y-3">
          {hasProfile ? (
            <ProfileByScope profile={profile} ambito={currentCategory} />
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
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');

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

    // Category filter
    if (categoryFilter !== 'all' && (c.category || 'profesional') !== categoryFilter) return false;

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

              {/* Category filter */}
              <div className="flex gap-1 flex-wrap">
                {(['all', 'profesional', 'personal', 'familiar'] as CategoryFilter[]).map(cat => (
                  <Button
                    key={cat}
                    variant={categoryFilter === cat ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setCategoryFilter(cat)}
                    className="h-7 text-xs"
                  >
                    {cat === 'all' ? <Eye className="w-3 h-3 mr-1" /> : getCategoryIcon(cat)}
                    <span className="ml-1 capitalize">{cat === 'all' ? 'Todos' : cat}</span>
                  </Button>
                ))}
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
