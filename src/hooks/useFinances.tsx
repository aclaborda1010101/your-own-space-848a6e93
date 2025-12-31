import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { startOfMonth, endOfMonth, format } from "date-fns";

export interface FinanceAccount {
  id: string;
  user_id: string;
  name: string;
  account_type: "bank" | "cash" | "investment" | "credit";
  balance: number;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceTransaction {
  id: string;
  user_id: string;
  account_id: string | null;
  transaction_type: "income" | "expense" | "transfer";
  category: string;
  subcategory: string | null;
  amount: number;
  currency: string;
  description: string | null;
  vendor: string | null;
  transaction_date: string;
  is_recurring: boolean;
  recurring_frequency: string | null;
  invoice_number: string | null;
  invoice_status: "pending" | "paid" | "overdue" | null;
  due_date: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

export interface FinanceBudget {
  id: string;
  user_id: string;
  category: string;
  budget_amount: number;
  period: "weekly" | "monthly" | "yearly";
  alert_threshold: number;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface FinanceGoal {
  id: string;
  user_id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  deadline: string | null;
  priority: "high" | "medium" | "low";
  status: "active" | "completed" | "paused";
  created_at: string;
  updated_at: string;
}

export const EXPENSE_CATEGORIES = [
  { id: "food", label: "Alimentación", icon: "🍽️" },
  { id: "transport", label: "Transporte", icon: "🚗" },
  { id: "housing", label: "Vivienda", icon: "🏠" },
  { id: "utilities", label: "Servicios", icon: "💡" },
  { id: "subscriptions", label: "Suscripciones", icon: "📱" },
  { id: "health", label: "Salud", icon: "🏥" },
  { id: "education", label: "Educación", icon: "📚" },
  { id: "entertainment", label: "Ocio", icon: "🎬" },
  { id: "shopping", label: "Compras", icon: "🛒" },
  { id: "family", label: "Familia", icon: "👨‍👩‍👧" },
  { id: "business", label: "Negocio", icon: "💼" },
  { id: "taxes", label: "Impuestos", icon: "📋" },
  { id: "other", label: "Otros", icon: "📦" }
];

export const INCOME_CATEGORIES = [
  { id: "salary", label: "Salario", icon: "💵" },
  { id: "freelance", label: "Freelance", icon: "💻" },
  { id: "business", label: "Negocio", icon: "🏢" },
  { id: "investments", label: "Inversiones", icon: "📈" },
  { id: "rental", label: "Alquiler", icon: "🏠" },
  { id: "refunds", label: "Reembolsos", icon: "↩️" },
  { id: "other", label: "Otros", icon: "💰" }
];

export const useFinances = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<FinanceAccount[]>([]);
  const [transactions, setTransactions] = useState<FinanceTransaction[]>([]);
  const [budgets, setBudgets] = useState<FinanceBudget[]>([]);
  const [goals, setGoals] = useState<FinanceGoal[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date());

  // Fetch all finance data
  const fetchData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const monthStart = format(startOfMonth(selectedMonth), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(selectedMonth), "yyyy-MM-dd");

      const [accountsRes, transactionsRes, budgetsRes, goalsRes] = await Promise.all([
        supabase.from("finance_accounts").select("*").eq("user_id", user.id).order("name"),
        supabase.from("finance_transactions").select("*").eq("user_id", user.id)
          .gte("transaction_date", monthStart)
          .lte("transaction_date", monthEnd)
          .order("transaction_date", { ascending: false }),
        supabase.from("finance_budgets").select("*").eq("user_id", user.id).eq("is_active", true),
        supabase.from("finance_goals").select("*").eq("user_id", user.id).eq("status", "active")
      ]);

      if (accountsRes.error) throw accountsRes.error;
      if (transactionsRes.error) throw transactionsRes.error;
      if (budgetsRes.error) throw budgetsRes.error;
      if (goalsRes.error) throw goalsRes.error;

      setAccounts(accountsRes.data as FinanceAccount[]);
      setTransactions(transactionsRes.data as FinanceTransaction[]);
      setBudgets(budgetsRes.data as FinanceBudget[]);
      setGoals(goalsRes.data as FinanceGoal[]);
    } catch (error) {
      console.error("Error fetching finance data:", error);
      toast.error("Error al cargar datos financieros");
    } finally {
      setLoading(false);
    }
  }, [user, selectedMonth]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate summary
  const summary = useMemo(() => {
    const totalIncome = transactions
      .filter(t => t.transaction_type === "income")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.transaction_type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalBalance = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

    const expensesByCategory = transactions
      .filter(t => t.transaction_type === "expense")
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + Number(t.amount);
        return acc;
      }, {} as Record<string, number>);

