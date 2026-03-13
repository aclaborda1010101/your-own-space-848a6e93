import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AgentStatus = "healthy" | "degraded" | "offline" | "unknown";

export interface AgentState {
  name: string;
  status: AgentStatus;
  lastSeen?: string;
}

const AGENTS = ["potus", "jarvis", "atlas", "titan"] as const;

const defaultStates = (): Record<string, AgentState> =>
  Object.fromEntries(AGENTS.map((a) => [a, { name: a, status: "unknown" as AgentStatus }]));

export function usePotusAgentSync() {
  const [agents, setAgents] = useState<Record<string, AgentState>>(defaultStates);

  useEffect(() => {
    const channel = supabase.channel("openclaw-agents", {
      config: { broadcast: { self: false } },
    });

    channel.on("broadcast", { event: "heartbeat" }, (payload) => {
      const { agent, status } = payload.payload || {};
      if (!agent) return;
      setAgents((prev) => ({
        ...prev,
        [agent]: {
          name: agent,
          status: (status as AgentStatus) || "healthy",
          lastSeen: new Date().toISOString(),
        },
      }));
    });

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const onlineCount = Object.values(agents).filter((a) => a.status === "healthy").length;

  return { agents, onlineCount };
}
