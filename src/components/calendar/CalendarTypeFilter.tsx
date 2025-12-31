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
  { value: "work", label: "Trabajo", icon: Briefcase, color: "bg-primary/20 text-primary" },
  { value: "life", label: "Vida", icon: Heart, color: "bg-success/20 text-success" },
  { value: "finance", label: "Finanzas", icon: Wallet, color: "bg-warning/20 text-warning" },
  { value: "health", label: "Salud", icon: Heart, color: "bg-success/20 text-success" },
  { value: "family", label: "Familia", icon: Heart, color: "bg-warning/20 text-warning" },
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
              <Icon className="w-4 h-4 mr-2" />
              {option.label}
            </DropdownMenuCheckboxItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
