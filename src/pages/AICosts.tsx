import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, DollarSign, Zap, ArrowDownRight, ArrowUpRight, Filter, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";

interface CostRow {
  id: string;
  service: string | null;
  operation: string | null;
  tokens_input: number | null;
  tokens_output: number | null;
  api_calls: number | null;
  cost_usd: number | null;
  created_at: string | null;
  project_id: string | null;
  metadata: Record<string, unknown> | null;
}

const MODEL_COLORS: Record<string, string> = {
  "gemini-flash": "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  "gemini-pro": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  "claude-sonnet": "bg-orange-500/15 text-orange-400 border-orange-500/30",
  "claude-haiku": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  "deepseek-v3": "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  "whisper": "bg-pink-500/15 text-pink-400 border-pink-500/30",
  "gpt-5": "bg-green-500/15 text-green-400 border-green-500/30",
};

const fmtTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
};

const fmtCost = (n: number) => (n < 0.01 ? `€${n.toFixed(4)}` : `€${n.toFixed(2)}`);

const PAGE_SIZE = 50;

export default function AICosts() {
  const { user } = useAuth();
  const [filterModel, setFilterModel] = useState<string>("");
  const [filterOp, setFilterOp] = useState<string>("");
  const [page, setPage] = useState(0);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["ai_costs_full", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("project_costs")
        .select("id, service, operation, tokens_input, tokens_output, api_calls, cost_usd, created_at, project_id, metadata")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as CostRow[];
    },
    enabled: !!user,
  });

  // Derived data
  const models = useMemo(() => [...new Set(rows.map((r) => r.service || "unknown"))].sort(), [rows]);
  const operations = useMemo(() => [...new Set(rows.map((r) => r.operation || "unknown"))].sort(), [rows]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filterModel && (r.service || "unknown") !== filterModel) return false;
      if (filterOp && (r.operation || "unknown") !== filterOp) return false;
      return true;
    });
  }, [rows, filterModel, filterOp]);

  const totalCost = filtered.reduce((s, r) => s + Number(r.cost_usd || 0), 0);
  const totalInput = filtered.reduce((s, r) => s + (r.tokens_input || 0), 0);
  const totalOutput = filtered.reduce((s, r) => s + (r.tokens_output || 0), 0);
  const totalCalls = filtered.reduce((s, r) => s + (r.api_calls || 0), 0);

  // Daily chart
  const dailyData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.forEach((r) => {
      if (!r.created_at) return;
      const day = r.created_at.substring(0, 10);
      map[day] = (map[day] || 0) + Number(r.cost_usd || 0);
    });
    return Object.entries(map)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-30)
      .map(([date, cost]) => ({ date: date.slice(5), cost: +cost.toFixed(4) }));
  }, [filtered]);

  // Group by model
  const byModel = useMemo(() => {
    const map: Record<string, { cost: number; calls: number; input: number; output: number }> = {};
    filtered.forEach((r) => {
      const k = r.service || "unknown";
      if (!map[k]) map[k] = { cost: 0, calls: 0, input: 0, output: 0 };
      map[k].cost += Number(r.cost_usd || 0);
      map[k].calls += r.api_calls || 0;
      map[k].input += r.tokens_input || 0;
      map[k].output += r.tokens_output || 0;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.cost - a.cost);
  }, [filtered]);

  // Group by operation
  const byOp = useMemo(() => {
    const map: Record<string, { cost: number; calls: number; input: number; output: number }> = {};
    filtered.forEach((r) => {
      const k = r.operation || "unknown";
      if (!map[k]) map[k] = { cost: 0, calls: 0, input: 0, output: 0 };
      map[k].cost += Number(r.cost_usd || 0);
      map[k].calls += r.api_calls || 0;
      map[k].input += r.tokens_input || 0;
      map[k].output += r.tokens_output || 0;
    });
    return Object.entries(map).sort(([, a], [, b]) => b.cost - a.cost);
  }, [filtered]);

  // Pagination
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);

  const hasFilters = filterModel || filterOp;

  if (isLoading) {
    return (
      <main className="flex-1 p-4 md:p-6 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="flex-1 p-4 md:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Consumos IA</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Historial detallado de uso y costes de modelos de IA
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={DollarSign} label="Gasto Total" value={fmtCost(totalCost)} color="text-primary" />
        <StatCard icon={Zap} label="Llamadas API" value={String(totalCalls)} color="text-amber-400" />
        <StatCard icon={ArrowDownRight} label="Tokens Entrada" value={fmtTokens(totalInput)} color="text-emerald-400" />
        <StatCard icon={ArrowUpRight} label="Tokens Salida" value={fmtTokens(totalOutput)} color="text-blue-400" />
      </div>

      {/* Daily Chart */}
      {dailyData.length > 1 && (
        <Card className="border-border/50">
          <CardContent className="pt-5 pb-3">
            <h3 className="text-sm font-semibold text-foreground mb-3">Gasto diario (últimos 30 días)</h3>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                    formatter={(value: number) => [`€${value.toFixed(4)}`, "Coste"]}
                  />
                  <Bar dataKey="cost" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs: Historial / Por Modelo / Por Función */}
      <Tabs defaultValue="history" className="space-y-4">
        <TabsList>
          <TabsTrigger value="history">Historial</TabsTrigger>
          <TabsTrigger value="models">Por Modelo</TabsTrigger>
          <TabsTrigger value="operations">Por Función</TabsTrigger>
        </TabsList>

        {/* ── Historial ── */}
        <TabsContent value="history" className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <select
              value={filterModel}
              onChange={(e) => { setFilterModel(e.target.value); setPage(0); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Todos los modelos</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
            <select
              value={filterOp}
              onChange={(e) => { setFilterOp(e.target.value); setPage(0); }}
              className="h-8 rounded-md border border-input bg-background px-2 text-xs"
            >
              <option value="">Todas las operaciones</option>
              {operations.map((o) => <option key={o} value={o}>{o}</option>)}
            </select>
            {hasFilters && (
              <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => { setFilterModel(""); setFilterOp(""); setPage(0); }}>
                <X className="w-3 h-3 mr-1" /> Limpiar
              </Button>
            )}
            <span className="text-xs text-muted-foreground ml-auto">{filtered.length} registros</span>
          </div>

          <div className="rounded-lg border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="text-xs">Fecha</TableHead>
                  <TableHead className="text-xs">Operación</TableHead>
                  <TableHead className="text-xs">Modelo</TableHead>
                  <TableHead className="text-xs text-right">Input</TableHead>
                  <TableHead className="text-xs text-right">Output</TableHead>
                  <TableHead className="text-xs text-right">Coste</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                      No hay registros
                    </TableCell>
                  </TableRow>
                ) : (
                  paginated.map((r) => (
                    <TableRow key={r.id} className="hover:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {r.created_at ? format(new Date(r.created_at), "dd MMM HH:mm", { locale: es }) : "—"}
                      </TableCell>
                      <TableCell className="text-xs font-mono">{r.operation || "—"}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[10px] font-mono ${MODEL_COLORS[r.service || ""] || "border-border"}`}>
                          {r.service || "unknown"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">
                        {fmtTokens(r.tokens_input || 0)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono text-muted-foreground">
                        {fmtTokens(r.tokens_output || 0)}
                      </TableCell>
                      <TableCell className="text-xs text-right font-mono font-medium">
                        {fmtCost(Number(r.cost_usd || 0))}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage(page - 1)}>
                Anterior
              </Button>
              <span className="text-xs text-muted-foreground">
                {page + 1} / {totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(page + 1)}>
                Siguiente
              </Button>
            </div>
          )}
        </TabsContent>

        {/* ── Por Modelo ── */}
        <TabsContent value="models">
          <GroupTable items={byModel} totalCost={totalCost} />
        </TabsContent>

        {/* ── Por Función ── */}
        <TabsContent value="operations">
          <GroupTable items={byOp} totalCost={totalCost} />
        </TabsContent>
      </Tabs>
    </main>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: string; color: string }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-lg bg-muted/50 flex items-center justify-center ${color}`}>
          <Icon className="w-4 h-4" />
        </div>
        <div>
          <p className="text-lg font-bold font-mono text-foreground">{value}</p>
          <p className="text-[11px] text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function GroupTable({ items, totalCost }: { items: [string, { cost: number; calls: number; input: number; output: number }][]; totalCost: number }) {
  return (
    <div className="rounded-lg border border-border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/40">
            <TableHead className="text-xs">Nombre</TableHead>
            <TableHead className="text-xs text-right">Llamadas</TableHead>
            <TableHead className="text-xs text-right">Input</TableHead>
            <TableHead className="text-xs text-right">Output</TableHead>
            <TableHead className="text-xs text-right">Coste</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map(([name, data]) => {
            const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
            return (
              <TableRow key={name} className="hover:bg-muted/20">
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={`text-[10px] font-mono ${MODEL_COLORS[name] || "border-border"}`}>
                      {name}
                    </Badge>
                    <span className="text-[10px] text-muted-foreground">({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="h-1 bg-muted/60 rounded-full mt-1 w-full max-w-[120px]">
                    <div className="h-full bg-primary/60 rounded-full" style={{ width: `${Math.max(pct, 2)}%` }} />
                  </div>
                </TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground">{data.calls}</TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground">{fmtTokens(data.input)}</TableCell>
                <TableCell className="text-right text-xs font-mono text-muted-foreground">{fmtTokens(data.output)}</TableCell>
                <TableCell className="text-right text-xs font-mono font-medium">{fmtCost(data.cost)}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
