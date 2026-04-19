// Extracted from StrategicNetwork.tsx so it can be reused in the new ContactDetail page.
// Renders the full personality/relationship profile for a given scope (profesional/personal/familiar).

import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CollapsibleCard } from "@/components/dashboard/CollapsibleCard";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Baby,
  CalendarCheck,
  Check,
  CheckSquare,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  HeartHandshake,
  Lightbulb,
  Link2,
  Network,
  Sparkles,
  Star,
  Tag,
  Target,
  ThermometerSun,
  TrendingUp,
  User,
  Users,
  Wallet,
  X,
  Zap,
} from "lucide-react";

interface ContactLite {
  id: string;
  name: string;
  category?: string | null;
}

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
  allContacts: ContactLite[];
  contactLinks: ContactLink[];
  onLinkContact: (sourceId: string, targetId: string, name: string, context: string) => void;
  onIgnoreContact: (sourceId: string, name: string) => void;
}

// ── Helpers (kept local to this module) ──────────────────────────────────
const getCategoryColor = (cat: string | null | undefined) => {
  switch (cat) {
    case "profesional":
      return "bg-blue-500/10 text-blue-400 border-blue-500/30";
    case "personal":
      return "bg-emerald-500/10 text-emerald-400 border-emerald-500/30";
    case "familiar":
      return "bg-amber-500/10 text-amber-400 border-amber-500/30";
    default:
      return "bg-muted/10 text-muted-foreground border-muted/30";
  }
};

const getNivelColor = (nivel: string) => {
  switch (nivel) {
    case "verde":
      return "border-green-500/30 bg-green-500/5";
    case "amarillo":
      return "border-yellow-500/30 bg-yellow-500/5";
    case "rojo":
      return "border-red-500/30 bg-red-500/5";
    default:
      return "border-border bg-muted/5";
  }
};

const getTendenciaBadge = (tendencia: string) => {
  switch (tendencia) {
    case "creciente":
      return "bg-green-500/10 text-green-400 border-green-500/30";
    case "declive":
      return "bg-red-500/10 text-red-400 border-red-500/30";
    default:
      return "bg-muted/10 text-muted-foreground border-border";
  }
};

const getTermometroWidth = (t: string) => {
  switch (t) {
    case "frio":
      return 25;
    case "tibio":
      return 50;
    case "calido":
      return 75;
    case "fuerte":
      return 100;
    default:
      return 50;
  }
};

const getTermometroColor = (t: string) => {
  switch (t) {
    case "frio":
      return "bg-blue-400";
    case "tibio":
      return "bg-yellow-400";
    case "calido":
      return "bg-orange-400";
    case "fuerte":
      return "bg-red-400";
    default:
      return "bg-muted";
  }
};

const InsufficientData = ({ label }: { label: string }) => (
  <div className="p-3 rounded-lg bg-muted/10 border border-dashed border-border">
    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
      <AlertTriangle className="w-3 h-3" />
      Datos insuficientes — se necesitan más interacciones para analizar: {label}
    </p>
  </div>
);

