import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertTriangle,
  Bot,
  Loader2,
  MessageSquare,
  Send,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

// ─── SSE streaming helper ────────────────────────────────────────────────────
async function streamChat(
  messages: ChatMessage[],
  action: "chat" | "proactive_summary",
  sessionId: string,
  onDelta: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const url = `${SUPABASE_URL}/functions/v1/openclaw-chat`;
  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ messages, action, session_id: sessionId }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      try {
        const parsed = JSON.parse(text);
        onError(parsed.error || `Error ${resp.status}`);
      } catch {
        onError(`Error ${resp.status}: ${text.slice(0, 200)}`);
      }
      return;
    }

    const reader = resp.body?.getReader();
    if (!reader) { onError("No stream body"); return; }

    const decoder = new TextDecoder();
    let textBuffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      textBuffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = textBuffer.indexOf("\n")) !== -1) {
        let line = textBuffer.slice(0, newlineIndex);
        textBuffer = textBuffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch {
          textBuffer = line + "\n" + textBuffer;
          break;
        }
      }
    }

    // Final flush
    if (textBuffer.trim()) {
      for (let raw of textBuffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) onDelta(content);
        } catch { /* skip */ }
      }
    }

    onDone();
  } catch (err) {
    onError((err as Error).message);
  }
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function OpenClawChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proactiveDone, setProactiveDone] = useState(false);
  const [sessionId] = useState(() => crypto.randomUUID());
  const [alerts, setAlerts] = useState<any[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const assistantContentRef = useRef("");
  const { toast } = useToast();

  // Auto-scroll on new content
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages, streaming]);

  // ─── Realtime alerts subscription ──────────────────────────────────────────
  useEffect(() => {
    const channel = supabase
      .channel("openclaw-alerts-rt")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "openclaw_alerts" },
        (payload) => {
          const alert = payload.new as any;
          setAlerts((prev) => [alert, ...prev].slice(0, 10));

          // Auto-open chat for critical alerts
          if (alert.severity === "critical" || alert.severity === "high") {
            setOpen(true);
            toast({
              title: `🚨 ${alert.title}`,
              description: alert.description?.slice(0, 100),
              variant: "destructive",
            });

            // Inject alert into conversation
            const alertMsg: ChatMessage = {
              role: "assistant",
              content: `🚨 **ALERTA ${alert.severity.toUpperCase()}**: ${alert.title}\n\n${alert.description || ""}\n\n_¿Quieres que tome alguna acción?_`,
            };
            setMessages((prev) => [...prev, alertMsg]);
          }
        },
      )
      .subscribe();

    // Load existing unacknowledged alerts
    supabase
      .from("openclaw_alerts")
      .select("*")
      .eq("acknowledged", false)
      .order("created_at", { ascending: false })
      .limit(10)
      .then(({ data }) => {
        if (data?.length) setAlerts(data);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [toast]);

  // ─── Proactive summary on first open ───────────────────────────────────────
  const triggerProactive = useCallback(() => {
    if (proactiveDone || streaming) return;
    setProactiveDone(true);
    setStreaming(true);
    assistantContentRef.current = "";

    setMessages([{ role: "assistant", content: "" }]);

    streamChat(
      [],
      "proactive_summary",
      sessionId,
      (token) => {
        assistantContentRef.current += token;
        setMessages([{ role: "assistant", content: assistantContentRef.current }]);
      },
      () => {
        setStreaming(false);
        // Persist the proactive message
        persistMessage("assistant", assistantContentRef.current);
      },
      (err) => {
        setStreaming(false);
        toast({ title: "Error del agente", description: err, variant: "destructive" });
        setMessages([{ role: "assistant", content: `⚠️ Error: ${err}` }]);
      },
    );
  }, [proactiveDone, streaming, sessionId, toast]);

  useEffect(() => {
    if (open && !proactiveDone) triggerProactive();
  }, [open, proactiveDone, triggerProactive]);

  // ─── Persist messages ──────────────────────────────────────────────────────
  const persistMessage = useCallback(
    async (role: string, content: string) => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from("openclaw_chat_messages").insert({
          user_id: user.id,
          session_id: sessionId,
          role,
          content,
        });
      } catch {
        // Silent fail — don't break UX for persistence
      }
    },
    [sessionId],
  );

  // ─── Send message ─────────────────────────────────────────────────────────
  const sendMessage = useCallback(() => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    assistantContentRef.current = "";

    // Persist user message
    persistMessage("user", userMsg.content);

    streamChat(
      newMessages,
      "chat",
      sessionId,
      (token) => {
        assistantContentRef.current += token;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: assistantContentRef.current };
          return copy;
        });
      },
      () => {
        setStreaming(false);
        persistMessage("assistant", assistantContentRef.current);
      },
      (err) => {
        setStreaming(false);
        toast({ title: "Error", description: err, variant: "destructive" });
      },
    );
  }, [input, messages, streaming, sessionId, persistMessage, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  return (
    <>
      {/* Toggle button */}
      <Button
        onClick={() => setOpen(!open)}
        size="sm"
        variant={open ? "default" : "outline"}
        className="gap-2 relative"
      >
        <Sparkles className="h-4 w-4" />
        Agente Elite
        {unacknowledgedAlerts.length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground">
            {unacknowledgedAlerts.length}
          </span>
        )}
      </Button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[420px] max-w-[calc(100vw-2rem)] flex-col rounded-2xl border border-border bg-card shadow-2xl shadow-black/20" style={{ height: "560px" }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3 rounded-t-2xl bg-gradient-to-r from-primary/5 to-transparent">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-md shadow-primary/20">
                <Zap className="h-4.5 w-4.5 text-primary-foreground" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground flex items-center gap-1.5">
                  OpenClaw Agent
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 font-mono border-primary/30 text-primary">
                    ELITE
                  </Badge>
                </p>
                <p className="text-[10px] text-muted-foreground">GPT-5 · Tool-calling · Proactivo</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unacknowledgedAlerts.length > 0 && (
                <Badge variant="destructive" className="text-[10px] gap-1 px-1.5">
                  <AlertTriangle className="h-3 w-3" />
                  {unacknowledgedAlerts.length}
                </Badge>
              )}
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-3 py-3" ref={scrollRef as any}>
            <div className="space-y-3">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
                >
                  {msg.role === "assistant" && (
                    <div className="mr-2 mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/60 text-foreground rounded-bl-md border border-border/50",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0 [&_table]:text-xs [&_th]:px-2 [&_td]:px-2 [&_li]:my-0.5">
                        <ReactMarkdown>
                          {msg.content || (streaming && i === messages.length - 1 ? "⏳" : "")}
                        </ReactMarkdown>
                      </div>
                    ) : (
                      <p>{msg.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground pl-8">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>Procesando...</span>
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Quick actions */}
          {messages.length <= 1 && !streaming && (
            <div className="px-3 pb-1 flex flex-wrap gap-1.5">
              {["¿Qué tareas están bloqueadas?", "Estado de agentes", "Métricas de rendimiento"].map((q) => (
                <button
                  key={q}
                  onClick={() => {
                    setInput(q);
                    setTimeout(() => {
                      setInput(q);
                      sendMessage();
                    }, 50);
                  }}
                  className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3 rounded-b-2xl">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta o pide una acción..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm rounded-xl border-border/60"
                rows={1}
                disabled={streaming}
              />
              <Button
                size="icon"
                className="h-10 w-10 shrink-0 rounded-xl"
                onClick={sendMessage}
                disabled={!input.trim() || streaming}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
