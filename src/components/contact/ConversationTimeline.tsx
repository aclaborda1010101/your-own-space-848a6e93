import { GlassCard } from "@/components/ui/GlassCard";
import { useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface MsgRow {
  id: string;
  direction: "incoming" | "outgoing";
  sender: string | null;
  content: string;
  message_date: string;
}

interface ConversationTimelineProps {
  messages: MsgRow[];
  contactName: string;
}

export function ConversationTimeline({ messages, contactName }: ConversationTimelineProps) {
  const grouped = useMemo(() => {
    const map = new Map<string, MsgRow[]>();
    for (const m of messages) {
      const key = format(new Date(m.message_date), "yyyy-MM");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(m);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [messages]);

  if (messages.length === 0) {
    return (
      <GlassCard className="p-6 text-sm text-muted-foreground">
        Aún no hay mensajes con {contactName}.
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-6">
      <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-4">
        Línea del tiempo
      </h3>
      <div className="space-y-6">
        {grouped.map(([month, msgs]) => (
          <div key={month}>
            <div className="text-sm font-display font-medium text-foreground/90 mb-3 sticky top-0 bg-background/40 backdrop-blur-sm py-1 -mx-2 px-2 rounded">
              {format(new Date(month + "-01"), "LLLL yyyy", { locale: es })}{" "}
              <span className="text-xs text-muted-foreground font-normal">
                · {msgs.length} mensajes
              </span>
            </div>
            <div className="space-y-2">
              {[...msgs]
                .sort((a, b) => new Date(b.message_date).getTime() - new Date(a.message_date).getTime())
                .slice(0, 8)
                .map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-3 text-sm ${
                    m.direction === "outgoing" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`max-w-[75%] rounded-2xl px-3 py-2 ${
                      m.direction === "outgoing"
                        ? "bg-primary/15 border border-primary/20"
                        : "bg-white/[0.04] border border-white/[0.06]"
                    }`}
                  >
                    <p className="leading-relaxed text-foreground/90">
                      {m.content}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 font-mono mt-1">
                      {format(new Date(m.message_date), "d MMM HH:mm", { locale: es })}
                    </p>
                  </div>
                </div>
              ))}
              {msgs.length > 8 && (
                <p className="text-xs text-muted-foreground text-center py-1">
                  + {msgs.length - 8} más en este mes
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}
