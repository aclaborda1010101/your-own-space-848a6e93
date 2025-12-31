import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FinanceAccount } from "@/hooks/useFinances";

interface AddAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (account: Omit<FinanceAccount, "id" | "user_id" | "created_at" | "updated_at">) => Promise<unknown>;
}

const ACCOUNT_TYPES = [
  { id: "bank", label: "Cuenta bancaria", icon: "🏦" },
  { id: "cash", label: "Efectivo", icon: "💵" },
  { id: "investment", label: "Inversión", icon: "📈" },
  { id: "credit", label: "Crédito", icon: "💳" }
];

export const AddAccountDialog = ({ open, onOpenChange, onSubmit }: AddAccountDialogProps) => {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [accountType, setAccountType] = useState<"bank" | "cash" | "investment" | "credit">("bank");
  const [balance, setBalance] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;

    setLoading(true);
    await onSubmit({
      name,
      account_type: accountType,
      balance: parseFloat(balance) || 0,
      currency: "EUR",
      is_active: true
    });

    setLoading(false);
    setName("");
    setAccountType("bank");
    setBalance("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Nueva Cuenta</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Nombre de la cuenta</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Cuenta principal"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="type">Tipo de cuenta</Label>
            <Select value={accountType} onValueChange={(v) => setAccountType(v as typeof accountType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map(type => (
                  <SelectItem key={type.id} value={type.id}>
                    {type.icon} {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="balance">Saldo inicial (€)</Label>
            <Input
              id="balance"
              type="number"
              step="0.01"
              value={balance}
              onChange={(e) => setBalance(e.target.value)}
              placeholder="0.00"
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Creando..." : "Crear Cuenta"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
