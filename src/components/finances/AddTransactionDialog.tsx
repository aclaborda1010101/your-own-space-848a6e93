import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, FinanceAccount, FinanceTransaction } from "@/hooks/useFinances";
import { format } from "date-fns";

interface AddTransactionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "income" | "expense";
  accounts: FinanceAccount[];
  onSubmit: (transaction: Omit<FinanceTransaction, "id" | "user_id" | "created_at" | "updated_at">) => Promise<unknown>;
}

export const AddTransactionDialog = ({ open, onOpenChange, type, accounts, onSubmit }: AddTransactionDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [vendor, setVendor] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));

  const categories = type === "income" ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || !category) return;

    setLoading(true);
    await onSubmit({
      transaction_type: type,
      amount: parseFloat(amount),
      category,
      subcategory: null,
      description: description || null,
      vendor: vendor || null,
      account_id: accountId || null,
      transaction_date: date,
      currency: "EUR",
      is_recurring: false,
      recurring_frequency: null,
      invoice_number: null,
      invoice_status: null,
      due_date: null,
      tags: []
    });

    setLoading(false);
    setAmount("");
    setCategory("");
    setDescription("");
    setVendor("");
    setAccountId("");
    setDate(format(new Date(), "yyyy-MM-dd"));
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {type === "income" ? "Añadir Ingreso" : "Añadir Gasto"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
            <Label htmlFor="category">Categoría</Label>
            <Select value={category} onValueChange={setCategory} required>
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
            <Label htmlFor="vendor">{type === "income" ? "Cliente/Fuente" : "Proveedor/Tienda"}</Label>
            <Input
              id="vendor"
              value={vendor}
              onChange={(e) => setVendor(e.target.value)}
              placeholder="Opcional"
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
