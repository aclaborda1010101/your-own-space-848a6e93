import { useState, useEffect, useRef, useCallback } from "react";
import { Brain, X, Minus, Send, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";

interface AgentMessage {
  id?: string;
  role: "user" | "assistant" | "proactive";
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-agent`;

export function AgentChatFloat() {
  const { user, session } = useAuth();
  const [open, setOpen] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [badgeCount, setBadgeCount] = useState(0);
  const [hasProactived, setHasProactived] = useState(false);
  const [autoOpened, setAutoOpened] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

        // Auto-open on first load if not already done this session
        if (!autoOpened) {
          setAutoOpened(true);
          setOpen(true);
        }
      } catch {
        setBadgeCount(0);
        if (!autoOpened) {
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
    if (open && !minimized && !hasProactived && user && session) {
      setHasProactived(true);
      loadHistory().then(() => {
        triggerProactive();
      });
    }
  }, [open, minimized, hasProactived, user, session]);

  const triggerProactive = async () => {
    if (streaming || !session) return;
    setStreaming(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: "proactive",
          history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "proactive");
    } catch (e) {
      console.error("[AgentChat] Proactive error:", e);
      setMessages(prev => [...prev, {
        role: "proactive",
        content: "⚠️ No pude generar el briefing. Intenta de nuevo.",
      }]);
    } finally {
      setStreaming(false);
    }
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || streaming || !session) return;

    const userMsg: AgentMessage = { role: "user", content: text };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setStreaming(true);

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          mode: "chat",
          message: text,
          history: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });

      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "assistant");
    } catch (e) {
      console.error("[AgentChat] Error:", e);
      setMessages(prev => [...prev, {
        role: "assistant",
        content: "⚠️ Error al procesar tu mensaje. Intenta de nuevo.",
      }]);
    } finally {
      setStreaming(false);
    }
  };

  const streamResponse = async (resp: Response, role: "assistant" | "proactive") => {
    if (!resp.body) return;

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";

    setMessages(prev => [...prev, { role, content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

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
            <Brain className="h-4 w-4 text-amber-400" />
            <span className="text-sm font-semibold text-white">JARVIS Agent</span>
          </div>
          <div className="flex items-center gap-1">
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
              Preparando briefing...
            </div>
          )}
          {messages.map((msg, i) => (
            <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
              <div className={cn(
                "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : msg.role === "proactive"
                  ? "bg-slate-800 text-white border border-amber-500/30"
                  : "bg-slate-800 text-white"
              )}>
                {msg.role === "proactive" && (
                  <div className="flex items-center gap-1.5 mb-1 text-amber-400 text-xs font-medium">
                    <Brain className="h-3 w-3" /> Briefing proactivo
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
                <Loader2 className="h-4 w-4 animate-spin text-amber-400" />
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
              className="flex-1 resize-none rounded-lg bg-slate-700 border-0 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-amber-500/50"
              disabled={streaming}
            />
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-amber-500 hover:bg-amber-600 text-slate-900"
              onClick={sendMessage}
              disabled={!input.trim() || streaming}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* FAB */}
      <div className="fixed bottom-24 right-20 z-[60] lg:bottom-6 lg:right-24">
        <Button
          size="lg"
          className="relative h-14 rounded-full px-5 shadow-lg gap-2 bg-amber-500 hover:bg-amber-600 text-slate-900"
          onClick={() => {
            if (minimized) {
              setMinimized(false);
              setOpen(true);
            } else {
              setOpen(v => !v);
            }
          }}
        >
          <Brain className="h-5 w-5" />
          Agent
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
