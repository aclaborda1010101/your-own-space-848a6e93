import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, X, Minus, Send, Loader2, RefreshCw, BellOff, Bell, StopCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

type StreamStatus = "idle" | "connecting" | "responding" | "retrying";

interface AgentMessage {
  id?: string;
  role: "user" | "assistant" | "proactive";
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-unified`;

const PROACTIVE_KEY = "jarvis-proactive-enabled";

export function AgentChatFloat() {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamStatus, setStreamStatus] = useState<StreamStatus>("idle");
  const abortRef = useRef<AbortController | null>(null);
  const [badgeCount, setBadgeCount] = useState(0);
  const [hasProactived, setHasProactived] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(() => {
    try { return localStorage.getItem(PROACTIVE_KEY) !== "false"; } catch { return true; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const toggleProactive = useCallback(() => {
    setProactiveEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(PROACTIVE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  // Scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // On mount: check overdue tasks for badge and auto-open
  useEffect(() => {
    if (!user || !session) return;
    (async () => {
      try {
        const { count } = await supabase
          .from("tasks" as any)
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .or("completed.is.null,completed.eq.false")
          .lt("due_date", new Date().toISOString());
        const overdue = count || 0;
        setBadgeCount(overdue);

        if (!autoOpened && proactiveEnabled) {
          setAutoOpened(true);
          setOpen(true);
        }
      } catch {
        setBadgeCount(0);
        if (!autoOpened && proactiveEnabled) {
          setAutoOpened(true);
          setOpen(true);
        }
      }
    })();
  }, [user, session]);

  // Load history when opening
  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("agent_chat_messages" as any)
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data && data.length > 0) {
      setMessages(data.map((m: any) => ({
        id: m.id,
        role: m.role as AgentMessage["role"],
        content: m.content,
        created_at: m.created_at,
      })));
    }
  }, [user]);

  // Trigger proactive on first open
  useEffect(() => {
    if (open && !minimized && !hasProactived && user && session && proactiveEnabled) {
      setHasProactived(true);
      loadHistory().then(() => {
        triggerProactive();
      });
    } else if (open && !minimized && !hasProactived && user && session && !proactiveEnabled) {
      setHasProactived(true);
      loadHistory();
    }
  }, [open, minimized, hasProactived, user, session, proactiveEnabled]);

  const cancelStream = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
    setStreamStatus("idle");
  }, []);

  const classifyError = (err: unknown): string => {
    if (err instanceof DOMException && err.name === "AbortError") return "La solicitud tardó demasiado. Intenta de nuevo.";
    if (err instanceof TypeError && err.message.includes("fetch")) return "Sin conexión a internet. Verifica tu red.";
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("429")) return "Demasiadas solicitudes. Espera unos segundos.";
    if (msg.includes("5")) return "Error del servidor. Reintentando...";
    return "Error al procesar tu mensaje. Intenta de nuevo.";
  };

  const fetchWithRetry = async (body: Record<string, unknown>, signal: AbortSignal, timeoutMs: number): Promise<Response> => {
    const doFetch = async () => {
      const timeoutId = setTimeout(() => abortRef.current?.abort(), timeoutMs);
      try {
        const resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session!.access_token}` },
          body: JSON.stringify(body),
          signal,
        });
        clearTimeout(timeoutId);
        return resp;
      } catch (e) { clearTimeout(timeoutId); throw e; }
    };
    try {
      const resp = await doFetch();
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) throw new Error(`Server error ${resp.status}`);
      return resp;
    } catch (firstErr) {
      if (signal.aborted) throw firstErr;
      setStreamStatus("retrying");
      await new Promise(r => setTimeout(r, 2000));
      if (signal.aborted) throw firstErr;
      return doFetch();
    }
  };

  const streamResponse = async (resp: Response, role: "assistant" | "proactive") => {
    if (!resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";

    setMessages(prev => [...prev, { role, content: "" }]);
    setStreamStatus("responding");

    let heartbeatTimer: ReturnType<typeof setTimeout> | null = null;
    const resetHeartbeat = () => {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
      heartbeatTimer = setTimeout(() => abortRef.current?.abort(), 15000);
    };
    resetHeartbeat();

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        resetHeartbeat();
        buffer += decoder.decode(value, { stream: true });

        let newlineIdx: number;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const jsonStr = line.slice(6).trim();
          if (jsonStr === "[DONE]") break;
          try {
            const parsed = JSON.parse(jsonStr);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantContent += delta;
              const content = assistantContent;
              setMessages(prev => {
                const updated = [...prev];
                updated[updated.length - 1] = { ...updated[updated.length - 1], content };
                return updated;
              });
            }
          } catch { /* partial JSON */ }
        }
      }
    } finally {
      if (heartbeatTimer) clearTimeout(heartbeatTimer);
    }
  };

  const triggerProactive = async () => {
    if (streaming || !session || !proactiveEnabled) return;
    setStreaming(true);
    setStreamStatus("connecting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetchWithRetry(
        { mode: "proactive", history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })) },
        controller.signal, 120000,
      );
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "proactive");
    } catch (e) {
      console.error("[AgentChat] Proactive error:", e);
      setMessages(prev => [...prev, { role: "proactive", content: `⚠️ ${classifyError(e)}` }]);
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamStatus("idle");
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming || !session) return;
    const userMsg: AgentMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);
    setStreamStatus("connecting");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const resp = await fetchWithRetry(
        { mode: "chat", message: text, history: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })) },
        controller.signal, 60000,
      );
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "assistant");
    } catch (e) {
      console.error("[AgentChat] Error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: `⚠️ ${classifyError(e)}` }]);
    } finally {
      abortRef.current = null;
      setStreaming(false);
      setStreamStatus("idle");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleRefresh = () => {
    if (!streaming) {
      triggerProactive();
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Chat Panel */}
      <div
        className={cn(
          "fixed bottom-20 right-4 z-[60] lg:bottom-20 lg:right-6",
          "w-[380px] h-[500px] max-h-[70vh]",
          "rounded-2xl border border-border bg-slate-900 shadow-2xl",
          "flex flex-col overflow-hidden",
          "transition-all duration-300 ease-out origin-bottom-right",
          open && !minimized
            ? "scale-100 opacity-100 pointer-events-auto translate-y-0"
            : "scale-90 opacity-0 pointer-events-none translate-y-4"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-slate-800/80">
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-white">JARVIS</span>
          </div>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-white"
              onClick={toggleProactive}
              title={proactiveEnabled ? "Desactivar notificaciones proactivas" : "Activar notificaciones proactivas"}
            >
              {proactiveEnabled ? <Bell className="h-3.5 w-3.5 text-primary" /> : <BellOff className="h-3.5 w-3.5" />}
            </Button>
            {streaming && (
              <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={cancelStream} title="Cancelar">
                <StopCircle className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={handleRefresh} disabled={streaming} title="Nuevo briefing">
              <RefreshCw className={cn("h-3.5 w-3.5", streaming && "animate-spin")} />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={() => setMinimized(true)}>
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-white" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.length === 0 && !streaming && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              {proactiveEnabled ? "Preparando briefing..." : "Escribe un mensaje para comenzar"}
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.role === "proactive"
                  ? "bg-slate-800 text-white border border-primary/30"
                  : "bg-slate-800 text-white"
              )}>
                {msg.role === "proactive" && (
                  <div className="flex items-center gap-1.5 mb-1 text-primary text-xs font-medium">
                    <Bot className="h-3 w-3" /> Briefing proactivo
                  </div>
                )}
                <div className="prose prose-sm prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ol]:mt-1">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {streaming && messages[messages.length - 1]?.content === "" && (
            <div className="flex justify-start">
              <div className="bg-slate-800 rounded-xl px-3 py-2">
                <Loader2 className="h-4 w-4 animate-spin text-primary" />
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border/30 bg-slate-800/50">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Pregunta o pide algo..."
              rows={1}
              className="flex-1 resize-none rounded-lg bg-slate-700 border-0 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-primary/50"
              disabled={streaming}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* FAB - icon only, right-aligned */}
      <div className="fixed bottom-24 right-4 z-[60] lg:bottom-6 lg:right-6">
        <Button
          size="icon"
          className="relative h-14 w-14 rounded-full shadow-lg bg-primary hover:bg-primary/90 text-primary-foreground"
          onClick={() => {
            if (minimized) {
              setMinimized(false);
              setOpen(true);
            } else {
              setOpen(v => !v);
            }
          }}
        >
          <Bot className="h-6 w-6" />
          {badgeCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-destructive text-[10px] font-bold text-white">
              {badgeCount > 9 ? "9+" : badgeCount}
            </span>
          )}
        </Button>
      </div>
    </>
  );
}
