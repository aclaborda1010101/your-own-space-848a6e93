import { useEffect, useRef, useState, useCallback } from "react";
import { Bot, Send, Loader2, RefreshCw, BellOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import ReactMarkdown from "react-markdown";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";

interface AgentMessage {
  id?: string;
  role: "user" | "assistant" | "proactive";
  content: string;
  created_at?: string;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-agent`;
const PROACTIVE_KEY = "jarvis-proactive-enabled";

export default function JarvisPage() {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasProactived, setHasProactived] = useState(false);
  const [proactiveEnabled, setProactiveEnabled] = useState(() => {
    try { return localStorage.getItem(PROACTIVE_KEY) !== "false"; } catch { return true; }
  });
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { document.title = "JARVIS · Chat"; }, []);

  const toggleProactive = useCallback(() => {
    setProactiveEnabled(prev => {
      const next = !prev;
      try { localStorage.setItem(PROACTIVE_KEY, String(next)); } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

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

  useEffect(() => {
    if (!user || !session || hasProactived) return;
    setHasProactived(true);
    loadHistory().then(() => {
      if (proactiveEnabled) triggerProactive();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session]);

  const triggerProactive = async () => {
    if (streaming || !session || !proactiveEnabled) return;
    setStreaming(true);
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ mode: "proactive", history: messages.slice(-10).map(m => ({ role: m.role, content: m.content })) }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "proactive");
    } catch (e) {
      console.error("[JarvisPage] Proactive error:", e);
      setMessages(prev => [...prev, { role: "proactive", content: "⚠️ No pude generar el briefing. Intenta de nuevo." }]);
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({
          mode: "chat",
          message: text,
          history: [...messages, userMsg].slice(-10).map(m => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "assistant");
    } catch (e) {
      console.error("[JarvisPage] Error:", e);
      setMessages(prev => [...prev, { role: "assistant", content: "⚠️ Error al procesar tu mensaje. Intenta de nuevo." }]);
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

  if (!user) return null;

  return (
    <main className="flex flex-col h-[calc(100dvh-4rem)] lg:h-[calc(100dvh-5rem)] p-3 sm:p-4 lg:p-6">
      <div className="hidden lg:block mb-3">
        <Breadcrumbs />
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-xl bg-primary/15 border border-primary/40 flex items-center justify-center">
            <Bot className="h-5 w-5 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="font-mono text-sm tracking-wider text-foreground">JARVIS</div>
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Asistente personal
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={toggleProactive}
            title={proactiveEnabled ? "Desactivar briefing proactivo" : "Activar briefing proactivo"}
          >
            {proactiveEnabled ? <Bell className="h-4 w-4 text-primary" /> : <BellOff className="h-4 w-4" />}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => triggerProactive()}
            disabled={streaming}
            title="Nuevo briefing"
          >
            <RefreshCw className={cn("h-4 w-4", streaming && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto rounded-2xl border border-border/50 bg-card/40 backdrop-blur-sm p-3 sm:p-4 space-y-3"
      >
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
                ? "bg-muted text-foreground border border-primary/30"
                : "bg-muted text-foreground"
            )}>
              {msg.role === "proactive" && (
                <div className="flex items-center gap-1.5 mb-1 text-primary text-xs font-medium">
                  <Bot className="h-3 w-3" /> Briefing proactivo
                </div>
              )}
              <div className="prose prose-sm dark:prose-invert max-w-none [&>p]:m-0 [&>ul]:mt-1 [&>ol]:mt-1">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {streaming && messages[messages.length - 1]?.content === "" && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-xl px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="mt-3 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-2">
        <div className="flex gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pregunta o pide algo..."
            rows={1}
            className="flex-1 resize-none rounded-lg bg-background border border-border/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
            disabled={streaming}
          />
          <Button
            size="icon"
            className="h-10 w-10 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
            onClick={sendMessage}
            disabled={!input.trim() || streaming}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </main>
  );
}
