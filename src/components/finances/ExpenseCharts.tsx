import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";
import { EXPENSE_CATEGORIES } from "@/hooks/useFinances";
import type { FinanceTransaction } from "@/hooks/useFinances";

interface ExpenseChartsProps {
  transactions: FinanceTransaction[];
  expensesByCategory: Record<string, number>;
}

const COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
  "hsl(199, 89%, 48%)",
  "hsl(142, 76%, 36%)",
  "hsl(47, 100%, 50%)",
  "hsl(0, 84%, 60%)",
  "hsl(280, 65%, 60%)",
];

export const ExpenseCharts = ({ transactions, expensesByCategory }: ExpenseChartsProps) => {
  // Prepare data for bar chart - expenses by category
  const barChartData = EXPENSE_CATEGORIES
    .filter((cat) => expensesByCategory[cat.id] > 0)
    .map((cat) => ({
      name: cat.label,
      icon: cat.icon,
      amount: expensesByCategory[cat.id] || 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8); // Top 8 categories

  // Prepare data for pie chart
  const pieChartData = barChartData.map((item, index) => ({
    name: item.name,
    value: item.amount,
    color: COLORS[index % COLORS.length],
  }));

  // Group transactions by week for trend analysis
  const weeklyTrends = transactions
    .filter((t) => t.transaction_type === "expense")
    .reduce((acc, t) => {
      const date = new Date(t.transaction_date);
      const weekStart = new Date(date);
      weekStart.setDate(date.getDate() - date.getDay());
      const weekKey = weekStart.toISOString().split("T")[0];

      if (!acc[weekKey]) {
        acc[weekKey] = { week: weekKey, total: 0, count: 0 };
      }
      acc[weekKey].total += Number(t.amount);
      acc[weekKey].count += 1;
      return acc;
    }, {} as Record<string, { week: string; total: number; count: number }>);

  const weeklyData = Object.values(weeklyTrends)
    .sort((a, b) => a.week.localeCompare(b.week))
    .map((w, i) => ({
      name: `Sem ${i + 1}`,
      gastos: w.total,
      transacciones: w.count,
    }));

  const formatCurrency = (value: number) => `€${value.toFixed(0)}`;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
          <p className="font-medium text-foreground">{label}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} className="text-sm" style={{ color: entry.color }}>
              {entry.name}: €{entry.value.toFixed(2)}
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  if (barChartData.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12 text-muted-foreground">
          No hay datos de gastos para mostrar gráficos
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Bar Chart - Expenses by Category */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Gastos por Categoría</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={barChartData} layout="vertical" margin={{ left: 20, right: 20 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis type="number" tickFormatter={formatCurrency} className="text-xs" />
              <YAxis 
                type="category" 
                dataKey="name" 
                width={100} 
                tick={{ fontSize: 12 }}
                className="text-xs"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar 
                dataKey="amount" 
                fill="hsl(var(--primary))" 
                radius={[0, 4, 4, 0]}
                name="Gastos"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pie Chart - Distribution */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Distribución de Gastos</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={pieChartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                labelLine={false}
              >
                {pieChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value: number) => [`€${value.toFixed(2)}`, "Gastos"]}
              />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Weekly Trend */}
      {weeklyData.length > 1 && (
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Evolución Semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={weeklyData} margin={{ left: 10, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" className="text-xs" />
                <YAxis tickFormatter={formatCurrency} className="text-xs" />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar 
                  dataKey="gastos" 
                  fill="hsl(var(--destructive))" 
                  radius={[4, 4, 0, 0]}
                  name="Gastos"
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
