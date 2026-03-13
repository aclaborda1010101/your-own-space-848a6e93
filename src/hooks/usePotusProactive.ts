import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface ProactiveMessage {
  id: string;
  content: string;
  timestamp: string;
  source?: string;
}

export function usePotusProactive(onOpen?: () => void) {
  const [proactiveMessage, setProactiveMessage] = useState<ProactiveMessage | null>(null);
  const [hasUnread, setHasUnread] = useState(false);
  const openRef = useRef(onOpen);
  openRef.current = onOpen;

  useEffect(() => {
    const channel = supabase.channel("potus-proactive", {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "proactive" }, (payload) => {
      const msg: ProactiveMessage = {
        id: crypto.randomUUID(),
        content: payload.payload?.message || payload.payload?.content || "",
        timestamp: new Date().toISOString(),
        source: payload.payload?.source || "system",
      };
      if (!msg.content) return;
      setProactiveMessage(msg);
      setHasUnread(true);
      openRef.current?.();
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const dismiss = useCallback(() => {
    setProactiveMessage(null);
    setHasUnread(false);
  }, []);

  const markRead = useCallback(() => {
    setHasUnread(false);
  }, []);

  return { proactiveMessage, hasUnread, dismiss, markRead };
}
