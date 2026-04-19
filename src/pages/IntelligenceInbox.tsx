import { useSignalSuggestions, SignalSuggestion } from "@/hooks/useSignalSuggestions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Brain,
  CheckCircle2,
  X,
  RefreshCw,
  ListTodo,
  CalendarClock,
  Clock,
  UserPlus,
  MessageSquare,
  Mail,
  StickyNote,
  Loader2,
  Info,
} from "lucide-react";

const TYPE_META: Record<string, { label: string; icon: any; tone: string }> = {
  task_from_signal: { label: "Posible tarea", icon: ListTodo, tone: "text-blue-500" },
  meeting_from_signal: { label: "Posible cita", icon: CalendarClock, tone: "text-green-500" },
  followup_from_signal: { label: "Follow-up sugerido", icon: Clock, tone: "text-amber-500" },
  outreach_from_signal: { label: "Contactar proactivo", icon: UserPlus, tone: "text-purple-500" },
};

const SOURCE_ICON: Record<string, any> = {
  whatsapp: MessageSquare,
  email: Mail,
  notes: StickyNote,
  chat: Brain,
};

function confidenceBadge(c: number | null) {
  const v = c ?? 0;
  if (v >= 0.8) return { label: `Alta · ${(v * 100).toFixed(0)}%`, variant: "default" as const };
  if (v >= 0.6) return { label: `Media · ${(v * 100).toFixed(0)}%`, variant: "secondary" as const };
  return { label: `Baja · ${(v * 100).toFixed(0)}%`, variant: "outline" as const };
}

function Item({ s, onAccept, onReject }: { s: SignalSuggestion; onAccept: (s: SignalSuggestion) => void; onReject: (s: SignalSuggestion) => void }) {
  const meta = TYPE_META[s.suggestion_type] ?? TYPE_META.task_from_signal;
  const Icon = meta.icon;
  const SourceIcon = SOURCE_ICON[s.source ?? "chat"] ?? Brain;
  const conf = confidenceBadge(s.confidence);
  const c = s.content || {};

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Icon className={`w-5 h-5 mt-0.5 ${meta.tone}`} />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
            <Badge variant={conf.variant} className="text-[10px]">{conf.label}</Badge>
            {s.source && (
              <Badge variant="outline" className="text-[10px] gap-1">
                <SourceIcon className="w-3 h-3" /> {s.source}
              </Badge>
            )}
            {c.contact_name && (
              <Badge variant="secondary" className="text-[10px]">{c.contact_name}</Badge>
            )}
          </div>
          <p className="text-sm font-medium">{c.title}</p>
          {c.description && c.description !== c.title && (
            <p className="text-xs text-muted-foreground mt-1">{c.description}</p>
          )}
          {s.reasoning && (
            <p className="text-xs text-muted-foreground mt-2 italic border-l-2 border-border pl-2">
              ¿Por qué? {s.reasoning}
            </p>
          )}
          {c.date && (
            <p className="text-xs text-muted-foreground mt-1">📅 {new Date(c.date).toLocaleString("es-ES")}</p>
          )}
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button size="sm" variant="ghost" onClick={() => onReject(s)}>
          <X className="w-3 h-3 mr-1" /> Descartar
        </Button>
        <Button size="sm" onClick={() => onAccept(s)}>
          <CheckCircle2 className="w-3 h-3 mr-1" /> Aceptar
        </Button>
      </div>
    </div>
  );
}

export default function IntelligenceInbox() {
  const { items, loading, scanning, accept, reject, scanNow } = useSignalSuggestions();

  return (
    <div className="container mx-auto p-4 max-w-4xl space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" /> Bandeja de inteligencia
          </h1>
          <p className="text-sm text-muted-foreground">
            JARVIS detecta señales en WhatsApp, email y notas. Tú validas antes de crear nada.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => scanNow({ force: true })} disabled={scanning}>
            {scanning ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-1" />}
            Escanear ahora
          </Button>
        </div>
      </div>

      <Alert>
        <Info className="w-4 h-4" />
        <AlertTitle>MVP honesto</AlertTitle>
        <AlertDescription className="text-xs">
          Las sugerencias se generan por contacto cuando hay <b>30+ mensajes nuevos</b> o cuando pulsas “Escanear”.
          Nada se crea automáticamente: tú decides. Cada decisión alimenta el sistema (`suggestion_feedback`).
        </AlertDescription>
      </Alert>

      {loading ? (
        <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-muted-foreground" /></div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No hay sugerencias pendientes. Pulsa <b>Escanear ahora</b> para forzar un análisis.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Item key={s.id} s={s} onAccept={accept} onReject={reject} />
          ))}
        </div>
      )}
    </div>
  );
}