    const budgetStatus = budgets.map(budget => {
      const spent = expensesByCategory[budget.category] || 0;
      const percentage = (spent / Number(budget.budget_amount)) * 100;
      return {
        ...budget,
        spent,
        percentage,
        isOverBudget: percentage > 100,
        isNearLimit: percentage >= budget.alert_threshold
      };
    });

    return {
      totalIncome,
      totalExpenses,
      netCashflow: totalIncome - totalExpenses,
      totalBalance,
      expensesByCategory,
      budgetStatus
    };
  }, [transactions, accounts, budgets]);

  // CRUD Operations
  const addAccount = useCallback(async (account: Omit<FinanceAccount, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("finance_accounts")
        .insert({ ...account, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setAccounts(prev => [...prev, data as FinanceAccount]);
      toast.success("Cuenta añadida");
      return data;
    } catch (error) {
      console.error("Error adding account:", error);
      toast.error("Error al añadir cuenta");
      return null;
    }
  }, [user]);

  const addTransaction = useCallback(async (transaction: Omit<FinanceTransaction, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("finance_transactions")
        .insert({ ...transaction, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setTransactions(prev => [data as FinanceTransaction, ...prev]);

      // Update account balance if linked
      if (transaction.account_id) {
        const balanceChange = transaction.transaction_type === "income" 
          ? Number(transaction.amount) 
          : -Number(transaction.amount);

        await supabase
          .from("finance_accounts")
          .update({ 
            balance: accounts.find(a => a.id === transaction.account_id)!.balance + balanceChange 
          })
          .eq("id", transaction.account_id);

        fetchData(); // Refresh to get updated balances
      }

      toast.success("Transacción registrada");
      return data;
    } catch (error) {
      console.error("Error adding transaction:", error);
      toast.error("Error al registrar transacción");
      return null;
    }
  }, [user, accounts, fetchData]);

  const addBudget = useCallback(async (budget: Omit<FinanceBudget, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("finance_budgets")
        .insert({ ...budget, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setBudgets(prev => [...prev, data as FinanceBudget]);
      toast.success("Presupuesto creado");
      return data;
    } catch (error) {
      console.error("Error adding budget:", error);
      toast.error("Error al crear presupuesto");
      return null;
    }
  }, [user]);

  const addGoal = useCallback(async (goal: Omit<FinanceGoal, "id" | "user_id" | "created_at" | "updated_at">) => {
    if (!user) return null;

    try {
      const { data, error } = await supabase
        .from("finance_goals")
        .insert({ ...goal, user_id: user.id })
        .select()
        .single();

      if (error) throw error;
      setGoals(prev => [...prev, data as FinanceGoal]);
      toast.success("Meta financiera creada");
      return data;
    } catch (error) {
      console.error("Error adding goal:", error);
      toast.error("Error al crear meta");
      return null;
    }
  }, [user]);

  const updateGoal = useCallback(async (id: string, updates: Partial<FinanceGoal>) => {
    try {
      const { error } = await supabase
        .from("finance_goals")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      setGoals(prev => prev.map(g => g.id === id ? { ...g, ...updates } : g));
      toast.success("Meta actualizada");
      return true;
    } catch (error) {
      console.error("Error updating goal:", error);
      toast.error("Error al actualizar meta");
      return false;
    }
  }, []);

  const deleteTransaction = useCallback(async (id: string) => {
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .delete()
        .eq("id", id);

      if (error) throw error;
      setTransactions(prev => prev.filter(t => t.id !== id));
      toast.success("Transacción eliminada");
      return true;
    } catch (error) {
      console.error("Error deleting transaction:", error);
      toast.error("Error al eliminar transacción");
      return false;
    }
  }, []);

  return {
    accounts,
    transactions,
    budgets,
    goals,
    loading,
    summary,
    selectedMonth,
    setSelectedMonth,
    addAccount,
    addTransaction,
    addBudget,
    addGoal,
    updateGoal,
    deleteTransaction,
    refresh: fetchData
  };
};
