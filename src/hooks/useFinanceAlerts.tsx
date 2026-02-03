import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { differenceInDays, parseISO } from "date-fns";
import { useDismissedAlerts } from "./useDismissedAlerts";

export interface FinanceAlert {
  id: string;
  type: "invoice_due" | "invoice_overdue" | "goal_deadline" | "goal_progress";
  title: string;
  message: string;
  priority: "high" | "medium" | "low";
  dueDate?: string;
  amount?: number;
  entityId: string;
  entityType: "invoice" | "goal";
}

export const useFinanceAlerts = () => {
  const { user } = useAuth();
  const [alerts, setAlerts] = useState<FinanceAlert[]>([]);
  const [loading, setLoading] = useState(false);
  const { dismissAlert, isDismissed, clearDismissed } = useDismissedAlerts();

  const checkAlerts = useCallback(async () => {
    if (!user) return;

    setLoading(true);
    try {
      const today = new Date();
      const newAlerts: FinanceAlert[] = [];

      // Fetch pending invoices with due dates
      const { data: invoices, error: invoicesError } = await supabase
        .from("finance_transactions")
        .select("*")
        .eq("user_id", user.id)
        .eq("invoice_status", "pending")
        .not("due_date", "is", null);

      if (invoicesError) throw invoicesError;

      // Check invoice due dates
      for (const invoice of invoices || []) {
        const dueDate = parseISO(invoice.due_date!);
        const daysUntilDue = differenceInDays(dueDate, today);

        if (daysUntilDue < 0) {
          // Overdue
          newAlerts.push({
            id: `invoice-overdue-${invoice.id}`,
            type: "invoice_overdue",
            title: "Factura vencida",
            message: `La factura ${invoice.invoice_number || invoice.description} venció hace ${Math.abs(daysUntilDue)} días`,
            priority: "high",
            dueDate: invoice.due_date!,
            amount: invoice.amount,
            entityId: invoice.id,
            entityType: "invoice",
          });
        } else if (daysUntilDue <= 7) {
          // Due soon (within 7 days)
          newAlerts.push({
            id: `invoice-due-${invoice.id}`,
            type: "invoice_due",
            title: "Factura próxima a vencer",
            message: daysUntilDue === 0 
              ? `La factura ${invoice.invoice_number || invoice.description} vence hoy`
              : `La factura ${invoice.invoice_number || invoice.description} vence en ${daysUntilDue} días`,
            priority: daysUntilDue <= 2 ? "high" : "medium",
            dueDate: invoice.due_date!,
            amount: invoice.amount,
            entityId: invoice.id,
            entityType: "invoice",
          });
        }
      }

      // Fetch active goals with deadlines
      const { data: goals, error: goalsError } = await supabase
        .from("finance_goals")
        .select("*")
        .eq("user_id", user.id)
        .eq("status", "active")
        .not("deadline", "is", null);

      if (goalsError) throw goalsError;

      // Check goal deadlines and progress
      for (const goal of goals || []) {
        const deadline = parseISO(goal.deadline!);
        const daysUntilDeadline = differenceInDays(deadline, today);
        const progress = (goal.current_amount / goal.target_amount) * 100;

        if (daysUntilDeadline <= 30 && daysUntilDeadline > 0) {
          if (progress < 50) {
            // Goal at risk - less than 50% progress with less than 30 days
            newAlerts.push({
              id: `goal-progress-${goal.id}`,
              type: "goal_progress",
              title: "Meta en riesgo",
              message: `"${goal.name}" solo tiene ${progress.toFixed(0)}% de progreso y quedan ${daysUntilDeadline} días`,
              priority: daysUntilDeadline <= 7 ? "high" : "medium",
              dueDate: goal.deadline!,
              amount: goal.target_amount - goal.current_amount,
              entityId: goal.id,
              entityType: "goal",
            });
          } else if (daysUntilDeadline <= 7) {
            // Deadline reminder
            newAlerts.push({
              id: `goal-deadline-${goal.id}`,
              type: "goal_deadline",
              title: "Recordatorio de meta",
              message: `La meta "${goal.name}" vence en ${daysUntilDeadline} días (${progress.toFixed(0)}% completado)`,
              priority: progress >= 90 ? "low" : "medium",
              dueDate: goal.deadline!,
              amount: goal.target_amount - goal.current_amount,
              entityId: goal.id,
              entityType: "goal",
            });
          }
        }
      }

      // Filter out dismissed alerts (now persisted in database)
      const filteredAlerts = newAlerts.filter(a => !isDismissed(`finance-${a.id}`));
      setAlerts(filteredAlerts);

    } catch (error) {
      console.error("Error checking finance alerts:", error);
    } finally {
      setLoading(false);
    }
  }, [user, isDismissed]);

  const dismissFinanceAlert = useCallback(async (alertId: string) => {
    await dismissAlert(`finance-${alertId}`);
    setAlerts(prev => prev.filter(a => a.id !== alertId));
  }, [dismissAlert]);

  useEffect(() => {
    checkAlerts();
  }, [checkAlerts]);

  return {
    alerts,
    loading,
    checkAlerts,
    dismissAlert: dismissFinanceAlert,
    clearDismissed,
  };
};
