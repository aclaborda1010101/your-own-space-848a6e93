import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Bot, Loader2, MessageSquare, Send, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

async function streamChat(
  messages: ChatMessage[],
  action: "chat" | "proactive_summary",
  onToken: (token: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
) {
  const url = `${SUPABASE_URL}/functions/v1/openclaw-chat`;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SUPABASE_KEY}`,
        apikey: SUPABASE_KEY,
      },
      body: JSON.stringify({ messages, action }),
    });

    if (!res.ok) {
      const text = await res.text();
      onError(`Error ${res.status}: ${text.slice(0, 200)}`);
      return;
    }

    const reader = res.body?.getReader();
    if (!reader) { onError("No stream"); return; }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") { onDone(); return; }
        try {
          const parsed = JSON.parse(data);
          const delta = parsed.choices?.[0]?.delta?.content;
          if (delta) onToken(delta);
        } catch { /* skip malformed */ }
      }
    }
    onDone();
  } catch (err) {
    onError((err as Error).message);
  }
}

export default function OpenClawChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [proactiveDone, setProactiveDone] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamContentRef = useRef("");
  const { toast } = useToast();

  // Auto-scroll
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streaming]);

  // Proactive summary on first open
  const triggerProactive = useCallback(() => {
    if (proactiveDone || streaming) return;
    setProactiveDone(true);
    setStreaming(true);
    streamContentRef.current = "";

    setMessages([{ role: "assistant", content: "" }]);

    streamChat(
      [],
      "proactive_summary",
      (token) => {
        streamContentRef.current += token;
        setMessages([{ role: "assistant", content: streamContentRef.current }]);
      },
      () => setStreaming(false),
      (err) => {
        setStreaming(false);
        toast({ title: "Error del agente", description: err, variant: "destructive" });
        setMessages([{ role: "assistant", content: `⚠️ Error conectando con el agente: ${err}` }]);
      },
    );
  }, [proactiveDone, streaming, toast]);

  useEffect(() => {
    if (open && !proactiveDone) triggerProactive();
  }, [open, proactiveDone, triggerProactive]);

  const sendMessage = useCallback(() => {
    if (!input.trim() || streaming) return;
    const userMsg: ChatMessage = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMsg];
    setMessages([...newMessages, { role: "assistant", content: "" }]);
    setInput("");
    setStreaming(true);
    streamContentRef.current = "";

    streamChat(
      newMessages,
      "chat",
      (token) => {
        streamContentRef.current += token;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: streamContentRef.current };
          return copy;
        });
      },
      () => setStreaming(false),
      (err) => {
        setStreaming(false);
        toast({ title: "Error", description: err, variant: "destructive" });
      },
    );
  }, [input, messages, streaming, toast]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Toggle button */}
      <Button
        onClick={() => setOpen(!open)}
        size="sm"
        variant={open ? "default" : "outline"}
        className="gap-2"
      >
        <MessageSquare className="h-4 w-4" />
        Agente IA
      </Button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex w-[400px] max-w-[calc(100vw-2rem)] flex-col rounded-xl border border-border bg-card shadow-2xl" style={{ height: "520px" }}>
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">OpenClaw Agent</p>
                <p className="text-[10px] text-muted-foreground">GPT-4o · Proactivo</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 px-4 py-3" ref={scrollRef as any}>
            <div className="space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={cn("flex", msg.role === "user" ? "justify-end" : "justify-start")}>
                  <div
                    className={cn(
                      "max-w-[85%] rounded-xl px-3 py-2 text-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground",
                    )}
                  >
                    {msg.role === "assistant" ? (
                      <div className="prose prose-sm dark:prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        <ReactMarkdown>{msg.content || (streaming && i === messages.length - 1 ? "⏳" : "")}</ReactMarkdown>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))}
              {streaming && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  Generando...
                </div>
              )}
            </div>
          </ScrollArea>

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pregunta al agente..."
                className="min-h-[40px] max-h-[100px] resize-none text-sm"
                rows={1}
                disabled={streaming}
              />
              <Button size="icon" className="h-10 w-10 shrink-0" onClick={sendMessage} disabled={!input.trim() || streaming}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
