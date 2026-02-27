import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface CostRow {
  service: string;
  operation: string;
  tokens_input: number;
  tokens_output: number;
  api_calls: number;
  cost_usd: number;
}

interface ModelSummary {
  model: string;
  totalCost: number;
  totalInput: number;
  totalOutput: number;
  calls: number;
}

export const AICostTrackerCard = () => {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["ai_cost_tracker", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("project_costs")
        .select("service, operation, tokens_input, tokens_output, api_calls, cost_usd")
        .eq("user_id", user.id);
      if (error) throw error;
      return (data || []) as CostRow[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const rows = data || [];
  const totalCost = rows.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const totalInput = rows.reduce((s, r) => s + (r.tokens_input || 0), 0);
  const totalOutput = rows.reduce((s, r) => s + (r.tokens_output || 0), 0);
  const totalCalls = rows.reduce((s, r) => s + (r.api_calls || 0), 0);

  // Group by model
  const byModel: Record<string, ModelSummary> = {};
  rows.forEach((r) => {
    const key = r.service || "unknown";
    if (!byModel[key]) {
      byModel[key] = { model: key, totalCost: 0, totalInput: 0, totalOutput: 0, calls: 0 };
    }
    byModel[key].totalCost += Number(r.cost_usd || 0);
    byModel[key].totalInput += r.tokens_input || 0;
    byModel[key].totalOutput += r.tokens_output || 0;
    byModel[key].calls += r.api_calls || 0;
  });

  const models = Object.values(byModel).sort((a, b) => b.totalCost - a.totalCost);

  const fmtTokens = (n: number) => {
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
    return String(n);
  };

  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        No hay datos de consumo de IA todavía.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {/* Global totals */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatBox label="Gasto Total" value={`$${totalCost.toFixed(4)}`} />
        <StatBox label="Llamadas API" value={String(totalCalls)} />
        <StatBox label="Tokens Entrada" value={fmtTokens(totalInput)} />
        <StatBox label="Tokens Salida" value={fmtTokens(totalOutput)} />
      </div>

      {/* By model */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground">Desglose por modelo</h3>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/40 text-muted-foreground text-xs">
                <th className="text-left px-3 py-2 font-medium">Modelo</th>
                <th className="text-right px-3 py-2 font-medium">Llamadas</th>
                <th className="text-right px-3 py-2 font-medium">Input</th>
                <th className="text-right px-3 py-2 font-medium">Output</th>
                <th className="text-right px-3 py-2 font-medium">Coste</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const pct = totalCost > 0 ? (m.totalCost / totalCost) * 100 : 0;
                return (
                  <tr key={m.model} className="border-t border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-medium text-foreground">{m.model}</span>
                        <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
                      </div>
                      {/* Mini bar */}
                      <div className="h-1 bg-muted/60 rounded-full mt-1 w-full max-w-[120px]">
                        <div
                          className="h-full bg-primary/60 rounded-full"
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        />
                      </div>
                    </td>
                    <td className="text-right px-3 py-2.5 font-mono text-xs text-muted-foreground">{m.calls}</td>
                    <td className="text-right px-3 py-2.5 font-mono text-xs text-muted-foreground">{fmtTokens(m.totalInput)}</td>
                    <td className="text-right px-3 py-2.5 font-mono text-xs text-muted-foreground">{fmtTokens(m.totalOutput)}</td>
                    <td className="text-right px-3 py-2.5 font-mono text-xs font-medium text-foreground">${m.totalCost.toFixed(4)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const StatBox = ({ label, value }: { label: string; value: string }) => (
  <div className="rounded-lg bg-muted/30 border border-border/50 p-3 text-center">
    <p className="text-lg font-bold font-mono text-foreground">{value}</p>
    <p className="text-[11px] text-muted-foreground font-medium mt-0.5">{label}</p>
  </div>
);
