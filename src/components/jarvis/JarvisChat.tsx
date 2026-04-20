import { useState, useEffect, useRef, useCallback } from "react";
import { Bot, Send, Loader2, RefreshCw, Mic, MicOff, Radio, Square, Paperclip, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useVoiceRecognition } from "@/hooks/useVoiceRecognition";
import { useJarvisRealtime } from "@/hooks/useJarvisRealtime";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AgentMessage {
  id?: string;
  role: "user" | "assistant" | "proactive";
  content: string;
  created_at?: string;
}

interface JarvisChatProps {
  /**
   * "floating" → compact panel for desktop floating widget.
   * "page"     → full-height layout for the dedicated route.
   */
  variant?: "floating" | "page";
  /** Auto-trigger proactive briefing on first mount (default true on floating, false on page). */
  autoProactive?: boolean;
}

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/jarvis-agent`;

export function JarvisChat({ variant = "page", autoProactive }: JarvisChatProps) {
  const { user, session } = useAuth();
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [hasInit, setHasInit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const shouldAutoProactive = autoProactive ?? variant === "floating";

  // Voice (Whisper STT)
  const voice = useVoiceRecognition({
    onTranscript: (text) => {
      setInput((prev) => (prev ? `${prev} ${text}` : text));
    },
  });

  // Realtime voice (OpenAI Realtime via WebRTC)
  const realtime = useJarvisRealtime({
    onTranscript: (text) => {
      setMessages((prev) => [...prev, { role: "user", content: text }]);
    },
    onResponse: (text) => {
      setMessages((prev) => [...prev, { role: "assistant", content: text }]);
    },
  });

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Load history once
  const loadHistory = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from("agent_chat_messages" as any)
      .select("id, role, content, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })
      .limit(50);
    if (data && data.length > 0) {
      setMessages(
        data.map((m: any) => ({
          id: m.id,
          role: m.role as AgentMessage["role"],
          content: m.content,
          created_at: m.created_at,
        }))
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user || !session || hasInit) return;
    setHasInit(true);
    loadHistory().then(() => {
      if (shouldAutoProactive) triggerProactive();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, session, hasInit]);

  const streamResponse = async (resp: Response, role: "assistant" | "proactive") => {
    if (!resp.body) return;
    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let assistantContent = "";

    setMessages((prev) => [...prev, { role, content: "" }]);

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
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
            setMessages((prev) => {
              const updated = [...prev];
              updated[updated.length - 1] = { ...updated[updated.length - 1], content };
              return updated;
            });
          }
        } catch {
          /* partial JSON */
        }
      }
    }
  };

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
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "proactive");
    } catch (e) {
      console.error("[JarvisChat] Proactive error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "proactive", content: "⚠️ No pude generar el briefing. Intenta de nuevo." },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const sendMessage = async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    if (!text || streaming || !session) return;

    const userMsg: AgentMessage = { role: "user", content: text };
    setMessages((prev) => [...prev, userMsg]);
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
          history: [...messages, userMsg]
            .slice(-10)
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!resp.ok) throw new Error(`Error ${resp.status}`);
      await streamResponse(resp, "assistant");
    } catch (e) {
      console.error("[JarvisChat] Error:", e);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "⚠️ Error al procesar tu mensaje. Intenta de nuevo." },
      ]);
    } finally {
      setStreaming(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleMicClick = async () => {
    if (voice.isRecording) {
      const text = await voice.stopRecording();
      if (text) {
        await sendMessage(text);
      }
    } else {
      await voice.startRecording();
    }
  };

  const handleRealtimeToggle = async () => {
    if (realtime.isActive) {
      realtime.stopSession();
      toast.info("Modo en vivo desactivado");
    } else {
      try {
        await realtime.startSession();
        toast.success("Modo en vivo activado — habla con JARVIS");
      } catch (e) {
        console.error("[JarvisChat] Realtime start failed:", e);
        toast.error("No se pudo iniciar el modo en vivo");
      }
    }
  };

  if (!user) return null;

  const isFloating = variant === "floating";

  return (
    <div className={cn("flex flex-col bg-background", isFloating ? "h-full" : "h-full")}>
      {/* Header */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border/40 bg-card/60 backdrop-blur",
          isFloating ? "px-4 py-3" : "px-4 py-3 md:px-6"
        )}
      >
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/15 border border-primary/40">
            <Bot className="h-4 w-4 text-primary" />
          </div>
          <div className="leading-tight">
            <div className="text-sm font-semibold">JARVIS</div>
            <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {realtime.isActive
                ? `voz · ${realtime.state}`
                : streaming
                ? "respondiendo…"
                : "listo"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => triggerProactive()}
            disabled={streaming}
            title="Nuevo briefing"
          >
            <RefreshCw className={cn("h-4 w-4", streaming && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">
            Escribe, dicta o activa el modo en vivo para hablar con JARVIS.
          </div>
        )}
        {messages.map((msg, i) => (
          <div
            key={msg.id ?? i}
            className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}
          >
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-md"
                  : msg.role === "proactive"
                  ? "bg-card border border-primary/30 rounded-bl-md"
                  : "bg-muted rounded-bl-md"
              )}
            >
              {msg.role === "proactive" && (
                <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-primary">
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
            <div className="rounded-2xl bg-muted px-3 py-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
            </div>
          </div>
        )}
      </div>

      {/* Realtime status banner */}
      {realtime.isActive && (
        <div className="border-t border-border/40 bg-primary/5 px-4 py-2 text-xs text-primary flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Modo en vivo · {realtime.state}
          {realtime.transcript && (
            <span className="ml-2 truncate text-muted-foreground">"{realtime.transcript}"</span>
          )}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/40 bg-card/40 p-3">
        <div className="flex items-end gap-2">
          {/* Mic (Whisper) */}
          <Button
            type="button"
            variant={voice.isRecording ? "destructive" : "outline"}
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleMicClick}
            disabled={streaming || voice.state === "processing" || realtime.isActive}
            title={voice.isRecording ? "Detener y transcribir" : "Dictar"}
          >
            {voice.state === "processing" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : voice.isRecording ? (
              <MicOff className="h-4 w-4" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>

          {/* Realtime toggle */}
          <Button
            type="button"
            variant={realtime.isActive ? "destructive" : "outline"}
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={handleRealtimeToggle}
            disabled={voice.isRecording || streaming}
            title={realtime.isActive ? "Detener modo en vivo" : "Hablar en vivo con JARVIS"}
          >
            {realtime.state === "connecting" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : realtime.isActive ? (
              <Square className="h-4 w-4" />
            ) : (
              <Radio className="h-4 w-4" />
            )}
          </Button>

          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              realtime.isActive ? "Modo en vivo activo · habla con JARVIS" : "Pregunta o pide algo…"
            }
            rows={1}
            className="flex-1 resize-none rounded-xl bg-muted border border-border/40 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 max-h-32"
            disabled={streaming || realtime.isActive}
          />

          <Button
            type="button"
            size="icon"
            className="h-10 w-10 shrink-0"
            onClick={() => sendMessage()}
            disabled={!input.trim() || streaming || realtime.isActive}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export default JarvisChat;
