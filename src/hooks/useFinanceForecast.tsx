import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { FinanceTransaction } from "./useFinances";

export interface MonthlyForecast {
  month: string;
  projected_expenses: number;
  projected_income: number;
  projected_savings: number;
}

export interface RecurringExpense {
  category: string;
  amount: number;
  frequency: string;
}

export interface SavingsSuggestion {
  category: string;
  suggestion: string;
  potential_savings: number;
  priority: "alta" | "media" | "baja";
}

export interface ForecastAlert {
  category: string;
  message: string;
  severity: "info" | "warning" | "critical";
}

export interface FinanceForecast {
  monthly_forecast: MonthlyForecast[];
  recurring_expenses: RecurringExpense[];
  savings_suggestions: SavingsSuggestion[];
  alerts: ForecastAlert[];
  summary: string;
}

export interface ForecastResult {
  success: boolean;
  forecast: FinanceForecast | null;
  analyzed_transactions: number;
  total_expenses: number;
  total_income: number;
  error?: string;
}

export const useFinanceForecast = () => {
  const [loading, setLoading] = useState(false);
  const [forecast, setForecast] = useState<FinanceForecast | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateForecast = useCallback(async (
    transactions: FinanceTransaction[],
    monthsToForecast: number = 3
  ): Promise<ForecastResult | null> => {
    if (transactions.length === 0) {
      toast.error("No hay transacciones para analizar");
      return null;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fnError } = await supabase.functions.invoke("finance-forecast", {
        body: {
          transactions: transactions.map(t => ({
            id: t.id,
            transaction_type: t.transaction_type,
            category: t.category,
            subcategory: t.subcategory,
            amount: t.amount,
            transaction_date: t.transaction_date,
            is_recurring: t.is_recurring,
            recurring_frequency: t.recurring_frequency,
            description: t.description,
            vendor: t.vendor,
          })),
          monthsToForecast,
        },
      });

      if (fnError) throw fnError;

      if (data.error) {
        setError(data.error);
        toast.error(data.error);
        return null;
      }

      setForecast(data.forecast);
      toast.success("Previsión generada correctamente");
      return data as ForecastResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error al generar previsión";
      setError(message);
      toast.error(message);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const clearForecast = useCallback(() => {
    setForecast(null);
    setError(null);
  }, []);

  return {
    loading,
    forecast,
    error,
    generateForecast,
    clearForecast,
  };
};