export function ProfileByScope({
  profile,
  ambito,
  contactId,
  allContacts,
  contactLinks,
  onLinkContact,
  onIgnoreContact,
}: ProfileByScopeProps) {
  const [linkingName, setLinkingName] = useState<string | null>(null);
  const [linkSearchOpen, setLinkSearchOpen] = useState(false);

  const isMultiScope =
    profile && typeof profile === "object" && !profile.ambito && (profile.profesional || profile.personal || profile.familiar);
  const p = isMultiScope ? profile[ambito] || {} : profile;

  if (!p || Object.keys(p).length === 0) {
    return (
      <div className="py-8 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm text-muted-foreground">Sin análisis para el ámbito "{ambito}"</p>
        <p className="text-xs text-muted-foreground">Pulsa "Analizar IA" para generar este análisis</p>
      </div>
    );
  }

  const findPotentialMatch = (name: string): ContactLite | null => {
    const nameLower = name.toLowerCase().trim();
    const firstName = nameLower.split(" ")[0];
    return (
      allContacts.find((c) => {
        const cName = c.name.toLowerCase();
        const cFirst = cName.split(" ")[0];
        return c.id !== contactId && (cName === nameLower || cFirst === firstName);
      }) || null
    );
  };

  const getLinkForName = (name: string): ContactLink | null =>
    contactLinks.find(
      (l) =>
        l.source_contact_id === contactId &&
        l.mentioned_name.toLowerCase() === name.toLowerCase() &&
        l.status !== "ignored",
    ) || null;

  const isIgnored = (name: string): boolean =>
    contactLinks.some(
      (l) =>
        l.source_contact_id === contactId &&
        l.mentioned_name.toLowerCase() === name.toLowerCase() &&
        l.status === "ignored",
    );

  const mentionedByOthers = contactLinks.filter(
    (l) => l.target_contact_id === contactId && l.status === "linked",
  );

  const globalDist = profile?._global_distribution;
  const dist = globalDist || p.metricas_comunicacion?.distribucion_ambitos;
  const historical = profile?._historical_analysis;

  return (
    <div className="space-y-2">
      {/* Distribución de ámbitos */}
      {dist && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/10 border border-border text-xs flex-wrap">
          <BarChart3 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-muted-foreground">Este contacto:</span>
          <span className="text-blue-400 font-medium">{dist.profesional_pct ?? "?"}% profesional</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-emerald-400 font-medium">{dist.personal_pct ?? "?"}% personal</span>
          <span className="text-muted-foreground">·</span>
          <span className="text-amber-400 font-medium">{dist.familiar_pct ?? "?"}% familiar</span>
        </div>
      )}

      {/* Estado y última interacción */}
      {p.estado_relacion && (
        <CollapsibleCard
          id={`profile-estado-${contactId}-${ambito}`}
          title="Estado de la Relación"
          icon={<Activity className="w-3.5 h-3.5 text-primary" />}
          defaultOpen
          badge={<span className="text-lg">{p.estado_relacion.emoji || "🔵"}</span>}
        >
          <div className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">
                  {p.estado_relacion.descripcion || "Sin descripción"}
                </p>
                {p.ultima_interaccion && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Último contacto: {p.ultima_interaccion.fecha || "—"} · {p.ultima_interaccion.canal || "—"}
                  </p>
                )}
              </div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Situación actual */}
      {p.situacion_actual && !String(p.situacion_actual).toLowerCase().includes("insuficiente") ? (
        <CollapsibleCard
          id={`profile-situacion-${contactId}-${ambito}`}
          title="Situación Actual"
          icon={<FileText className="w-3.5 h-3.5 text-primary" />}
          defaultOpen
        >
          <div className="p-4">
            <p className="text-sm text-foreground leading-relaxed">{String(p.situacion_actual)}</p>
          </div>
        </CollapsibleCard>
      ) : (
        <InsufficientData label="situación actual" />
      )}

      {/* Historia de la Relación */}
      {historical && historical.resumen_narrativo && (
        <CollapsibleCard
          id={`profile-historia-${contactId}-${ambito}`}
          title="Historia de la Relación"
          icon={<Clock className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={
            historical.duracion_relacion ? (
              <Badge variant="outline" className="text-xs border-primary/30 text-primary">
                {historical.duracion_relacion}
              </Badge>
            ) : undefined
          }
        >
          <div className="p-4 space-y-3">
            <p className="text-sm text-foreground leading-relaxed">{historical.resumen_narrativo}</p>
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Primer contacto</p>
                <p className="font-medium text-foreground">{historical.primer_contacto || "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Duración</p>
                <p className="font-medium text-foreground">{historical.duracion_relacion || "—"}</p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Msgs totales</p>
                <p className="font-medium text-foreground">{historical.mensajes_totales?.toLocaleString() || "—"}</p>
              </div>
            </div>
            {Array.isArray(historical.evolucion_anual) && historical.evolucion_anual.length > 0 && (
              <div>
                <p className="text-xs text-muted-foreground font-medium mb-1">Evolución anual:</p>
                <div className="space-y-1">
                  {historical.evolucion_anual.map((ev: any, i: number) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="font-mono text-muted-foreground w-12">
                        {ev.ano}
                        {ev.periodo ? ` (${ev.periodo})` : ""}
                      </span>
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
          </div>
        </CollapsibleCard>
      )}

      {/* Evolución reciente */}
      {p.evolucion_reciente && (
        <CollapsibleCard
          id={`profile-evolucion-${contactId}-${ambito}`}
          title="Evolución Reciente"
          icon={<TrendingUp className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={
            p.evolucion_reciente.tendencia_general ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  p.evolucion_reciente.tendencia_general === "mejorando"
                    ? "border-green-500/30 text-green-400"
                    : p.evolucion_reciente.tendencia_general === "deteriorandose"
                      ? "border-red-500/30 text-red-400"
                      : "border-border text-muted-foreground",
                )}
              >
                {p.evolucion_reciente.tendencia_general === "mejorando"
                  ? "📈"
                  : p.evolucion_reciente.tendencia_general === "deteriorandose"
                    ? "📉"
                    : "➡️"}{" "}
                {p.evolucion_reciente.tendencia_general}
              </Badge>
            ) : undefined
          }
        >
          <div className="p-4 space-y-3">
            <div className="space-y-2">
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hace 1 mes:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hace_1_mes || "Sin datos"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/60 mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hace 1 semana:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hace_1_semana || "Sin datos"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3 text-xs">
                <div className="w-2 h-2 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                <div>
                  <span className="text-muted-foreground font-medium">Hoy:</span>
                  <p className="text-foreground">{p.evolucion_reciente.hoy || "Sin datos"}</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Datos clave */}
      {Array.isArray(p.datos_clave) && p.datos_clave.length > 0 ? (
        <CollapsibleCard
          id={`profile-datos-${contactId}-${ambito}`}
          title="Datos Clave"
          icon={<Tag className="w-3.5 h-3.5 text-primary" />}
          defaultOpen
          badge={<Badge variant="outline" className="text-xs">{p.datos_clave.length}</Badge>}
        >
          <div className="p-4">
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
          </div>
        </CollapsibleCard>
      ) : (
        <InsufficientData label="datos clave" />
      )}

      {/* Métricas de comunicación */}
      {p.metricas_comunicacion ? (
        <CollapsibleCard
          id={`profile-metricas-${contactId}-${ambito}`}
          title="Métricas de Comunicación"
          icon={<BarChart3 className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={
            p.metricas_comunicacion.tendencia_pct !== undefined ? (
              <Badge variant="outline" className={cn("text-xs", getTendenciaBadge(p.metricas_comunicacion.tendencia))}>
                {p.metricas_comunicacion.tendencia_pct > 0 ? "+" : ""}
                {p.metricas_comunicacion.tendencia_pct}%
              </Badge>
            ) : undefined
          }
        >
          <div className="p-4 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Total (30d)</p>
                <p className="font-bold text-foreground text-lg">
                  {p.metricas_comunicacion.total_mensajes_30d ?? p.metricas_comunicacion.frecuencia ?? "—"}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-muted/30 text-center">
                <p className="text-muted-foreground mb-0.5">Tendencia</p>
                <Badge
                  variant="outline"
                  className={cn("text-xs capitalize", getTendenciaBadge(p.metricas_comunicacion.tendencia))}
                >
                  {p.metricas_comunicacion.tendencia_pct !== undefined
                    ? `${p.metricas_comunicacion.tendencia_pct > 0 ? "📈 +" : p.metricas_comunicacion.tendencia_pct < 0 ? "📉 " : "➡️ "}${p.metricas_comunicacion.tendencia_pct}%`
                    : p.metricas_comunicacion.tendencia || "estable"}
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
                  <div
                    className="h-full bg-primary rounded-l-full"
                    style={{ width: `${p.metricas_comunicacion.ratio_iniciativa.usuario}%` }}
                  />
                  <div className="h-full bg-muted-foreground/30 rounded-r-full flex-1" />
                </div>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2 text-xs">
              {p.metricas_comunicacion.dia_mas_activo && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <CalendarCheck className="w-3 h-3" />
                  <span>
                    Día: <span className="text-foreground font-medium">{p.metricas_comunicacion.dia_mas_activo}</span>
                  </span>
                </div>
              )}
              {p.metricas_comunicacion.horario_habitual && (
                <div className="flex items-center gap-1.5 text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  <span>
                    Horario:{" "}
                    <span className="text-foreground font-medium">{p.metricas_comunicacion.horario_habitual}</span>
                  </span>
                </div>
              )}
            </div>
            {p.metricas_comunicacion.canales && (
              <div className="flex gap-1 flex-wrap">
                {p.metricas_comunicacion.canales.map((c: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs capitalize">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleCard>
      ) : (
        <InsufficientData label="métricas de comunicación" />
      )}

      {/* Profesional: Pipeline */}
      {ambito === "profesional" && p.pipeline && (
        <CollapsibleCard
          id={`profile-pipeline-${contactId}`}
          title="Pipeline"
          icon={<BarChart3 className="w-3.5 h-3.5 text-blue-400" />}
          defaultOpen
          badge={
            p.pipeline.probabilidad_cierre ? (
              <Badge
                variant="outline"
                className={cn(
                  "text-xs capitalize",
                  p.pipeline.probabilidad_cierre === "alta"
                    ? "border-green-500/30 text-green-400"
                    : p.pipeline.probabilidad_cierre === "media"
                      ? "border-yellow-500/30 text-yellow-400"
                      : "border-red-500/30 text-red-400",
                )}
              >
                {p.pipeline.probabilidad_cierre}
              </Badge>
            ) : undefined
          }
        >
          <div className="p-4 space-y-2">
            {Array.isArray(p.pipeline.oportunidades) && p.pipeline.oportunidades.length > 0 ? (
              <ul className="space-y-1.5">
                {p.pipeline.oportunidades.map((op: any, i: number) => (
                  <li key={i} className="text-xs flex items-start gap-2">
                    <Zap className="w-3 h-3 text-blue-400 mt-0.5 flex-shrink-0" />
                    <span className="text-foreground">{op.descripcion}</span>
                    <Badge variant="outline" className="text-xs ml-auto capitalize">
                      {op.estado}
                    </Badge>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">Sin oportunidades activas</p>
            )}
          </div>
        </CollapsibleCard>
      )}

      {/* Personal: Termómetro + Reciprocidad */}
      {ambito === "personal" && p.termometro_relacion && (
        <CollapsibleCard
          id={`profile-termometro-${contactId}`}
          title="Termómetro de Relación"
          icon={<ThermometerSun className="w-3.5 h-3.5 text-emerald-400" />}
          defaultOpen
          badge={
            <Badge variant="outline" className="text-xs capitalize">
              {p.termometro_relacion}
            </Badge>
          }
        >
          <div className="p-4 space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <div className="h-3 rounded-full bg-muted/30 overflow-hidden">
                  <div
                    className={cn("h-full rounded-full transition-all", getTermometroColor(p.termometro_relacion))}
                    style={{ width: `${getTermometroWidth(p.termometro_relacion)}%` }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-foreground capitalize">{p.termometro_relacion}</span>
            </div>
          </div>
        </CollapsibleCard>
      )}
      {ambito === "personal" && p.reciprocidad && (
        <CollapsibleCard
          id={`profile-reciprocidad-${contactId}`}
          title="Reciprocidad"
          icon={<HeartHandshake className="w-3.5 h-3.5 text-emerald-400" />}
          defaultOpen
        >
          <div className="p-4 space-y-2">
            <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
              <span>Yo: {p.reciprocidad.usuario_inicia}%</span>
              <span>Contacto: {p.reciprocidad.contacto_inicia}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted/30 overflow-hidden flex">
              <div
                className="h-full bg-emerald-400 rounded-l-full"
                style={{ width: `${p.reciprocidad.usuario_inicia}%` }}
              />
              <div className="h-full bg-muted-foreground/30 rounded-r-full flex-1" />
            </div>
            <p className="text-xs text-muted-foreground capitalize">{p.reciprocidad.evaluacion}</p>
          </div>
        </CollapsibleCard>
      )}

      {/* Personal: Gestiones Compartidas */}
      {ambito === "personal" && Array.isArray(p.gestiones_compartidas) && p.gestiones_compartidas.length > 0 && (
        <CollapsibleCard
          id={`profile-gestiones-${contactId}`}
          title="Gestiones Compartidas"
          icon={<Wallet className="w-3.5 h-3.5 text-emerald-400" />}
          defaultOpen={false}
          badge={<Badge variant="outline" className="text-xs">{p.gestiones_compartidas.length}</Badge>}
        >
          <div className="p-4">
            <ul className="space-y-2">
              {p.gestiones_compartidas.map((g: any, i: number) => (
                <li key={i} className="text-xs p-2 rounded-lg bg-muted/10 border border-border">
                  <p className="font-medium text-foreground">{g.descripcion}</p>
                  <div className="flex flex-wrap gap-2 mt-1 text-muted-foreground">
                    {g.monto && <span className="font-medium text-foreground">{g.monto}</span>}
                    {g.origen && <span>· {g.origen}</span>}
                    {g.estado && (
                      <Badge variant="outline" className="text-xs capitalize">
                        {g.estado}
                      </Badge>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleCard>
      )}

      {/* Personal: Dinámica de la Relación */}
      {ambito === "personal" && p.dinamica_relacion && (
        <CollapsibleCard
          id={`profile-dinamica-${contactId}`}
          title="Dinámica de la Relación"
          icon={<Sparkles className="w-3.5 h-3.5 text-emerald-400" />}
          defaultOpen={false}
        >
          <div className="p-4 space-y-3">
            <div className="space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Tono predominante:</span>
                <span className="font-medium text-foreground capitalize">{p.dinamica_relacion.tono || "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Confianza percibida:</span>
                <Badge variant="outline" className="text-xs capitalize">
                  {p.dinamica_relacion.confianza_percibida || "—"}
                </Badge>
              </div>
              {p.dinamica_relacion.evidencia_confianza && (
                <p className="text-muted-foreground italic border-l-2 border-emerald-500/30 pl-2 mt-1">
                  "{p.dinamica_relacion.evidencia_confianza}"
                </p>
              )}
            </div>
          </div>
        </CollapsibleCard>
      )}

      {/* Familiar: Bienestar */}
      {ambito === "familiar" && p.bienestar && (
        <CollapsibleCard
          id={`profile-bienestar-${contactId}`}
          title="Bienestar"
          icon={<Activity className="w-3.5 h-3.5 text-amber-400" />}
          defaultOpen
        >
          <div className="p-4 space-y-2">
            <p className="text-sm text-foreground">{p.bienestar.estado_emocional}</p>
            {Array.isArray(p.bienestar.necesidades) && p.bienestar.necesidades.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-1">
                {p.bienestar.necesidades.map((n: string, i: number) => (
                  <Badge key={i} variant="outline" className="text-xs border-amber-500/30 text-amber-400">
                    {n}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CollapsibleCard>
      )}

      {ambito === "familiar" && Array.isArray(p.coordinacion) && p.coordinacion.length > 0 && (
        <CollapsibleCard
          id={`profile-coordinacion-${contactId}`}
          title="Coordinación Familiar"
          icon={<CalendarCheck className="w-3.5 h-3.5 text-amber-400" />}
          defaultOpen
          badge={<Badge variant="outline" className="text-xs">{p.coordinacion.length}</Badge>}
        >
          <div className="p-4">
            <ul className="space-y-1.5">
              {p.coordinacion.map((c: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckSquare className="w-3 h-3 text-amber-400 mt-0.5 flex-shrink-0" />
                  <span className="text-foreground">{c.tarea}</span>
                  <span className="text-muted-foreground ml-auto">→ {c.responsable}</span>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleCard>
      )}

      {ambito === "familiar" && p.desarrollo_bosco && (
        <CollapsibleCard
          id={`profile-bosco-${contactId}`}
          title="Desarrollo Bosco"
          icon={<Baby className="w-3.5 h-3.5 text-amber-400" />}
          defaultOpen={false}
        >
          <div className="p-4 space-y-2">
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
          </div>
        </CollapsibleCard>
      )}

      {/* Patrones detectados */}
      {Array.isArray(p.patrones_detectados) && p.patrones_detectados.length > 0 ? (
        <CollapsibleCard
          id={`profile-patrones-${contactId}-${ambito}`}
          title="Patrones Detectados"
          icon={<Eye className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={<Badge variant="outline" className="text-xs">{p.patrones_detectados.length}</Badge>}
        >
          <div className="p-4">
            <div className="space-y-2">
              {p.patrones_detectados.map((pat: any, i: number) => (
                <div key={i} className={cn("p-2 rounded-lg border text-xs", getNivelColor(pat.nivel))}>
                  <div className="flex items-center gap-1.5 font-medium text-foreground mb-0.5">
                    <span>{pat.emoji}</span>
                    <span>{pat.patron}</span>
                  </div>
                  <p className="text-muted-foreground">{pat.evidencia}</p>
                </div>
              ))}
            </div>
          </div>
        </CollapsibleCard>
      ) : (
        <InsufficientData label="patrones" />
      )}

      {/* Alertas */}
      {Array.isArray(p.alertas) && p.alertas.length > 0 && (
        <CollapsibleCard
          id={`profile-alertas-${contactId}-${ambito}`}
          title="Alertas"
          icon={<AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
          defaultOpen
          badge={
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                p.alertas.some((a: any) => a.nivel === "rojo")
                  ? "border-red-500/30 text-red-400"
                  : "border-yellow-500/30 text-yellow-400",
              )}
            >
              {p.alertas.length} alerta{p.alertas.length > 1 ? "s" : ""}
            </Badge>
          }
        >
          <div className="p-4">
            <ul className="space-y-2">
              {p.alertas.map((a: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <span>{a.nivel === "rojo" ? "🔴" : "🟡"}</span>
                  <div className="flex-1">
                    {a.tipo && (
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs mr-1.5 mb-0.5",
                          a.tipo === "contacto"
                            ? "border-blue-500/30 text-blue-400 bg-blue-500/5"
                            : "border-amber-500/30 text-amber-400 bg-amber-500/5",
                        )}
                      >
                        {a.tipo === "contacto" ? "CONTACTO" : "OBSERVACIÓN"}
                      </Badge>
                    )}
                    <span className="text-foreground">{a.texto}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleCard>
      )}

      {/* Red de contactos mencionados */}
      {Array.isArray(p.red_contactos_mencionados) && p.red_contactos_mencionados.length > 0 && (
        <CollapsibleCard
          id={`profile-red-${contactId}-${ambito}`}
          title="Red de Contactos Mencionados"
          icon={<Network className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={<Badge variant="outline" className="text-xs">{p.red_contactos_mencionados.length}</Badge>}
        >
          <div className="p-4">
            <ul className="space-y-2">
              {p.red_contactos_mencionados.map((c: any, i: number) => {
                const existingLink = getLinkForName(c.nombre);
                const ignored = isIgnored(c.nombre);
                const potentialMatch = findPotentialMatch(c.nombre);
                const linkedContact = existingLink
                  ? allContacts.find((ct) => ct.id === existingLink.target_contact_id)
                  : null;
                if (ignored) return null;
                return (
                  <li key={i} className="text-xs p-2 rounded-lg bg-muted/10 border border-border">
                    <div className="flex items-start gap-2">
                      {existingLink ? (
                        <Link2 className="w-3.5 h-3.5 text-green-400 mt-0.5 flex-shrink-0" />
                      ) : potentialMatch ? (
                        <Link2 className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
                      ) : (
                        <User className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-foreground">{c.nombre}</span>
                          {existingLink ? (
                            <Badge
                              variant="outline"
                              className="text-xs border-green-500/30 text-green-400 bg-green-500/5"
                            >
                              🔗 Vinculado{linkedContact ? `: ${linkedContact.name}` : ""}
                            </Badge>
                          ) : potentialMatch ? (
                            <Badge variant="outline" className="text-xs border-blue-500/30 text-blue-400 bg-blue-500/5">
                              🔗 Posible match
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs capitalize">
                              {c.relacion}
                            </Badge>
                          )}
                        </div>
                        <p className="text-muted-foreground mt-0.5">{c.contexto}</p>
                        {!existingLink && potentialMatch && (
                          <div className="mt-1.5 flex gap-1.5 flex-wrap">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-6 text-xs px-2 border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
                              onClick={() =>
                                onLinkContact(contactId, potentialMatch.id, c.nombre, c.contexto || "")
                              }
                            >
                              <Check className="w-3 h-3 mr-1" /> Vincular con {potentialMatch.name}
                            </Button>
                          </div>
                        )}
                        {!existingLink && !potentialMatch && (
                          <div className="mt-1.5 flex gap-1.5 flex-wrap">
                            <Popover
                              open={linkingName === c.nombre && linkSearchOpen}
                              onOpenChange={(open) => {
                                setLinkSearchOpen(open);
                                if (!open) setLinkingName(null);
                              }}
                            >
                              <PopoverTrigger asChild>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-6 text-xs px-2"
                                  onClick={() => {
                                    setLinkingName(c.nombre);
                                    setLinkSearchOpen(true);
                                  }}
                                >
                                  <Link2 className="w-3 h-3 mr-1" /> Vincular
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="p-0 w-64" align="start">
                                <Command>
                                  <CommandInput placeholder="Buscar contacto..." className="h-9" />
                                  <CommandList>
                                    <CommandEmpty>No encontrado</CommandEmpty>
                                    <CommandGroup>
                                      {allContacts
                                        .filter((ct) => ct.id !== contactId)
                                        .map((ct) => (
                                          <CommandItem
                                            key={ct.id}
                                            onSelect={() => {
                                              onLinkContact(contactId, ct.id, c.nombre, c.contexto || "");
                                              setLinkSearchOpen(false);
                                              setLinkingName(null);
                                            }}
                                          >
                                            <User className="w-3 h-3 mr-2" />
                                            <span>{ct.name}</span>
                                            {ct.category && (
                                              <Badge
                                                variant="outline"
                                                className={cn("ml-auto text-xs", getCategoryColor(ct.category))}
                                              >
                                                {ct.category}
                                              </Badge>
                                            )}
                                          </CommandItem>
                                        ))}
                                    </CommandGroup>
                                  </CommandList>
                                </Command>
                              </PopoverContent>
                            </Popover>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs px-2 text-muted-foreground"
                              onClick={() => onIgnoreContact(contactId, c.nombre)}
                            >
                              <X className="w-3 h-3 mr-1" /> Ignorar
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </CollapsibleCard>
      )}

      {/* Mencionado por otros contactos */}
      {mentionedByOthers.length > 0 && (
        <CollapsibleCard
          id={`profile-mencionado-${contactId}`}
          title="Mencionado por Otros"
          icon={<Users className="w-3.5 h-3.5 text-primary" />}
          defaultOpen={false}
          badge={<Badge variant="outline" className="text-xs">{mentionedByOthers.length}</Badge>}
        >
          <div className="p-4">
            <ul className="space-y-1.5">
              {mentionedByOthers.map((link, i) => {
                const sourceContact = allContacts.find((c) => c.id === link.source_contact_id);
                return (
                  <li key={i} className="text-xs flex items-start gap-2 p-2 rounded-lg bg-muted/10 border border-border">
                    <ExternalLink className="w-3.5 h-3.5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-foreground">{sourceContact?.name || "Contacto"}</span>
                      {link.first_mention_date && (
                        <span className="text-muted-foreground"> ({link.first_mention_date})</span>
                      )}
                      {link.context && <span className="text-muted-foreground">: {link.context}</span>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </CollapsibleCard>
      )}

      {/* Acciones pendientes */}
      {Array.isArray(p.acciones_pendientes) && p.acciones_pendientes.length > 0 ? (
        <CollapsibleCard
          id={`profile-acciones-${contactId}-${ambito}`}
          title="Acciones Pendientes"
          icon={<CheckSquare className="w-3.5 h-3.5 text-primary" />}
          defaultOpen
          badge={<Badge variant="outline" className="text-xs">{p.acciones_pendientes.length}</Badge>}
        >
          <div className="p-4">
            <ul className="space-y-2">
              {p.acciones_pendientes.map((a: any, i: number) => (
                <li key={i} className="text-xs flex items-start gap-2">
                  <CheckSquare className="w-3 h-3 text-primary mt-0.5 flex-shrink-0" />
                  <div className="flex-1">
                    <p className="text-foreground font-medium">{a.accion}</p>
                    <p className="text-muted-foreground">
                      Origen: {a.origen} · Sugerido: {a.fecha_sugerida}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </CollapsibleCard>
      ) : (
        <InsufficientData label="acciones pendientes" />
      )}

      {/* Próxima acción */}
      {p.proxima_accion && (
        <CollapsibleCard
          id={`profile-proxima-${contactId}-${ambito}`}
          title="Próxima Acción Recomendada"
          icon={<ArrowRight className="w-3.5 h-3.5 text-primary" />}
          defaultOpen
        >
          <div className="p-4 space-y-2 text-sm">
            <p className="font-medium text-foreground">{p.proxima_accion.que}</p>
            <div className="flex flex-wrap gap-2 text-xs items-center text-muted-foreground">
              {p.proxima_accion.canal && <span className="capitalize">📡 {p.proxima_accion.canal}</span>}
              {p.proxima_accion.cuando && <span>⏱ {p.proxima_accion.cuando}</span>}
            </div>
            {p.proxima_accion.pretexto && (
              <p className="text-xs text-muted-foreground flex items-start gap-1.5">
                <Lightbulb className="w-3 h-3 text-amber-400 flex-shrink-0 mt-0.5" />
                Pretexto: {p.proxima_accion.pretexto}
              </p>
            )}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
