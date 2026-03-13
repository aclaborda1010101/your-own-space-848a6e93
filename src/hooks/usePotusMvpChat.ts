import { useCallback, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PotusChatRole = "user" | "assistant";
export type PotusChatStatus = "idle" | "sending" | "error";

export interface PotusChatMessage {
  id: string;
  role: PotusChatRole;
  content: string;
  createdAt: string;
}

const createMessage = (role: PotusChatRole, content: string): PotusChatMessage => ({
  id: crypto.randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
});

export function usePotusMvpChat() {
  const [messages, setMessages] = useState<PotusChatMessage[]>([]);
  const [status, setStatus] = useState<PotusChatStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [conversationKey, setConversationKey] = useState<string | null>(null);
  const [surfaces, setSurfaces] = useState<string[]>(["app"]);

  const sendMessage = useCallback(async (input: string) => {
    const content = input.trim();
    if (!content || status === "sending") return;

    const nextUserMessage = createMessage("user", content);
    const nextMessages = [...messages, nextUserMessage];

    setMessages(nextMessages);
    setStatus("sending");
    setError(null);

    try {
      const payloadMessages = nextMessages.slice(-10).map(({ role, content }) => ({ role, content }));
      let data: any = null;
      const bridgeBase = `${window.location.protocol}//${window.location.hostname}:8788`;
      try {
        const bridgeRes = await fetch(`${bridgeBase}/api/potus/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: content, messages: payloadMessages }),
        });
        if (bridgeRes.ok) {
          data = await bridgeRes.json();
        } else {
          throw new Error("bridge unavailable");
        }
      } catch {
        const fallback = await supabase.functions.invoke("potus-core", {
          body: {
            action: "chat",
            message: content,
            messages: payloadMessages,
            platform: "app",
          },
        });
        if (fallback.error) throw fallback.error;
        data = fallback.data;
      }

      const reply = data?.message || data?.response || "Sin respuesta";

      setMessages((current) => [...current, createMessage("assistant", reply)]);
      setConversationKey(data?.conversationKey || null);
      setSurfaces(Array.isArray(data?.surfaces) && data.surfaces.length > 0 ? data.surfaces : ["app"]);
      setStatus("idle");
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo completar la petición";
      setStatus("error");
      setError(message);
      setMessages((current) => [
        ...current,
        createMessage("assistant", "No he podido responder ahora mismo. Reintenta en unos segundos."),
      ]);
    }
  }, [messages, status]);

  const reset = useCallback(() => {
    setMessages([]);
    setStatus("idle");
    setError(null);
    setConversationKey(null);
    setSurfaces(["app"]);
  }, []);

  const statusLabel = useMemo(() => {
    if (status === "sending") return "respondiendo";
    if (status === "error") return "error";
    return messages.length > 0 ? "listo" : "sin iniciar";
  }, [messages.length, status]);

  return {
    messages,
    status,
    statusLabel,
    error,
    conversationKey,
    surfaces,
    sendMessage,
    reset,
  };
}
