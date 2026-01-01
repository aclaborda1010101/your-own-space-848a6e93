import { useState } from "react";
import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { useFinances, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/hooks/useFinances";
import { useFinanceForecast } from "@/hooks/useFinanceForecast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, TrendingUp, TrendingDown, Wallet, Target, 
  PiggyBank, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  Loader2, FileText, RefreshCw, Clock, CheckCircle, AlertTriangle, Sparkles
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { AddTransactionDialog } from "@/components/finances/AddTransactionDialog";
import { AddAccountDialog } from "@/components/finances/AddAccountDialog";
import { AddBudgetDialog } from "@/components/finances/AddBudgetDialog";
import { AddGoalDialog } from "@/components/finances/AddGoalDialog";
import { ImportTransactionsDialog } from "@/components/finances/ImportTransactionsDialog";
import { FinanceForecastCard } from "@/components/finances/FinanceForecastCard";
import { cn } from "@/lib/utils";

const Finances = () => {
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  const { 
    accounts, transactions, invoices, budgets, goals, loading, summary,
    selectedMonth, setSelectedMonth,
    addAccount, addTransaction, updateTransaction, importTransactions, addBudget, addGoal, updateGoal, deleteTransaction
  } = useFinances();
  const { forecast, loading: forecastLoading, generateForecast, clearForecast } = useFinanceForecast();

  const [showTransactionDialog, setShowTransactionDialog] = useState(false);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showBudgetDialog, setShowBudgetDialog] = useState(false);
  const [showGoalDialog, setShowGoalDialog] = useState(false);
  const [transactionType, setTransactionType] = useState<"income" | "expense">("expense");
  const [isInvoiceMode, setIsInvoiceMode] = useState(false);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR"
    }).format(amount);
  };

  const handleMarkInvoicePaid = async (invoiceId: string) => {
    await updateTransaction(invoiceId, { invoice_status: "paid" });
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <Sidebar 
          isOpen={sidebarOpen} 
          onClose={closeSidebar} 
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
        <div className={cn(
          "flex-1 flex flex-col transition-all duration-300",
          sidebarCollapsed ? "md:ml-20" : "md:ml-64"
        )}>
          <TopBar onMenuClick={openSidebar} />
          <main className="flex-1 p-6 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar 
        isOpen={sidebarOpen} 
        onClose={closeSidebar} 
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      <div className={cn(
        "flex-1 flex flex-col transition-all duration-300",
        sidebarCollapsed ? "md:ml-20" : "md:ml-64"
      )}>
        <TopBar onMenuClick={openSidebar} />
        <main className="flex-1 p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-foreground">JARVIS Finanzas</h1>
              <p className="text-muted-foreground">Control de ingresos, gastos y objetivos financieros</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(subMonths(selectedMonth, 1))}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium min-w-[120px] text-center">
                {format(selectedMonth, "MMMM yyyy", { locale: es })}
              </span>
              <Button variant="outline" size="icon" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Balance Total</p>
                    <p className="text-2xl font-bold text-foreground">{formatCurrency(summary.totalBalance)}</p>
                  </div>
                  <div className="p-3 bg-primary/10 rounded-full">
                    <Wallet className="w-6 h-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Ingresos</p>
                    <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalIncome)}</p>
                    {summary.pendingInvoices > 0 && (
                      <p className="text-xs text-yellow-600 flex items-center gap-1 mt-1">
                        <Clock className="w-3 h-3" />
                        {formatCurrency(summary.pendingInvoices)} pendiente
                      </p>
                    )}
                  </div>
                  <div className="p-3 bg-green-100 dark:bg-green-900/20 rounded-full">
                    <TrendingUp className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Gastos</p>
                    <p className="text-2xl font-bold text-red-600">{formatCurrency(summary.totalExpenses)}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                      <RefreshCw className="w-3 h-3" />
                      {formatCurrency(summary.recurringExpenses)} recurrentes
                    </p>
                  </div>
                  <div className="p-3 bg-red-100 dark:bg-red-900/20 rounded-full">
                    <TrendingDown className="w-6 h-6 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Flujo Neto</p>
                    <p className={cn(
                      "text-2xl font-bold",
                      summary.netCashflow >= 0 ? "text-green-600" : "text-red-600"
                    )}>
                      {formatCurrency(summary.netCashflow)}
                    </p>
                  </div>
                  <div className={cn(
                    "p-3 rounded-full",
                    summary.netCashflow >= 0 ? "bg-green-100 dark:bg-green-900/20" : "bg-red-100 dark:bg-red-900/20"
                  )}>
                    {summary.netCashflow >= 0 
                      ? <ArrowUpRight className="w-6 h-6 text-green-600" />
                      : <ArrowDownRight className="w-6 h-6 text-red-600" />
                    }
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Facturas Pendientes</p>
                    <p className="text-2xl font-bold text-yellow-600">
                      {invoices.filter(i => i.invoice_status === "pending").length}
                    </p>
                  </div>
                  <div className="p-3 bg-yellow-100 dark:bg-yellow-900/20 rounded-full">
                    <FileText className="w-6 h-6 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* AI Forecast Section */}
          <FinanceForecastCard
            forecast={forecast}
            loading={forecastLoading}
            onGenerate={() => generateForecast(transactions)}
            onClose={clearForecast}
          />

          {/* Main Content */}
          <Tabs defaultValue="transactions" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full max-w-lg">
              <TabsTrigger value="transactions">Movimientos</TabsTrigger>
              <TabsTrigger value="invoices">Facturas</TabsTrigger>
              <TabsTrigger value="accounts">Cuentas</TabsTrigger>
              <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
              <TabsTrigger value="goals">Metas</TabsTrigger>
            </TabsList>

            {/* Transactions Tab */}
            <TabsContent value="transactions" className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => { setTransactionType("expense"); setIsInvoiceMode(false); setShowTransactionDialog(true); }}>
                  <TrendingDown className="w-4 h-4 mr-2" />
                  Añadir Gasto
                </Button>
                <Button variant="outline" onClick={() => { setTransactionType("income"); setIsInvoiceMode(false); setShowTransactionDialog(true); }}>
                  <TrendingUp className="w-4 h-4 mr-2" />
                  Añadir Ingreso
                </Button>
                <ImportTransactionsDialog onImport={importTransactions} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Movimientos del mes</CardTitle>
                  <CardDescription>
                    Recurrentes: {formatCurrency(summary.recurringExpenses)} | 
                    Puntuales: {formatCurrency(summary.nonRecurringExpenses)}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <p className="text-center text-muted-foreground py-8">
                      No hay movimientos este mes
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {transactions.map(t => {
                        const category = t.transaction_type === "income"
                          ? INCOME_CATEGORIES.find(c => c.id === t.category)
                          : EXPENSE_CATEGORIES.find(c => c.id === t.category);

                        return (
                          <div 
                            key={t.id} 
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-xl">{category?.icon || "📦"}</span>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className="font-medium text-foreground">{t.description || category?.label}</p>
                                  {t.is_recurring && (
                                    <Badge variant="secondary" className="text-xs">
                                      <RefreshCw className="w-3 h-3 mr-1" />
                                      {t.recurring_frequency === "monthly" ? "Mensual" : 
                                       t.recurring_frequency === "weekly" ? "Semanal" : 
                                       t.recurring_frequency === "yearly" ? "Anual" : "Recurrente"}
                                    </Badge>
                                  )}
                                </div>
                                <p className="text-xs text-muted-foreground">
                                  {format(new Date(t.transaction_date), "d MMM", { locale: es })}
                                  {t.vendor && ` • ${t.vendor}`}
                                  {t.subcategory && ` • ${t.subcategory}`}
                                </p>
                              </div>
                            </div>
                            <span className={cn(
                              "font-semibold",
                              t.transaction_type === "income" ? "text-green-600" : "text-red-600"
                            )}>
                              {t.transaction_type === "income" ? "+" : "-"}{formatCurrency(Number(t.amount))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Invoices Tab */}
            <TabsContent value="invoices" className="space-y-4">
              <div className="flex gap-2">
                <Button onClick={() => { setTransactionType("income"); setIsInvoiceMode(true); setShowTransactionDialog(true); }}>
                  <FileText className="w-4 h-4 mr-2" />
                  Emitir Factura
                </Button>
                <Button variant="outline" onClick={() => { setTransactionType("expense"); setIsInvoiceMode(true); setShowTransactionDialog(true); }}>
                  <FileText className="w-4 h-4 mr-2" />
                  Registrar Factura Recibida
                </Button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Emitted invoices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowUpRight className="w-5 h-5 text-green-600" />
                      Facturas Emitidas
                    </CardTitle>
                    <CardDescription>
                      Facturas que has emitido a clientes
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invoices.filter(i => i.transaction_type === "income").length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">
                        No hay facturas emitidas
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.filter(i => i.transaction_type === "income").map(invoice => (
                          <div 
                            key={invoice.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground text-sm">
                                  {invoice.invoice_number || "Sin número"}
                                </p>
                                {invoice.invoice_status === "pending" && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pendiente
                                  </Badge>
                                )}
                                {invoice.invoice_status === "paid" && (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Cobrada
                                  </Badge>
                                )}
                                {invoice.invoice_status === "overdue" && (
                                  <Badge variant="outline" className="text-red-600 border-red-600">
                                    <AlertTriangle className="w-3 h-3 mr-1" />
                                    Vencida
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {invoice.vendor || "Cliente sin nombre"} • {format(new Date(invoice.transaction_date), "d MMM", { locale: es })}
                                {invoice.due_date && ` • Vence: ${format(new Date(invoice.due_date), "d MMM", { locale: es })}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-green-600">
                                {formatCurrency(Number(invoice.amount))}
                              </span>
                              {invoice.invoice_status === "pending" && (
                                <Button 
                                  size="sm" 
                                  variant="ghost"
                                  onClick={() => handleMarkInvoicePaid(invoice.id)}
                                >
                                  <CheckCircle className="w-4 h-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Received invoices */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <ArrowDownRight className="w-5 h-5 text-red-600" />
                      Facturas Recibidas
                    </CardTitle>
                    <CardDescription>
                      Facturas de proveedores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {invoices.filter(i => i.transaction_type === "expense").length === 0 ? (
                      <p className="text-center text-muted-foreground py-4 text-sm">
                        No hay facturas recibidas
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {invoices.filter(i => i.transaction_type === "expense").map(invoice => (
                          <div 
                            key={invoice.id}
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                          >
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-foreground text-sm">
                                  {invoice.invoice_number || "Sin número"}
                                </p>
                                {invoice.invoice_status === "pending" && (
                                  <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                    <Clock className="w-3 h-3 mr-1" />
                                    Pendiente
                                  </Badge>
                                )}
                                {invoice.invoice_status === "paid" && (
                                  <Badge variant="outline" className="text-green-600 border-green-600">
                                    <CheckCircle className="w-3 h-3 mr-1" />
                                    Pagada
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {invoice.vendor || "Proveedor"} • {format(new Date(invoice.transaction_date), "d MMM", { locale: es })}
                              </p>
                            </div>
                            <span className="font-semibold text-red-600">
                              {formatCurrency(Number(invoice.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Accounts Tab */}
            <TabsContent value="accounts" className="space-y-4">
              <Button onClick={() => setShowAccountDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Cuenta
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {accounts.map(account => (
                  <Card key={account.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground capitalize">{account.account_type}</span>
                        {account.is_active && (
                          <span className="text-xs bg-green-100 dark:bg-green-900/20 text-green-600 px-2 py-0.5 rounded-full">
                            Activa
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-foreground">{account.name}</h3>
                      <p className="text-2xl font-bold text-foreground mt-2">{formatCurrency(Number(account.balance))}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Budgets Tab */}
            <TabsContent value="budgets" className="space-y-4">
              <Button onClick={() => setShowBudgetDialog(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Nuevo Presupuesto
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {summary.budgetStatus.map(budget => {
                  const category = EXPENSE_CATEGORIES.find(c => c.id === budget.category);
                  
                  return (
                    <Card key={budget.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center gap-2 mb-4">
                          <span className="text-xl">{category?.icon || "📦"}</span>
                          <span className="font-medium text-foreground">{category?.label || budget.category}</span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Gastado</span>
                            <span className={cn(
                              "font-medium",
                              budget.isOverBudget ? "text-red-600" : budget.isNearLimit ? "text-yellow-600" : "text-foreground"
                            )}>
                              {formatCurrency(budget.spent)} / {formatCurrency(Number(budget.budget_amount))}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className={cn(
                                "h-full transition-all",
                                budget.isOverBudget ? "bg-red-500" : budget.isNearLimit ? "bg-yellow-500" : "bg-primary"
                              )}
                              style={{ width: `${Math.min(budget.percentage, 100)}%` }}
                            />
                          </div>
                          <p className="text-xs text-muted-foreground text-right">
                            {budget.percentage.toFixed(0)}% utilizado
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>

            {/* Goals Tab */}
            <TabsContent value="goals" className="space-y-4">
              <Button onClick={() => setShowGoalDialog(true)}>
                <Target className="w-4 h-4 mr-2" />
                Nueva Meta
              </Button>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {goals.map(goal => {
                  const progress = (Number(goal.current_amount) / Number(goal.target_amount)) * 100;
                  
                  return (
                    <Card key={goal.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <PiggyBank className="w-5 h-5 text-primary" />
                            <span className="font-medium text-foreground">{goal.name}</span>
                          </div>
                          <span className={cn(
                            "text-xs px-2 py-0.5 rounded-full",
                            goal.priority === "high" ? "bg-red-100 dark:bg-red-900/20 text-red-600" :
                            goal.priority === "medium" ? "bg-yellow-100 dark:bg-yellow-900/20 text-yellow-600" :
                            "bg-muted text-muted-foreground"
                          )}>
                            {goal.priority === "high" ? "Alta" : goal.priority === "medium" ? "Media" : "Baja"}
                          </span>
                        </div>
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Progreso</span>
                            <span className="font-medium text-foreground">
                              {formatCurrency(Number(goal.current_amount))} / {formatCurrency(Number(goal.target_amount))}
                            </span>
                          </div>
                          <div className="h-2 bg-muted rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-primary transition-all"
                              style={{ width: `${Math.min(progress, 100)}%` }}
                            />
                          </div>
                          {goal.deadline && (
                            <p className="text-xs text-muted-foreground">
                              Fecha límite: {format(new Date(goal.deadline), "d MMM yyyy", { locale: es })}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>

      {/* Dialogs */}
      <AddTransactionDialog 
        open={showTransactionDialog}
        onOpenChange={setShowTransactionDialog}
        type={transactionType}
        accounts={accounts}
        onSubmit={addTransaction}
        isInvoice={isInvoiceMode}
      />
      <AddAccountDialog 
        open={showAccountDialog}
        onOpenChange={setShowAccountDialog}
        onSubmit={addAccount}
      />
      <AddBudgetDialog 
        open={showBudgetDialog}
        onOpenChange={setShowBudgetDialog}
        onSubmit={addBudget}
      />
      <AddGoalDialog 
        open={showGoalDialog}
        onOpenChange={setShowGoalDialog}
        onSubmit={addGoal}
      />
    </div>
  );
};

export default Finances;
