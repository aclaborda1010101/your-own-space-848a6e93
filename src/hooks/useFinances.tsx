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

// Expense categories with subcategories
export const EXPENSE_CATEGORIES = [
  { id: "housing", label: "Vivienda", icon: "🏠", subcategories: [
    { id: "rent", label: "Alquiler" },
    { id: "mortgage", label: "Hipoteca" },
    { id: "community", label: "Comunidad" },
    { id: "insurance_home", label: "Seguro hogar" },
    { id: "maintenance", label: "Mantenimiento" },
  ]},
  { id: "utilities", label: "Suministros", icon: "💡", subcategories: [
    { id: "electricity", label: "Luz" },
    { id: "gas", label: "Gas" },
    { id: "water", label: "Agua" },
    { id: "internet", label: "Internet" },
    { id: "phone", label: "Teléfono" },
  ]},
  { id: "transport", label: "Transporte", icon: "🚗", subcategories: [
    { id: "fuel", label: "Combustible" },
    { id: "public_transport", label: "Transporte público" },
    { id: "car_insurance", label: "Seguro coche" },
    { id: "car_maintenance", label: "Mantenimiento" },
    { id: "parking", label: "Parking" },
    { id: "taxi", label: "Taxi/VTC" },
  ]},
  { id: "food", label: "Alimentación", icon: "🍽️", subcategories: [
    { id: "supermarket", label: "Supermercado" },
    { id: "restaurants", label: "Restaurantes" },
    { id: "delivery", label: "Delivery" },
    { id: "coffee", label: "Cafés" },
  ]},
  { id: "subscriptions", label: "Suscripciones", icon: "📱", subcategories: [
    { id: "streaming", label: "Streaming (Netflix, etc)" },
    { id: "music", label: "Música (Spotify, etc)" },
    { id: "software", label: "Software" },
    { id: "gym", label: "Gimnasio" },
    { id: "other_subs", label: "Otras" },
  ]},
  { id: "loans", label: "Préstamos", icon: "🏦", subcategories: [
    { id: "personal_loan", label: "Préstamo personal" },
    { id: "car_loan", label: "Préstamo coche" },
    { id: "credit_card", label: "Tarjeta crédito" },
  ]},
  { id: "health", label: "Salud", icon: "🏥", subcategories: [
    { id: "pharmacy", label: "Farmacia" },
    { id: "doctor", label: "Médico" },
    { id: "dentist", label: "Dentista" },
    { id: "health_insurance", label: "Seguro médico" },
  ]},
  { id: "education", label: "Educación", icon: "📚", subcategories: [
    { id: "courses", label: "Cursos" },
    { id: "books", label: "Libros" },
    { id: "school", label: "Colegio" },
  ]},
  { id: "entertainment", label: "Ocio", icon: "🎬", subcategories: [
    { id: "cinema", label: "Cine" },
    { id: "events", label: "Eventos" },
    { id: "travel", label: "Viajes" },
    { id: "hobbies", label: "Hobbies" },
  ]},
  { id: "shopping", label: "Compras", icon: "🛒", subcategories: [
    { id: "clothing", label: "Ropa" },
    { id: "electronics", label: "Electrónica" },
    { id: "home_goods", label: "Hogar" },
  ]},
  { id: "family", label: "Familia", icon: "👨‍👩‍👧", subcategories: [
    { id: "childcare", label: "Guardería" },
    { id: "kids_activities", label: "Actividades niños" },
    { id: "pets", label: "Mascotas" },
  ]},
  { id: "business", label: "Negocio", icon: "💼", subcategories: [
    { id: "supplies", label: "Material" },
    { id: "marketing", label: "Marketing" },
    { id: "professional_services", label: "Servicios profesionales" },
  ]},
  { id: "taxes", label: "Impuestos", icon: "📋", subcategories: [
    { id: "income_tax", label: "IRPF" },
    { id: "vat", label: "IVA" },
    { id: "property_tax", label: "IBI" },
    { id: "social_security", label: "Seguridad Social" },
  ]},
  { id: "other", label: "Otros", icon: "📦", subcategories: [] }
];

