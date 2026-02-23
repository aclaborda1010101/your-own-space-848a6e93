import { useState, useRef, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Send, AlertCircle } from "lucide-react";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: Array<{ subdomain: string; excerpt: string }>;
}

export default function RagEmbed() {
  const { ragId } = useParams<{ ragId: string }>();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ragTitle, setRagTitle] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Validate token on mount
  useEffect(() => {
    if (!token || !ragId) {
      setError("Token o RAG ID no proporcionado");
      return;
    }
    // Try a test query to validate
    setRagTitle("Base de Conocimiento");
  }, [token, ragId]);

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading || !ragId || !token) return;

    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: q }]);
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("rag-architect", {
        body: { action: "public_query", ragId, question: q, apiKey: token },
      });

      if (fnError) throw fnError;
      if (data?.error) throw new Error(data.error);

      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.answer,
          sources: data.sources,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al consultar";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950 text-gray-300 p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="h-10 w-10 mx-auto text-red-400" />
          <p className="text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 px-4 py-3 flex items-center gap-2">
        <div className="h-2 w-2 rounded-full bg-emerald-400" />
        <span className="text-sm font-medium text-gray-300">{ragTitle}</span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="text-center text-gray-500 text-sm mt-20">
            <p>Pregunta algo sobre esta base de conocimiento</p>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                msg.role === "user"
                  ? "bg-emerald-600/20 text-emerald-100 border border-emerald-600/30"
                  : "bg-gray-800/60 text-gray-200 border border-gray-700/50"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-700/30 space-y-1">
                  {msg.sources.map((src, si) => (
                    <p key={si} className="text-xs text-gray-500">
                      📄 {src.subdomain}: {src.excerpt.slice(0, 100)}...
                    </p>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800/60 rounded-xl px-4 py-3 border border-gray-700/50">
              <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Escribe tu pregunta..."
          disabled={loading}
          className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-emerald-500/50"
        />
        <button
          onClick={handleSend}
          disabled={!input.trim() || loading}
          className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg px-3 py-2 text-white transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </div>

      {/* Powered by */}
      <div className="text-center py-1.5 text-[10px] text-gray-600">
        Powered by RAG Architect
      </div>
    </div>
  );
}
