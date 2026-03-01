import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Euro } from "lucide-react";
import { formatCost } from "@/config/projectCostRates";
import type { ProjectCost } from "@/hooks/useProjectWizard";

interface Props {
  totalCost: number;
  costs: ProjectCost[];
}

const STEP_NAMES = [
  "", "Entrada", "Extracción", "Alcance", "Auditoría", "Doc. Final",
  "Auditoría IA", "PRD", "RAGs", "Patrones",
];

export const ProjectCostBadge = ({ totalCost, costs }: Props) => {
  if (costs.length === 0) return null;

  const byStep = costs.reduce((acc, c) => {
    const key = c.stepNumber;
    if (!acc[key]) acc[key] = { total: 0, items: [] };
    acc[key].total += c.costUsd;
    acc[key].items.push(c);
    return acc;
  }, {} as Record<number, { total: number; items: ProjectCost[] }>);

  const byService = costs.reduce((acc, c) => {
    if (!acc[c.service]) acc[c.service] = 0;
    acc[c.service] += c.costUsd;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge 
          variant="outline" 
          className="cursor-pointer gap-1.5 text-xs hover:bg-primary/10 hover:border-primary/30 transition-all px-3 py-1"
        >
          <Euro className="w-3 h-3 text-primary" />
          <span className="font-mono">{formatCost(totalCost)}</span>
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <div className="p-4 space-y-4">
          <div>
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest">Coste del Proyecto</p>
            <p className="text-xl font-bold text-foreground mt-0.5 font-mono">{formatCost(totalCost)}</p>
          </div>
          
          <div className="h-px bg-border/50" />

          <div>
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Por Paso</p>
            <div className="space-y-1">
              {Object.entries(byStep).map(([step, data]) => (
                <div key={step} className="flex justify-between text-xs py-0.5">
                  <span className="text-foreground/80">{STEP_NAMES[Number(step)] || `Paso ${step}`}</span>
                  <span className="text-muted-foreground font-mono">{formatCost(data.total)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="h-px bg-border/50" />

          <div>
            <p className="text-[10px] font-mono text-muted-foreground/60 uppercase tracking-widest mb-2">Por Servicio</p>
            <div className="space-y-1">
              {Object.entries(byService).map(([service, cost]) => (
                <div key={service} className="flex justify-between text-xs py-0.5">
                  <span className="text-foreground/80">{service}</span>
                  <span className="text-muted-foreground font-mono">{formatCost(cost)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
};
