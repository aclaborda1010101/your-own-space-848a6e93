import { useMemo } from "react";
import {
  ComposedChart,
  Area,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { Button } from "@/components/ui/button";
import { Loader2, Activity, RefreshCw } from "lucide-react";
import { useRelationshipTimeline, type TimelinePoint } from "@/hooks/useRelationshipTimeline";

interface Props {
  contactId: string;
  contactName: string;
}

interface Datum {
  ts: number;
  dateLabel: string;
  curve: number; // smoothed activity/sentiment curve
  hitoY?: number | null;
  personalY?: number | null;
  hito?: TimelinePoint;
  personal?: TimelinePoint;
}

const CATEGORY_ICON: Record<string, string> = {
  viaje: "✈️",
  celebracion: "🎉",
  conflicto: "💥",
  logro: "🏆",
  perdida: "💔",
  reencuentro: "🤝",
  cotidiano: "💬",
  salud: "🏥",
  familia: "👨‍👩‍👧",
  trabajo: "💼",
};

function sentimentLabel(s: number): { label: string; color: string } {
  if (s >= 2) return { label: "Muy bueno", color: "hsl(142 71% 45%)" };
  if (s >= 1) return { label: "Bueno", color: "hsl(142 60% 55%)" };
  if (s <= -2) return { label: "Muy malo", color: "hsl(0 72% 51%)" };
  if (s <= -1) return { label: "Malo", color: "hsl(15 75% 55%)" };
  return { label: "Neutro", color: "hsl(45 90% 55%)" };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es", { day: "numeric", month: "short", year: "numeric" });
}

function CustomTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null;
  const datum = payload[0]?.payload as Datum;
  if (!datum) return null;

  const items: Array<{ pt: TimelinePoint; isPersonal: boolean }> = [];
  if (datum.hito) items.push({ pt: datum.hito, isPersonal: false });
  if (datum.personal) items.push({ pt: datum.personal, isPersonal: true });

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-lg">
        <div className="text-xs text-muted-foreground">{datum.dateLabel}</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-background/95 backdrop-blur px-3 py-2 shadow-lg max-w-[280px]">
      {items.map((it, idx) => {
        const sent = sentimentLabel(it.pt.sentiment);
        const icon = it.isPersonal ? "🌍" : CATEGORY_ICON[it.pt.category || "cotidiano"] || "💬";
        return (
          <div key={idx} className={idx > 0 ? "mt-2 pt-2 border-t border-border" : ""}>
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
              <span>{it.isPersonal ? "Tu vida" : "Relación"}</span>
              <span>·</span>
              <span>{formatDate(it.pt.date)}</span>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-lg leading-none">{icon}</span>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm leading-tight">{it.pt.title}</div>
                {it.pt.description && (
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-3">{it.pt.description}</div>
                )}
                <div
                  className="inline-block text-[10px] font-medium mt-1.5 px-1.5 py-0.5 rounded"
                  style={{ background: `${sent.color}22`, color: sent.color }}
                >
                  {sent.label}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function HitoDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.hito) return null;
  const sent = sentimentLabel(payload.hito.sentiment);
  return (
    <g>
      <circle cx={cx} cy={cy} r={7} fill={sent.color} stroke="hsl(var(--background))" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={11} fill={sent.color} fillOpacity={0.25} />
    </g>
  );
}

function PersonalDot(props: any) {
  const { cx, cy, payload } = props;
  if (cx == null || cy == null || !payload?.personal) return null;
  return (
    <g>
      <line
        x1={cx}
        y1={0}
        x2={cx}
        y2={cy}
        stroke="hsl(var(--accent))"
        strokeWidth={1}
        strokeDasharray="2 3"
        opacity={0.4}
      />
      <rect
        x={cx - 6}
        y={cy - 6}
        width={12}
        height={12}
        transform={`rotate(45 ${cx} ${cy})`}
        fill="hsl(var(--accent))"
        stroke="hsl(var(--background))"
        strokeWidth={2}
      />
    </g>
  );
}

export function RelationshipTimelineChart({ contactId, contactName }: Props) {
  const { data, loading, error, refresh } = useRelationshipTimeline(contactId);

  const series: Datum[] = useMemo(() => {
    if (!data) return [];

    // Build a unified sorted timeline of all dates we care about
    const allPoints = new Map<string, Datum>();

    // Frequency curve as base
    for (const f of data.relationship_frequency) {
      const ts = new Date(f.date).getTime();
      allPoints.set(f.date, {
        ts,
        dateLabel: new Date(f.date).toLocaleDateString("es", { month: "short", year: "2-digit" }),
        curve: f.sentiment ?? 0,
      });
    }

    // Hitos: place exactly on their date, curve interpolated from sentiment
    for (const h of data.relationship_events) {
      const ts = new Date(h.date).getTime();
      const existing = allPoints.get(h.date) || {
        ts,
        dateLabel: new Date(h.date).toLocaleDateString("es", { day: "numeric", month: "short", year: "2-digit" }),
        curve: h.sentiment,
      };
      allPoints.set(h.date, {
        ...existing,
        ts,
        hitoY: h.sentiment,
        hito: h,
      });
    }

    // Personal events
    for (const p of data.personal_events) {
      const ts = new Date(p.date).getTime();
      const existing = allPoints.get(p.date) || {
        ts,
        dateLabel: new Date(p.date).toLocaleDateString("es", { day: "numeric", month: "short", year: "2-digit" }),
        curve: 0,
      };
      allPoints.set(p.date, {
        ...existing,
        ts,
        personalY: p.sentiment ?? 0,
        personal: p,
      });
    }

    return Array.from(allPoints.values()).sort((a, b) => a.ts - b.ts);
  }, [data]);

  if (loading) {
    return (
      <GlassCard className="p-6 flex items-center justify-center min-h-[320px]">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Construyendo línea de vida con IA…</span>
      </GlassCard>
    );
  }

  if (error || !data) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        No se pudo construir la línea de vida.
      </GlassCard>
    );
  }

  if (series.length === 0) {
    return (
      <GlassCard className="p-6 text-center text-sm text-muted-foreground">
        Aún no hay suficientes mensajes ni eventos para dibujar la línea de vida.
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-start justify-between mb-4 gap-3">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 font-mono">
            <Activity className="w-3 h-3" />
            <span>Línea de vida</span>
          </div>
          <h3 className="font-display text-lg mt-1">
            Tu historia con {contactName}{" "}
            <span className="text-muted-foreground font-sans text-sm">↔ tu vida</span>
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            Cada punto es un hito real detectado por la IA. Pasa el ratón para ver qué pasó.
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={refresh}
          disabled={loading}
          className="shrink-0"
          title="Recalcular hitos con IA"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-3 text-[11px]">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(142 71% 45%)" }} />
          <span className="text-muted-foreground">Bueno</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(45 90% 55%)" }} />
          <span className="text-muted-foreground">Neutro</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "hsl(0 72% 51%)" }} />
          <span className="text-muted-foreground">Malo</span>
        </span>
        <span className="flex items-center gap-1.5 ml-auto">
          <span
            className="w-3 h-3 bg-accent"
            style={{ transform: "rotate(45deg)", display: "inline-block" }}
          />
          <span className="text-muted-foreground">Tu vida</span>
        </span>
      </div>

      <div className="w-full h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 20, right: 15, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="curveGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.25} />
            <XAxis
              dataKey="dateLabel"
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              interval="preserveStartEnd"
              minTickGap={40}
            />
            <YAxis
              domain={[-3.5, 3.5]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={10}
              tickLine={false}
              ticks={[-3, 0, 3]}
              tickFormatter={(v) => (v > 0 ? "+" : v < 0 ? "−" : "0")}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
            <Tooltip content={<CustomTooltip />} cursor={{ stroke: "hsl(var(--primary))", strokeOpacity: 0.2 }} />

            <Area
              type="monotone"
              dataKey="curve"
              stroke="hsl(var(--primary))"
              strokeWidth={1.5}
              fill="url(#curveGradient)"
              connectNulls
              isAnimationActive={false}
            />

            <Scatter dataKey="hitoY" shape={<HitoDot />} isAnimationActive={false} />
            <Scatter dataKey="personalY" shape={<PersonalDot />} isAnimationActive={false} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
        Curva: intensidad de la relación a lo largo del tiempo. Círculos: hitos detectados (verde = bueno, rojo = malo, amarillo = neutro). Diamantes: eventos de tu propia vida.
      </p>
    </GlassCard>
  );
}
