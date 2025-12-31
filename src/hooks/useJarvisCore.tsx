import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface TimeBlock {
  time: string;
  endTime: string;
  title: string;
  type: "work" | "health" | "life" | "family" | "rest";
  description: string;
  priority: "high" | "medium" | "low";
  isFlexible: boolean;
}

export interface DailyPlan {
  greeting: string;
  analysis: {
    capacityLevel: "alta" | "media" | "baja";
    recommendation: string;
    warnings: string[];
  };
  timeBlocks: TimeBlock[];
  tips: string[];
  eveningReflection: string;
}

interface CheckInData {
  energy: number;
  mood: number;
  focus: number;
  availableTime: number;
  interruptionRisk: string;
  dayMode: string;
}

interface Task {
  id: string;
  title: string;
  type: string;
  priority: string;
  duration: number;
}

interface CalendarEvent {
  title: string;
  time: string;
  duration: string;
  type: string;
}

export const useJarvisCore = () => {
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatePlan = useCallback(async (
    checkIn: CheckInData,
    tasks: Task[],
    calendarEvents: CalendarEvent[]
  ) => {
    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('jarvis-core', {
        body: { checkIn, tasks, calendarEvents },
      });

      if (fnError) throw fnError;

      if (data.error) {
        throw new Error(data.error);
      }

      setPlan(data.plan);
      return data.plan;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al generar el plan";
      console.error("JARVIS Core error:", err);
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
        toast.error("Error al generar el plan", {
          description: message,
        });
      }
      
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearPlan = useCallback(() => {
    setPlan(null);
    setError(null);
  }, []);

  return {
    plan,
    loading,
    error,
    generatePlan,
    clearPlan,
  };
};
