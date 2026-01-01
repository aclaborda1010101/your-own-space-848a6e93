import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { AlertTriangle, TrendingUp } from "lucide-react";

interface BudgetStatus {
  id: string;
  category: string;
  budget_amount: number;
  spent: number;
  percentage: number;
  isOverBudget: boolean;
  isNearLimit: boolean;
  alert_threshold: number;
}

interface BudgetAlertsProviderProps {
  budgetStatus: BudgetStatus[];
  children: React.ReactNode;
}

export const BudgetAlertsProvider = ({ budgetStatus, children }: BudgetAlertsProviderProps) => {
  const shownAlertsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    budgetStatus.forEach((budget) => {
      const alertKey = `${budget.id}-${budget.isOverBudget ? "over" : "near"}`;
      
      // Only show alert once per session per budget state
      if (shownAlertsRef.current.has(alertKey)) return;

      if (budget.isOverBudget) {
        shownAlertsRef.current.add(alertKey);
        toast.error(
          `¡Presupuesto superado! Has gastado ${Math.round(budget.percentage)}% en ${budget.category}`,
          {
            duration: 6000,
            icon: <AlertTriangle className="w-5 h-5 text-destructive" />,
            description: `Gastado: €${budget.spent.toFixed(2)} / Presupuesto: €${budget.budget_amount.toFixed(2)}`,
          }
        );
      } else if (budget.isNearLimit) {
        shownAlertsRef.current.add(alertKey);
        toast.warning(
          `Cerca del límite: ${Math.round(budget.percentage)}% en ${budget.category}`,
          {
            duration: 5000,
            icon: <TrendingUp className="w-5 h-5 text-warning" />,
            description: `Gastado: €${budget.spent.toFixed(2)} / Presupuesto: €${budget.budget_amount.toFixed(2)}`,
          }
        );
      }
    });
  }, [budgetStatus]);

  // Reset alerts when budgets change significantly
  useEffect(() => {
    const currentBudgetIds = new Set(budgetStatus.map((b) => b.id));
    shownAlertsRef.current.forEach((key) => {
      const budgetId = key.split("-")[0];
      if (!currentBudgetIds.has(budgetId)) {
        shownAlertsRef.current.delete(key);
      }
    });
  }, [budgetStatus]);

  return <>{children}</>;
};
