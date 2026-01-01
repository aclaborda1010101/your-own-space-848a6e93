import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import type { MonthlyComparison } from "./useFinanceHistory";
import type { FinanceGoal } from "./useFinances";

export interface SuggestedGoal {
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  priority: "high" | "medium" | "low";
  reason: string;
  category: string;
}

export interface AutoGoalsResult {
  suggested_goals: SuggestedGoal[];
  analysis_summary: string;
  monthly_savings_potential: number;
}

export const useAutoSavingsGoals = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<AutoGoalsResult | null>(null);

  const generateSuggestions = useCallback(async (
    historyData: MonthlyComparison[],
    existingGoals: FinanceGoal[]
  ): Promise<AutoGoalsResult | null> => {
    if (!user || historyData.length < 2) {
      toast.error("Se necesitan al menos 2 meses de datos para generar sugerencias");
      return null;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("finance-auto-goals", {
        body: {
          historyData,
          existingGoals: existingGoals.map((g) => ({
            name: g.name,
            target_amount: g.target_amount,
            current_amount: g.current_amount,
            status: g.status,
          })),
        },
      });

      if (error) throw error;

      if (data.error) {
        toast.error(data.error);
        return null;
      }

      setSuggestions(data);
      return data as AutoGoalsResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar sugerencias";
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [user]);

  const clearSuggestions = useCallback(() => {
    setSuggestions(null);
  }, []);

  return {
    loading,
    suggestions,
    generateSuggestions,
    clearSuggestions,
  };
};
