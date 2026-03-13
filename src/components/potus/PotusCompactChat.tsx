import { FormEvent, useEffect, useRef, useState } from "react";
import { Loader2, Send, Shield, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { usePotusMvpChat } from "@/hooks/usePotusMvpChat";
import { usePotusActions, PotusAction } from "@/hooks/usePotusActions";
import { usePotusAgentSync, AgentStatus } from "@/hooks/usePotusAgentSync";
import ReactMarkdown from "react-markdown";

const STATUS_COLORS: Record<AgentStatus, string> = {
  healthy: "bg-emerald-500",
  degraded: "bg-amber-500",
  offline: "bg-destructive",
  unknown: "bg-muted-foreground/40",
};

export function PotusCompactChat() {
  const [input, setInput] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const { messages, status, error, lastResponseData, sendMessage, reset } = usePotusMvpChat();
  const { executeAction, parseActionsFromResponse } = usePotusActions();
  const { agents, onlineCount } = usePotusAgentSync();
  const [pendingActions, setPendingActions] = useState<PotusAction[]>([]);

  // Parse actions from latest response
  useEffect(() => {
    if (lastResponseData) {
      const actions = parseActionsFromResponse(lastResponseData);
      if (actions.length > 0) setPendingActions(actions);
    }
  }, [lastResponseData, parseActionsFromResponse]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, status]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || status === "sending") return;
    setInput("");
    await sendMessage(content);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header compacto */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10">
            <Shield className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <span className="text-sm font-semibold">POTUS</span>
          {status === "sending" && (
            <span className="text-xs text-muted-foreground animate-pulse">pensando…</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {Object.values(agents).slice(0, 4).map((agent) => (
            <div
              key={agent.name}
              className="group relative"
              title={`${agent.name}: ${agent.status}`}
            >
              <div className={cn("h-2 w-2 rounded-full", STATUS_COLORS[agent.status])} />
            </div>
          ))}
          <span className="ml-1 text-[10px] text-muted-foreground">{onlineCount}/4</span>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center py-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10">
              <Shield className="h-6 w-6 text-amber-500" />
            </div>
            <p className="text-xs text-muted-foreground max-w-[260px]">
              Cerebro central. Pregúntame lo que necesites o espera instrucciones proactivas.
            </p>
          </div>
        ) : (
          messages.map((msg) => (
            <div
              key={msg.id}
              className={cn(
                "flex gap-2",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10 mt-0.5">
                  <Shield className="h-3 w-3 text-amber-500" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-5",
                  msg.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground"
                    : "rounded-bl-sm border border-border bg-muted/40 text-foreground"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:m-0 [&>ol]:m-0">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                ) : (
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
              </div>
            </div>
          ))
        )}

        {status === "sending" && (
          <div className="flex gap-2">
            <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-amber-500/10">
              <Shield className="h-3 w-3 text-amber-500" />
            </div>
            <div className="rounded-2xl rounded-bl-sm border border-border bg-muted/40 px-3 py-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          </div>
        )}

        {pendingActions.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pl-8">
            {pendingActions.map((action, i) => (
              <Button
                key={i}
                size="sm"
                variant="outline"
                className="h-7 text-xs gap-1"
                onClick={() => {
                  executeAction(action);
                  setPendingActions((p) => p.filter((_, j) => j !== i));
                }}
              >
                <Zap className="h-3 w-3" />
                {action.type === "create_task" ? `Crear: ${action.params.title}` :
                 action.type === "navigate" ? `Ir a ${action.params.route}` :
                 action.type === "mark_done" ? "Completar tarea" :
                 action.type}
              </Button>
            ))}
          </div>
        )}

        {error && (
          <p className="text-xs text-destructive px-2">Error: {error}</p>
        )}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border px-3 py-2">
        <form onSubmit={handleSubmit} className="flex gap-1.5">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Escribe a POTUS…"
            disabled={status === "sending"}
            className="h-8 text-sm flex-1"
          />
          <Button
            type="submit"
            size="sm"
            disabled={!input.trim() || status === "sending"}
            className="h-8 w-8 p-0"
          >
            {status === "sending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5" />
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
