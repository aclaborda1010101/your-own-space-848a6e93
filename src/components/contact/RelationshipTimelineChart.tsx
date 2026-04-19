import { useMemo } from "react";
import {
  ComposedChart,
  Line,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { GlassCard } from "@/components/ui/GlassCard";
import { Loader2, Activity } from "lucide-react";
import { useRelationshipTimeline, type TimelinePoint } from "@/hooks/useRelationshipTimeline";

interface Props {
  contactId: string;
  contactName: string;
}

interface Datum {
  ts: number;
  dateLabel: string;
  freq: number | null;          // line A: frequency intensity
  rel: number | null;           // scatter A: relationship hitos
  per: number | null;           // scatter B: personal events
  relPoint?: TimelinePoint;
  perPoint?: TimelinePoint;
  freqMeta?: TimelinePoint;
}

function bucketByMonth(points: TimelinePoint[]): Map<string, TimelinePoint[]> {
  const map = new Map<string, TimelinePoint[]>();
  for (const p of points) {
    const d = new Date(p.date);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(p);
  }
  return map;
}

export function RelationshipTimelineChart({ contactId, contactName }: Props) {
  const { data, loading, error } = useRelationshipTimeline(contactId);

  const series: Datum[] = useMemo(() => {
    if (!data) return [];
    const freqByMonth = new Map<string, TimelinePoint>();
    for (const f of data.relationship_frequency) {
      const k = f.date.slice(0, 7);
      freqByMonth.set(k, f);
    }
    const relByMonth = bucketByMonth(data.relationship_events);
    const perByMonth = bucketByMonth(data.personal_events);

    const allKeys = new Set<string>([
      ...freqByMonth.keys(),
      ...relByMonth.keys(),
      ...perByMonth.keys(),
    ]);

    const sorted = Array.from(allKeys).sort();
    return sorted.map((k) => {
      const ts = new Date(`${k}-15`).getTime();
      const f = freqByMonth.get(k);
      const rel = relByMonth.get(k)?.[0];
      const per = perByMonth.get(k)?.[0];
      return {
        ts,
        dateLabel: new Date(`${k}-15`).toLocaleDateString("es", { month: "short", year: "2-digit" }),
        freq: f?.sentiment ?? null,
        rel: rel?.sentiment ?? null,
        per: per?.sentiment ?? null,
        relPoint: rel,
        perPoint: per,
        freqMeta: f,
      };
    });
  }, [data]);

  if (loading) {
    return (
      <GlassCard className="p-6 flex items-center justify-center min-h-[280px]">
        <Loader2 className="w-5 h-5 animate-spin text-primary mr-2" />
        <span className="text-sm text-muted-foreground">Construyendo línea de vida…</span>
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
        Aún no hay suficientes hitos ni eventos para dibujar la línea de vida.
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.3em] text-primary/80 font-mono">
            <Activity className="w-3 h-3" />
            <span>Línea de vida superpuesta</span>
          </div>
          <h3 className="font-display text-lg mt-1">
            Tu relación con {contactName} <span className="text-muted-foreground font-sans text-sm">↔ tu vida</span>
          </h3>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-primary" />
            <span className="text-muted-foreground">Relación</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-accent" />
            <span className="text-muted-foreground">Tu vida</span>
          </span>
        </div>
      </div>

      <div className="w-full h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={series} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" opacity={0.3} />
            <XAxis
              dataKey="dateLabel"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
            />
            <YAxis
              domain={[-5, 5]}
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              ticks={[-5, -2, 0, 2, 5]}
            />
            <ReferenceLine y={0} stroke="hsl(var(--border))" strokeDasharray="2 2" />
            <Tooltip
              contentStyle={{
                background: "hsl(var(--background))",
                border: "1px solid hsl(var(--border))",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(value: any, name: string, props: any) => {
                const d = props?.payload;
                if (name === "Relación" && d?.relPoint) return [d.relPoint.title, "Hito relación"];
                if (name === "Tu vida" && d?.perPoint) return [`${d.perPoint.title}${d.perPoint.description ? ` — ${d.perPoint.description}` : ""}`, "Evento personal"];
                if (name === "Frecuencia" && d?.freqMeta) return [`${d.freqMeta.total ?? "?"} mensajes`, "Volumen"];
                return [value, name];
              }}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />

            <Line
              type="monotone"
              dataKey="freq"
              name="Frecuencia"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              strokeOpacity={0.4}
              dot={false}
              connectNulls
              isAnimationActive={false}
            />

            <Scatter
              name="Relación"
              dataKey="rel"
              fill="hsl(var(--primary))"
              shape="circle"
            />

            <Scatter
              name="Tu vida"
              dataKey="per"
              fill="hsl(var(--accent))"
              shape="diamond"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[11px] text-muted-foreground/70 mt-3 leading-relaxed">
        Eje X: tiempo. Eje Y: sentimiento (-5 muy negativo · +5 muy positivo). Línea continua: volumen mensual de mensajes. Círculos: hitos de la relación detectados por la IA. Diamantes: eventos de tu vida personal. Pasa el ratón por cada punto para ver el detalle.
      </p>
    </GlassCard>
  );
}
