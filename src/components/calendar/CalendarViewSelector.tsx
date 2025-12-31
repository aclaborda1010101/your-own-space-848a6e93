import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type CalendarView = "day" | "week" | "month" | "year";

interface CalendarViewSelectorProps {
  value: CalendarView;
  onChange: (value: CalendarView) => void;
}

export const CalendarViewSelector = ({ value, onChange }: CalendarViewSelectorProps) => {
  return (
    <ToggleGroup
      type="single"
      value={value}
      onValueChange={(v) => v && onChange(v as CalendarView)}
      className="bg-muted/50 p-1 rounded-lg"
    >
      <ToggleGroupItem value="day" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground">
        Día
      </ToggleGroupItem>
      <ToggleGroupItem value="week" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground">
        Semana
      </ToggleGroupItem>
      <ToggleGroupItem value="month" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground">
        Mes
      </ToggleGroupItem>
      <ToggleGroupItem value="year" className="text-xs px-3 data-[state=on]:bg-background data-[state=on]:text-foreground">
        Año
      </ToggleGroupItem>
    </ToggleGroup>
  );
};
