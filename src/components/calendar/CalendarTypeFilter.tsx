import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Briefcase, Heart, Wallet, Filter } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type EventType = "work" | "life" | "health" | "family" | "finance";

interface CalendarTypeFilterProps {
  selectedTypes: EventType[];
  onChange: (types: EventType[]) => void;
}

const typeOptions: { value: EventType; label: string; icon: React.ElementType; color: string }[] = [
  { value: "work", label: "Trabajo", icon: Briefcase, color: "text-blue-400" },
  { value: "life", label: "Vida", icon: Heart, color: "text-emerald-400" },
  { value: "finance", label: "Finanzas", icon: Wallet, color: "text-amber-400" },
  { value: "health", label: "Salud", icon: Heart, color: "text-rose-400" },
  { value: "family", label: "Familia", icon: Heart, color: "text-violet-400" },
];

export const CalendarTypeFilter = ({ selectedTypes, onChange }: CalendarTypeFilterProps) => {
  const allSelected = selectedTypes.length === 0 || selectedTypes.length === typeOptions.length;

  const handleToggle = (type: EventType) => {
    if (selectedTypes.includes(type)) {
      onChange(selectedTypes.filter((t) => t !== type));
    } else {
      onChange([...selectedTypes, type]);
    }
  };

  const handleSelectAll = () => {
    onChange([]);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="border-border gap-2">
          <Filter className="w-4 h-4" />
          Filtrar
          {!allSelected && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              {selectedTypes.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Filtrar por tipo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem checked={allSelected} onCheckedChange={handleSelectAll}>
          Todos
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        {typeOptions.map((option) => {
          const Icon = option.icon;
          return (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={allSelected || selectedTypes.includes(option.value)}
              onCheckedChange={() => handleToggle(option.value)}
            >
              <Icon className={`w-4 h-4 mr-2 ${option.color}`} />
              {option.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
