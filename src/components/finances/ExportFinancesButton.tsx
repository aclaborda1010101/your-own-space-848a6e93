import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import type { FinanceTransaction, FinanceAccount, FinanceBudget, FinanceGoal } from "@/hooks/useFinances";

interface ExportFinancesButtonProps {
  transactions: FinanceTransaction[];
  accounts: FinanceAccount[];
  budgets: FinanceBudget[];
  goals: FinanceGoal[];
  selectedMonth: Date;
}

export const ExportFinancesButton = ({
  transactions,
  accounts,
  budgets,
  goals,
  selectedMonth,
}: ExportFinancesButtonProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("es-ES", {
      style: "decimal",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const escapeCSV = (value: string | number | boolean | null | undefined): string => {
    if (value === null || value === undefined) return "";
    const str = String(value);
    if (str.includes(",") || str.includes('"') || str.includes("\n")) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const generateTransactionsCSV = (): string => {
    const headers = [
      "Fecha",
      "Tipo",
      "Categoría",
      "Subcategoría",
      "Descripción",
      "Importe",
      "Moneda",
      "Proveedor/Cliente",
      "Recurrente",
      "Frecuencia",
      "Nº Factura",
      "Estado Factura",
      "Fecha Vencimiento",
    ];

    const rows = transactions.map((t) => [
      format(new Date(t.transaction_date), "dd/MM/yyyy"),
      t.transaction_type === "income" ? "Ingreso" : t.transaction_type === "expense" ? "Gasto" : "Transferencia",
      t.category,
      t.subcategory || "",
      t.description || "",
      formatCurrency(Number(t.amount)),
      t.currency,
      t.vendor || "",
      t.is_recurring ? "Sí" : "No",
      t.recurring_frequency || "",
      t.invoice_number || "",
      t.invoice_status === "paid" ? "Pagada" : t.invoice_status === "pending" ? "Pendiente" : t.invoice_status === "overdue" ? "Vencida" : "",
      t.due_date ? format(new Date(t.due_date), "dd/MM/yyyy") : "",
    ]);

    return [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");
  };

  const generateAccountsCSV = (): string => {
    const headers = ["Nombre", "Tipo", "Balance", "Moneda", "Activa"];

    const rows = accounts.map((a) => [
      a.name,
      a.account_type === "bank" ? "Banco" : a.account_type === "cash" ? "Efectivo" : a.account_type === "investment" ? "Inversión" : "Crédito",
      formatCurrency(Number(a.balance)),
      a.currency,
      a.is_active ? "Sí" : "No",
    ]);

    return [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");
  };

  const generateBudgetsCSV = (): string => {
    const headers = ["Categoría", "Presupuesto", "Período", "Fecha Inicio", "Fecha Fin", "Umbral Alerta", "Activo"];

    const rows = budgets.map((b) => [
      b.category,
      formatCurrency(Number(b.budget_amount)),
      b.period === "monthly" ? "Mensual" : b.period === "weekly" ? "Semanal" : "Anual",
      format(new Date(b.start_date), "dd/MM/yyyy"),
      b.end_date ? format(new Date(b.end_date), "dd/MM/yyyy") : "",
      `${b.alert_threshold}%`,
      b.is_active ? "Sí" : "No",
    ]);

    return [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");
  };

  const generateGoalsCSV = (): string => {
    const headers = ["Nombre", "Objetivo", "Actual", "Progreso", "Fecha Límite", "Prioridad", "Estado"];

    const rows = goals.map((g) => [
      g.name,
      formatCurrency(Number(g.target_amount)),
      formatCurrency(Number(g.current_amount)),
      `${Math.round((Number(g.current_amount) / Number(g.target_amount)) * 100)}%`,
      g.deadline ? format(new Date(g.deadline), "dd/MM/yyyy") : "",
      g.priority === "high" ? "Alta" : g.priority === "medium" ? "Media" : "Baja",
      g.status === "active" ? "Activo" : g.status === "completed" ? "Completado" : "Pausado",
    ]);

    return [
      headers.map(escapeCSV).join(","),
      ...rows.map((row) => row.map(escapeCSV).join(",")),
    ].join("\n");
  };

  const downloadCSV = (content: string, filename: string) => {
    const BOM = "\uFEFF"; // UTF-8 BOM for Excel compatibility
    const blob = new Blob([BOM + content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportTransactions = () => {
    const csv = generateTransactionsCSV();
    const monthName = format(selectedMonth, "MMMM-yyyy", { locale: es });
    downloadCSV(csv, `transacciones-${monthName}.csv`);
    toast.success("Transacciones exportadas correctamente");
  };

  const handleExportAccounts = () => {
    const csv = generateAccountsCSV();
    downloadCSV(csv, `cuentas-${format(new Date(), "dd-MM-yyyy")}.csv`);
    toast.success("Cuentas exportadas correctamente");
  };

  const handleExportBudgets = () => {
    const csv = generateBudgetsCSV();
    downloadCSV(csv, `presupuestos-${format(new Date(), "dd-MM-yyyy")}.csv`);
    toast.success("Presupuestos exportados correctamente");
  };

  const handleExportGoals = () => {
    const csv = generateGoalsCSV();
    downloadCSV(csv, `metas-${format(new Date(), "dd-MM-yyyy")}.csv`);
    toast.success("Metas exportadas correctamente");
  };

  const handleExportAll = () => {
    const monthName = format(selectedMonth, "MMMM-yyyy", { locale: es });
    
    // Export each file
    downloadCSV(generateTransactionsCSV(), `transacciones-${monthName}.csv`);
    downloadCSV(generateAccountsCSV(), `cuentas-${format(new Date(), "dd-MM-yyyy")}.csv`);
    downloadCSV(generateBudgetsCSV(), `presupuestos-${format(new Date(), "dd-MM-yyyy")}.csv`);
    downloadCSV(generateGoalsCSV(), `metas-${format(new Date(), "dd-MM-yyyy")}.csv`);
    
    toast.success("Todos los datos exportados correctamente");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Download className="w-4 h-4" />
          Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={handleExportTransactions}>
          <FileSpreadsheet className="w-4 h-4 mr-2" />
          Transacciones del mes
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportAccounts}>
          <FileText className="w-4 h-4 mr-2" />
          Cuentas
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportBudgets}>
          <FileText className="w-4 h-4 mr-2" />
          Presupuestos
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportGoals}>
          <FileText className="w-4 h-4 mr-2" />
          Metas financieras
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleExportAll}>
          <Download className="w-4 h-4 mr-2" />
          Exportar todo
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
