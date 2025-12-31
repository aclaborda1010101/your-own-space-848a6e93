import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";

export interface EmotionalState {
  energy: number;
  mood: number;
  stress: number;
  anxiety: number;
  motivation: number;
}

export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

export interface CoachSession {
  id?: string;
  sessionType: "daily" | "weekly" | "intervention";
  protocol: string | null;
  emotionalState: EmotionalState;
  messages: CoachMessage[];
  summary?: string;
  nextSteps?: string;
}

interface SessionContext {
  emotionalState: EmotionalState;
  recentTopics: string[];
  previousInsights: string[];
  currentProtocol: string | null;
  dayMode: string;
  checkInData?: {
    energy: number;
    mood: number;
    focus: number;
  };
}

const DEFAULT_EMOTIONAL_STATE: EmotionalState = {
  energy: 5,
  mood: 5,
  stress: 5,
  anxiety: 3,
  motivation: 5,
};

export const useJarvisCoach = () => {
  const { user } = useAuth();
  const [session, setSession] = useState<CoachSession | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startSession = useCallback((
    sessionType: "daily" | "weekly" | "intervention" = "daily",
    emotionalState: EmotionalState = DEFAULT_EMOTIONAL_STATE
  ) => {
    setSession({
      sessionType,
      protocol: null,
      emotionalState,
      messages: [],
    });
    setError(null);
  }, []);

  const sendMessage = useCallback(async (
    userMessage: string,
    context?: Partial<SessionContext>
  ) => {
    if (!session) {
      toast.error("No hay sesión activa");
      return null;
    }

    setLoading(true);
    setError(null);

    // Add user message to session
    const updatedMessages: CoachMessage[] = [
      ...session.messages,
      { role: "user", content: userMessage, timestamp: new Date() },
    ];

    setSession(prev => prev ? { ...prev, messages: updatedMessages } : null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-coach', {
        body: {
          messages: updatedMessages.map(m => ({ role: m.role, content: m.content })),
          emotionalState: session.emotionalState,
          context: {
            emotionalState: session.emotionalState,
            recentTopics: context?.recentTopics || [],
            previousInsights: context?.previousInsights || [],
            currentProtocol: session.protocol,
            dayMode: context?.dayMode || "balanced",
            checkInData: context?.checkInData,
          },
          sessionType: session.sessionType,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      // Add assistant response to session
      const assistantMessage: CoachMessage = {
        role: "assistant",
        content: data.message,
        timestamp: new Date(),
      };

      setSession(prev => prev ? {
        ...prev,
        messages: [...updatedMessages, assistantMessage],
        protocol: data.protocol || prev.protocol,
      } : null);

      return data.message;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error en la sesión de coaching";
      console.error("JARVIS Coach error:", err);
      setError(message);
      
      if (message.includes("429") || message.includes("límite")) {
        toast.error("Límite de uso alcanzado", {
          description: "Intenta de nuevo en unos minutos",
        });
      } else if (message.includes("402") || message.includes("créditos")) {
        toast.error("Créditos agotados", {
          description: "Recarga tu cuenta para continuar",
        });
      } else {
        toast.error("Error en coaching", {
          description: message,
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, [session]);

  const updateEmotionalState = useCallback((state: Partial<EmotionalState>) => {
    setSession(prev => prev ? {
      ...prev,
      emotionalState: { ...prev.emotionalState, ...state },
    } : null);
  }, []);

  const saveSession = useCallback(async () => {
    if (!session || !user) {
      return null;
    }

    try {
      const insertData = {
        user_id: user.id,
        session_type: session.sessionType,
        protocol: session.protocol,
        emotional_state: session.emotionalState,
        messages: session.messages,
        summary: session.summary,
        next_steps: session.nextSteps,
      };

      const { data, error: saveError } = await supabase
        .from('coach_sessions')
        .insert(insertData as never)
        .select()
        .single();

      if (saveError) throw saveError;

      toast.success("Sesión guardada");
      return data;
    } catch (err) {
      console.error("Error saving session:", err);
      toast.error("Error al guardar la sesión");
      return null;
    }
  }, [session, user]);

  const endSession = useCallback(async () => {
    if (session && session.messages.length > 0) {
      await saveSession();
    }
    setSession(null);
    setError(null);
  }, [session, saveSession]);

  const getRecentSessions = useCallback(async (limit: number = 5) => {
    if (!user) return [];

    try {
      const { data, error } = await supabase
        .from('coach_sessions')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (err) {
      console.error("Error fetching sessions:", err);
      return [];
    }
  }, [user]);

  return {
    session,
    loading,
    error,
    startSession,
    sendMessage,
    updateEmotionalState,
    saveSession,
    endSession,
    getRecentSessions,
  };
};