export const INCOME_CATEGORIES = [
  { id: "salary", label: "Nómina", icon: "💵", subcategories: [
    { id: "main_salary", label: "Salario principal" },
    { id: "bonus", label: "Bonus" },
    { id: "extra_pay", label: "Paga extra" },
  ]},
  { id: "freelance", label: "Freelance", icon: "💻", subcategories: [
    { id: "project", label: "Proyecto" },
    { id: "consulting", label: "Consultoría" },
    { id: "commission", label: "Comisión" },
  ]},
  { id: "business", label: "Negocio", icon: "🏢", subcategories: [
    { id: "sales", label: "Ventas" },
    { id: "services", label: "Servicios" },
  ]},
  { id: "investments", label: "Inversiones", icon: "📈", subcategories: [
    { id: "dividends", label: "Dividendos" },
    { id: "capital_gains", label: "Plusvalías" },
    { id: "interest", label: "Intereses" },
  ]},
  { id: "rental", label: "Alquileres", icon: "🏠", subcategories: [
    { id: "property_rent", label: "Alquiler inmueble" },
    { id: "room_rent", label: "Habitación" },
  ]},
  { id: "refunds", label: "Reembolsos", icon: "↩️", subcategories: [] },
  { id: "other", label: "Otros", icon: "💰", subcategories: [] }
];

// Helper to get all subcategories flat
export const getAllSubcategories = (categories: typeof EXPENSE_CATEGORIES) => {
  return categories.flatMap(cat => 
    cat.subcategories.map(sub => ({ ...sub, parentId: cat.id, parentLabel: cat.label }))
  );
};

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
    // Only count income that is NOT a pending invoice
    const confirmedIncome = transactions
      .filter(t => t.transaction_type === "income" && t.invoice_status !== "pending")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Pending invoices (issued but not yet paid)
    const pendingInvoices = transactions
      .filter(t => t.transaction_type === "income" && t.invoice_status === "pending")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalExpenses = transactions
      .filter(t => t.transaction_type === "expense")
      .reduce((sum, t) => sum + Number(t.amount), 0);

    // Recurring vs non-recurring expenses
    const recurringExpenses = transactions
      .filter(t => t.transaction_type === "expense" && t.is_recurring)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const nonRecurringExpenses = totalExpenses - recurringExpenses;

    // Recurring income
    const recurringIncome = transactions
      .filter(t => t.transaction_type === "income" && t.is_recurring && t.invoice_status !== "pending")
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
      totalIncome: confirmedIncome,
      pendingInvoices,
      totalExpenses,
      recurringExpenses,
      nonRecurringExpenses,
      recurringIncome,
      netCashflow: confirmedIncome - totalExpenses,
      totalBalance,
      expensesByCategory,
      budgetStatus
    };
  }, [transactions, accounts, budgets]);

  // Get invoices (transactions with invoice data)
  const invoices = useMemo(() => {
    return transactions.filter(t => t.invoice_number || t.invoice_status);
  }, [transactions]);

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

  // Update transaction (for changing invoice status)
  const updateTransaction = useCallback(async (id: string, updates: Partial<FinanceTransaction>) => {
    try {
      const { error } = await supabase
        .from("finance_transactions")
        .update(updates)
        .eq("id", id);

      if (error) throw error;
      setTransactions(prev => prev.map(t => t.id === id ? { ...t, ...updates } : t));
      toast.success("Transacción actualizada");
      return true;
    } catch (error) {
      console.error("Error updating transaction:", error);
      toast.error("Error al actualizar transacción");
      return false;
    }
  }, []);

  return {
    accounts,
    transactions,
    invoices,
    budgets,
    goals,
    loading,
    summary,
    selectedMonth,
    setSelectedMonth,
    addAccount,
    addTransaction,
    updateTransaction,
    addBudget,
    addGoal,
    updateGoal,
    deleteTransaction,
    refresh: fetchData
  };
};
