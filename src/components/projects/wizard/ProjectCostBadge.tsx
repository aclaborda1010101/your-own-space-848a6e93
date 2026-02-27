import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DollarSign } from "lucide-react";
import { formatCost } from "@/config/projectCostRates";
import type { ProjectCost } from "@/hooks/useProjectWizard";

interface Props {
  totalCost: number;
  costs: ProjectCost[];
}

const STEP_NAMES = [
  "", "Entrada", "Extracción", "Alcance", "Auditoría", "Doc. Final",
  "AI Leverage", "PRD", "RAGs", "Patrones",
];

export const ProjectCostBadge = ({ totalCost, costs }: Props) => {
  if (costs.length === 0) return null;

  // Group by step
  const byStep = costs.reduce((acc, c) => {
    const key = c.stepNumber;
    if (!acc[key]) acc[key] = { total: 0, items: [] };
    acc[key].total += c.costUsd;
    acc[key].items.push(c);
    return acc;
  }, {} as Record<number, { total: number; items: ProjectCost[] }>);

  // Group by service
  const byService = costs.reduce((acc, c) => {
    if (!acc[c.service]) acc[c.service] = 0;
    acc[c.service] += c.costUsd;
    return acc;
  }, {} as Record<string, number>);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Badge variant="outline" className="cursor-pointer gap-1 text-xs hover:bg-muted/50 transition-colors">
          <DollarSign className="w-3 h-3" />
          {formatCost(totalCost)}
        </Badge>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="end">
        <Card className="border-0 shadow-none">
          <CardHeader className="pb-2 px-4 pt-4">
            <CardTitle className="text-xs font-mono text-muted-foreground">COSTE DEL PROYECTO</CardTitle>
            <p className="text-lg font-bold text-foreground">{formatCost(totalCost)}</p>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* By step */}
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-1">POR PASO</p>
              {Object.entries(byStep).map(([step, data]) => (
                <div key={step} className="flex justify-between text-xs py-0.5">
                  <span className="text-foreground">{STEP_NAMES[Number(step)] || `Paso ${step}`}</span>
                  <span className="text-muted-foreground font-mono">{formatCost(data.total)}</span>
                </div>
              ))}
            </div>
            {/* By service */}
            <div>
              <p className="text-xs font-mono text-muted-foreground mb-1">POR SERVICIO</p>
              {Object.entries(byService).map(([service, cost]) => (
                <div key={service} className="flex justify-between text-xs py-0.5">
                  <span className="text-foreground">{service}</span>
                  <span className="text-muted-foreground font-mono">{formatCost(cost)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </PopoverContent>
    </Popover>
  );
};
