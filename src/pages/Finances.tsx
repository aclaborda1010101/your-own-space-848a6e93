import { useState } from "react";
import { useFinances, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/hooks/useFinances";
import { useFinanceForecast } from "@/hooks/useFinanceForecast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Plus, TrendingUp, TrendingDown, Wallet, Target, 
  PiggyBank, ArrowUpRight, ArrowDownRight, ChevronLeft, ChevronRight,
  Loader2, FileText, RefreshCw, Clock, CheckCircle, AlertTriangle, Sparkles, BarChart3
} from "lucide-react";
import { format, addMonths, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { AddTransactionDialog } from "@/components/finances/AddTransactionDialog";
import { AddAccountDialog } from "@/components/finances/AddAccountDialog";
import { AddBudgetDialog } from "@/components/finances/AddBudgetDialog";
import { AddGoalDialog } from "@/components/finances/AddGoalDialog";
import { ImportTransactionsDialog } from "@/components/finances/ImportTransactionsDialog";
import { FinanceForecastCard } from "@/components/finances/FinanceForecastCard";
import { ExportFinancesButton } from "@/components/finances/ExportFinancesButton";
import { BudgetAlertsProvider } from "@/components/finances/BudgetAlertsProvider";
import { ExpenseCharts } from "@/components/finances/ExpenseCharts";
import { MonthlyComparisonChart } from "@/components/finances/MonthlyComparisonChart";
import { AutoSavingsGoalsCard } from "@/components/finances/AutoSavingsGoalsCard";
import { FinanceAlertsCard } from "@/components/finances/FinanceAlertsCard";
import type { MonthlyComparison } from "@/hooks/useFinanceHistory";
import { cn } from "@/lib/utils";

const Finances = () => {
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
  const [historyData, setHistoryData] = useState<MonthlyComparison[]>([]);

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
      <main className="flex-1 p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </main>
    );
  }

  return (
    <>
      <main className="flex-1 p-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">JARVIS Finanzas</h1>
            <p className="text-muted-foreground">Control de ingresos, gastos y objetivos financieros</p>
          </div>
          <div className="flex items-center gap-2">
            <ExportFinancesButton
              transactions={transactions}
              accounts={accounts}
              budgets={budgets}
              goals={goals}
              selectedMonth={selectedMonth}
            />
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

        <BudgetAlertsProvider budgetStatus={summary.budgetStatus}>
          <></>
        </BudgetAlertsProvider>

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

        <FinanceAlertsCard />

        <FinanceForecastCard
          forecast={forecast}
          loading={forecastLoading}
          onGenerate={() => generateForecast(transactions)}
          onClose={clearForecast}
        />

        <Tabs defaultValue="transactions" className="space-y-4">
          <TabsList className="grid grid-cols-5 w-full max-w-lg">
            <TabsTrigger value="transactions">Movimientos</TabsTrigger>
            <TabsTrigger value="invoices">Facturas</TabsTrigger>
            <TabsTrigger value="accounts">Cuentas</TabsTrigger>
            <TabsTrigger value="budgets">Presupuestos</TabsTrigger>
            <TabsTrigger value="goals">Metas</TabsTrigger>
          </TabsList>

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

            {transactions.filter(t => t.transaction_type === "expense").length > 0 && (
              <ExpenseCharts 
                transactions={transactions} 
                expensesByCategory={summary.expensesByCategory} 
              />
            )}

            <MonthlyComparisonChart onDataLoaded={setHistoryData} />
          </TabsContent>

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
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              {invoice.vendor || invoice.description} • {format(new Date(invoice.transaction_date), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-green-600">
                              +{formatCurrency(Number(invoice.amount))}
                            </span>
                            {invoice.invoice_status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkInvoicePaid(invoice.id)}>
                                Cobrada
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowDownRight className="w-5 h-5 text-red-600" />
                    Facturas Recibidas
                  </CardTitle>
                  <CardDescription>
                    Facturas de proveedores y servicios
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
                              {invoice.vendor || invoice.description} • {format(new Date(invoice.transaction_date), "d MMM yyyy", { locale: es })}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-red-600">
                              -{formatCurrency(Number(invoice.amount))}
                            </span>
                            {invoice.invoice_status === "pending" && (
                              <Button size="sm" variant="outline" onClick={() => handleMarkInvoicePaid(invoice.id)}>
                                Pagada
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="accounts" className="space-y-4">
            <Button onClick={() => setShowAccountDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Añadir Cuenta
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {accounts.map(account => (
                <Card key={account.id}>
                  <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="font-medium text-foreground">{account.name}</h3>
                      <Badge variant="outline">{account.account_type}</Badge>
                    </div>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(Number(account.balance))}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="budgets" className="space-y-4">
            <Button onClick={() => setShowBudgetDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear Presupuesto
            </Button>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {budgets.map(budget => {
                const spent = summary.budgetStatus.find(b => b.category === budget.category)?.spent || 0;
                const percentage = Math.min((spent / Number(budget.amount)) * 100, 100);
                const isOverBudget = spent > Number(budget.amount);

                return (
                  <Card key={budget.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-medium text-foreground">{budget.category}</h3>
                        <Badge variant={isOverBudget ? "destructive" : "outline"}>
                          {isOverBudget ? "Excedido" : `${percentage.toFixed(0)}%`}
                        </Badge>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Gastado: {formatCurrency(spent)}</span>
                        <span className="text-muted-foreground">Límite: {formatCurrency(Number(budget.amount))}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className={cn(
                            "h-2 rounded-full transition-all",
                            isOverBudget ? "bg-destructive" : percentage > 80 ? "bg-warning" : "bg-success"
                          )}
                          style={{ width: `${Math.min(percentage, 100)}%` }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="goals" className="space-y-4">
            <Button onClick={() => setShowGoalDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Meta
            </Button>
            <AutoSavingsGoalsCard />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {goals.map(goal => {
                const percentage = Math.min((Number(goal.current_amount) / Number(goal.target_amount)) * 100, 100);
                return (
                  <Card key={goal.id}>
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-primary/10 rounded-full">
                          <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-medium text-foreground">{goal.name}</h3>
                          <p className="text-xs text-muted-foreground">{goal.goal_type}</p>
                        </div>
                      </div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{formatCurrency(Number(goal.current_amount))}</span>
                        <span className="text-muted-foreground">{formatCurrency(Number(goal.target_amount))}</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div 
                          className="h-2 rounded-full bg-primary transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-2 text-right">{percentage.toFixed(1)}%</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </TabsContent>
        </Tabs>
      </main>

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
    </>
  );
};

export default Finances;
