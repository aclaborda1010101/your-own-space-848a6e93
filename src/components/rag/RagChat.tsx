import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Loader2, Send, ChevronDown, Sparkles, BookOpen } from "lucide-react";
import type { RagProject } from "@/hooks/useRagArchitect";

interface RagChatProps {
  rag: RagProject;
  onQuery: (ragId: string, question: string) => Promise<{
    answer: string;
    sources: Array<{ subdomain: string; excerpt: string; metadata: unknown }>;
    confidence: number;
  }>;
}

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ subdomain: string; excerpt: string }>;
  confidence?: number;
}

export function RagChat({ rag, onQuery }: RagChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const dm = rag.domain_map as Record<string, unknown> | null;
  const validationQueries = dm?.validation_queries as Record<string, string[]> | null;
  const suggestedQueries = validationQueries
    ? Object.values(validationQueries).flat().slice(0, 5)
    : [];

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async (question?: string) => {
    const q = question || input.trim();
    if (!q || loading) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);

    try {
      const result = await onQuery(rag.id, q);
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: result.answer,
          sources: result.sources,
          confidence: result.confidence,
        },
      ]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Error al consultar el RAG. Intenta de nuevo.", confidence: 0 },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Suggested queries */}
      {messages.length === 0 && suggestedQueries.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground flex items-center gap-1">
            <Sparkles className="h-3 w-3" /> Preguntas sugeridas:
          </p>
          <div className="flex flex-wrap gap-2">
            {suggestedQueries.map((q, i) => (
              <Button
                key={i}
                variant="outline"
                size="sm"
                className="text-xs h-auto py-1.5 px-3"
                onClick={() => handleSend(q)}
              >
                {q.length > 80 ? q.slice(0, 80) + "..." : q}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Chat messages */}
      <ScrollArea className="h-[400px] pr-2" ref={scrollRef}>
        <div className="space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <Card className={`max-w-[85%] ${msg.role === "user" ? "bg-primary/10 border-primary/30" : "bg-muted/30"}`}>
                <CardContent className="p-3 text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>

                  {msg.confidence !== undefined && msg.role === "assistant" && (
                    <Badge
                      variant="outline"
                      className={`mt-2 text-xs ${
                        msg.confidence >= 0.7
                          ? "border-green-500/30 text-green-400"
                          : msg.confidence >= 0.4
                            ? "border-yellow-500/30 text-yellow-400"
                            : "border-red-500/30 text-red-400"
                      }`}
                    >
                      Confianza: {Math.round(msg.confidence * 100)}%
                    </Badge>
                  )}

                  {msg.sources && msg.sources.length > 0 && (
                    <Collapsible className="mt-2">
                      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <BookOpen className="h-3 w-3" />
                        <ChevronDown className="h-3 w-3" />
                        {msg.sources.length} fuentes consultadas
                      </CollapsibleTrigger>
                      <CollapsibleContent className="mt-2 space-y-1">
                        {msg.sources.map((src, si) => (
                          <div key={si} className="text-xs bg-background/50 rounded p-2">
                            <span className="font-semibold">{src.subdomain}</span>
                            <p className="text-muted-foreground mt-0.5">{src.excerpt}</p>
                          </div>
                        ))}
                      </CollapsibleContent>
                    </Collapsible>
                  )}
                </CardContent>
              </Card>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <Card className="bg-muted/30">
                <CardContent className="p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Pregunta algo sobre este dominio..."
          disabled={loading}
          className="flex-1"
        />
        <Button onClick={() => handleSend()} disabled={!input.trim() || loading} size="icon">
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
