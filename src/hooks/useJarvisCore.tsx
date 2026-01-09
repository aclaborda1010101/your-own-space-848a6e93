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
  linkedTask?: string | null;
}

export interface Decision {
  rule: string;
  action: string;
  reason: string;
}

export interface Diagnosis {
  currentState: string;
  dayMode: "survival" | "balanced" | "push" | "recovery";
  modeReason: string;
  capacityLevel: "alta" | "media" | "baja";
  riskFactors: string[];
  opportunities: string[];
}

export interface NextSteps {
  immediate: string;
  today: string;
  evening: string;
}

export interface DailyPlan {
  greeting: string;
  diagnosis: Diagnosis;
  decisions: Decision[];
  secretaryActions: string[];
  timeBlocks: TimeBlock[];
  nextSteps: NextSteps;
  tips: string[];
  warnings: string[];
  // Legacy fields for backwards compatibility
  analysis?: {
    capacityLevel: "alta" | "media" | "baja";
    recommendation: string;
    warnings: string[];
  };
  eveningReflection?: string;
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
  const [loading, setLoading] = useState<boolean>(false);
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

      // Normalize plan for backwards compatibility
      const normalizedPlan = normalizePlan(data.plan);
      setPlan(normalizedPlan);
      return normalizedPlan;
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

// Normalize plan to ensure all fields exist
function normalizePlan(plan: Partial<DailyPlan>): DailyPlan {
  return {
    greeting: plan.greeting || "¡Buenos días!",
    diagnosis: plan.diagnosis || {
      currentState: "Estado no determinado",
      dayMode: "balanced",
      modeReason: "Modo por defecto",
      capacityLevel: "media",
      riskFactors: [],
      opportunities: [],
    },
    decisions: plan.decisions || [],
    secretaryActions: plan.secretaryActions || [],
    timeBlocks: plan.timeBlocks || [],
    nextSteps: plan.nextSteps || {
      immediate: "Revisa tu plan del día",
      today: "Completa las tareas prioritarias",
      evening: "Reflexiona sobre lo logrado",
    },
    tips: plan.tips || [],
    warnings: plan.warnings || plan.analysis?.warnings || [],
    // Legacy support
    analysis: plan.analysis || {
      capacityLevel: plan.diagnosis?.capacityLevel || "media",
      recommendation: plan.diagnosis?.currentState || "",
      warnings: plan.warnings || [],
    },
    eveningReflection: plan.eveningReflection || plan.nextSteps?.evening || "",
  };
}
