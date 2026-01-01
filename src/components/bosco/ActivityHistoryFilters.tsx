import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ActivityHistoryFiltersProps {
  activityType: string;
  setActivityType: (type: string) => void;
  dateFrom: string;
  setDateFrom: (date: string) => void;
  dateTo: string;
  setDateTo: (date: string) => void;
  onClear: () => void;
}

const ACTIVITY_TYPES = [
  { value: "all", label: "Todos los tipos" },
  { value: "juego_vinculo", label: "Juego & Vínculo" },
  { value: "lectura", label: "Lectura" },
  { value: "ingles_ludico", label: "Inglés Lúdico" },
  { value: "ia_ninos", label: "IA para Niños" },
  { value: "movimiento", label: "Movimiento" },
  { value: "cierre_dia", label: "Cierre del Día" },
];

export function ActivityHistoryFilters({
  activityType,
  setActivityType,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  onClear,
}: ActivityHistoryFiltersProps) {
  const hasFilters = activityType !== "all" || dateFrom || dateTo;

  return (
    <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
      {/* Activity Type */}
      <div className="space-y-1.5 min-w-[160px]">
        <Label className="text-xs text-muted-foreground">Tipo</Label>
        <Select value={activityType} onValueChange={setActivityType}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ACTIVITY_TYPES.map((type) => (
              <SelectItem key={type.value} value={type.value}>
                {type.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date From */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Desde</Label>
        <Input
          type="date"
          value={dateFrom}
          onChange={(e) => setDateFrom(e.target.value)}
          className="h-9 w-[140px]"
        />
      </div>

      {/* Date To */}
      <div className="space-y-1.5">
        <Label className="text-xs text-muted-foreground">Hasta</Label>
        <Input
          type="date"
          value={dateTo}
          onChange={(e) => setDateTo(e.target.value)}
          className="h-9 w-[140px]"
        />
      </div>

      {/* Clear Button */}
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          className="h-9 gap-1"
          onClick={onClear}
        >
          <X className="w-4 h-4" />
          Limpiar
        </Button>
      )}
    </div>
  );
}
