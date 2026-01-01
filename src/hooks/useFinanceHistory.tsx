import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import type { FinanceTransaction } from "./useFinances";

export interface MonthlyComparison {
  month: string;
  monthLabel: string;
  totalIncome: number;
  totalExpenses: number;
  netCashflow: number;
  expensesByCategory: Record<string, number>;
  transactionCount: number;
}

export const useFinanceHistory = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [history, setHistory] = useState<MonthlyComparison[]>([]);

  const fetchMonthlyHistory = useCallback(async (monthsToFetch: number = 6) => {
    if (!user) return [];

    setLoading(true);
    try {
      const now = new Date();
      const results: { month: Date; data: FinanceTransaction[] }[] = [];

      for (let i = 0; i < monthsToFetch; i++) {
        const targetMonth = subMonths(now, i);
        const monthStart = format(startOfMonth(targetMonth), "yyyy-MM-dd");
        const monthEnd = format(endOfMonth(targetMonth), "yyyy-MM-dd");

        const { data, error } = await supabase
          .from("finance_transactions")
          .select("*")
          .eq("user_id", user.id)
          .gte("transaction_date", monthStart)
          .lte("transaction_date", monthEnd);

        if (error) throw error;
        results.push({ month: targetMonth, data: (data || []) as FinanceTransaction[] });
      }

      const monthlyData: MonthlyComparison[] = results.map(({ month, data }) => {
        const totalIncome = data
          .filter((t) => t.transaction_type === "income" && t.invoice_status !== "pending")
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const totalExpenses = data
          .filter((t) => t.transaction_type === "expense")
          .reduce((sum, t) => sum + Number(t.amount), 0);

        const expensesByCategory = data
          .filter((t) => t.transaction_type === "expense")
          .reduce((acc, t) => {
            acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
            return acc;
          }, {} as Record<string, number>);

        return {
          month: format(month, "yyyy-MM"),
          monthLabel: format(month, "MMM yyyy"),
          totalIncome,
          totalExpenses,
          netCashflow: totalIncome - totalExpenses,
          expensesByCategory,
          transactionCount: data.length,
        };
      });

      // Sort by date ascending (oldest first)
      monthlyData.sort((a, b) => a.month.localeCompare(b.month));
      setHistory(monthlyData);
      return monthlyData;
    } catch (error) {
      console.error("Error fetching finance history:", error);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  return {
    history,
    loading,
    fetchMonthlyHistory,
  };
};
