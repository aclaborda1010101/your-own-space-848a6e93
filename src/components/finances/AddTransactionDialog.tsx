import { useState, useMemo } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, FinanceAccount, FinanceTransaction } from "@/hooks/useFinances";
import { format } from "date-fns";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  accounts: FinanceAccount[];
  onSubmit: (transaction: Omit<FinanceTransaction, "id" | "user_id" | "created_at" | "updated_at">) => Promise<unknown>;
  isInvoice?: boolean;
}

export const AddTransactionDialog = ({ open, onOpenChange, type, accounts, onSubmit, isInvoice = false }: AddTransactionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [invoiceStatus, setInvoiceStatus] = useState<string>("pending");
  const [dueDate, setDueDate] = useState("");

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const selectedCategory = useMemo(() => {
    return categories.find(c => c.id === category);
  }, [category, categories]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    setLoading(true);
    await onSubmit({
      transaction_type: type,
      amount: parseFloat(amount),
      category,
      subcategory: subcategory || null,
      description: description || null,
      vendor: vendor || null,
      account_id: accountId || null,
      transaction_date: date,
      currency: "EUR",
      is_recurring: isRecurring,
      recurring_frequency: isRecurring ? recurringFrequency : null,
      invoice_number: isInvoice ? invoiceNumber || null : null,
      invoice_status: isInvoice ? (invoiceStatus as "pending" | "paid" | "overdue") : null,
      due_date: isInvoice && dueDate ? dueDate : null,
      tags: []
    });

    setLoading(false);
    resetForm();
    onOpenChange(false);
  };

  const resetForm = () => {
    setAmount("");
    setCategory("");
    setSubcategory("");
    setDescription("");
    setVendor("");
    setAccountId("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    setIsRecurring(false);
    setRecurringFrequency("");
    setInvoiceNumber("");
    setInvoiceStatus("pending");
    setDueDate("");
  };

  const title = isInvoice 
    ? (type === "income" ? "Emitir Factura" : "Registrar Factura Recibida")
    : (type === "income" ? "Añadir Ingreso" : "Añadir Gasto");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="amount">Cantidad (€)</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="category">Categoría</Label>
            <Select value={category} onValueChange={(v) => { setCategory(v); setSubcategory(""); }}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una categoría" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {cat.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedCategory && selectedCategory.subcategories.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="subcategory">Subcategoría</Label>
              <Select value={subcategory} onValueChange={setSubcategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {selectedCategory.subcategories.map(sub => (
                    <SelectItem key={sub.id} value={sub.id}>
                      {sub.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Input
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descripción opcional"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="vendor">{type === "income" ? "Cliente" : "Proveedor"}</Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder={type === "income" ? "Nombre del cliente" : "Nombre del proveedor"}
            />
          </div>

          {accounts.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="account">Cuenta</Label>
              <Select value={accountId} onValueChange={setAccountId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona una cuenta (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {accounts.map(acc => (
                    <SelectItem key={acc.id} value={acc.id}>
                      {acc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Recurring toggle */}
          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
            <div>
              <Label htmlFor="recurring" className="text-sm font-medium">Recurrente</Label>
              <p className="text-xs text-muted-foreground">Se repite periódicamente</p>
            </div>
            <Switch
              id="recurring"
              checked={isRecurring}
              onCheckedChange={setIsRecurring}
            />
          </div>

          {isRecurring && (
            <div className="space-y-2">
              <Label htmlFor="frequency">Frecuencia</Label>
              <Select value={recurringFrequency} onValueChange={setRecurringFrequency}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona frecuencia" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="weekly">Semanal</SelectItem>
                  <SelectItem value="monthly">Mensual</SelectItem>
                  <SelectItem value="quarterly">Trimestral</SelectItem>
                  <SelectItem value="yearly">Anual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Invoice fields */}
          {isInvoice && (
            <>
              <div className="border-t pt-4 space-y-4">
                <h4 className="text-sm font-medium text-foreground">Datos de factura</h4>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="invoiceNumber">Nº Factura</Label>
                    <Input
                      id="invoiceNumber"
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="FAC-001"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="invoiceStatus">Estado</Label>
                    <Select value={invoiceStatus} onValueChange={setInvoiceStatus}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">⏳ Pendiente</SelectItem>
                        <SelectItem value="paid">✅ Cobrada</SelectItem>
                        <SelectItem value="overdue">⚠️ Vencida</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dueDate">Fecha de vencimiento</Label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              </div>
            </>
          )}

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
