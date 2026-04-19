import { useEffect, useState } from "react";
import { Loader2, RefreshCw, Server, Sparkles, Activity, Zap, Info, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { PageHero } from "@/components/ui/PageHero";
import { useOpenClawHub } from "@/hooks/useOpenClawHub";
import { NodeStatusCard } from "@/components/openclaw/NodeStatusCard";
import { TasksTab } from "@/components/openclaw/TasksTab";
import { RecurringTab } from "@/components/openclaw/RecurringTab";
import { ExecutionsTab } from "@/components/openclaw/ExecutionsTab";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function OpenClawHub() {
  const {
    nodes,
    tasks,
    recurring,
    executions,
    loading,
    refetch,
    createTask,
    createRecurring,
    toggleRecurring,
    deleteRecurring,
    executeNow,
    runTask,
    completeTask,
    deleteTask,
  } = useOpenClawHub();

  useEffect(() => {
    document.title = "OpenClaw Hub | JARVIS";
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const onlineCount = nodes.filter((n) => {
    if (n.status === "online" || n.status === "running") return true;
    if (!n.last_seen_at) return false;
    return (Date.now() - new Date(n.last_seen_at).getTime()) / 60000 < 5;
  }).length;

  const today = new Date().toISOString().slice(0, 10);
  const tokensToday = nodes.reduce(
    (sum, n) => sum + (n.tokens_today_date === today ? n.tokens_today : 0),
    0
  );
  const totalTokens = nodes.reduce((sum, n) => sum + (n.tokens_total || 0), 0);
  const activeTasks = tasks.filter((t) => t.status === "pending" || t.status === "running").length;

  return (
    <div className="container mx-auto p-4 sm:p-6 space-y-6 max-w-7xl">
      <PageHero
        eyebrow="Centro de cómputo"
        eyebrowIcon={<Sparkles className="w-3 h-3" />}
        title={
          <>
            OpenClaw <span className="italic font-serif text-primary">Hub</span>
          </>
        }
        subtitle="Monitor operativo de POTUS y TITAN. Tareas, recurrentes y logs persistentes en Supabase."
        actions={
          <Button variant="outline" size="sm" onClick={refetch} className="rounded-full">
            <RefreshCw className="h-4 w-4 mr-2" /> Refrescar
          </Button>
        }
        stats={[
          { label: "Nodos online", value: `${onlineCount}/${nodes.length}`, icon: <Server className="w-4 h-4" />, tone: "success" },
          { label: "Tareas activas", value: activeTasks, hint: `${tasks.length} totales`, icon: <Activity className="w-4 h-4" />, tone: "primary" },
          { label: "Tokens hoy", value: tokensToday.toLocaleString(), hint: `${totalTokens.toLocaleString()} total`, icon: <Zap className="w-4 h-4" />, tone: "accent" },
          { label: "Recurrentes", value: recurring.filter((r) => r.enabled).length, hint: `${recurring.length} programadas`, tone: "warning" },
        ]}
      />

      <Alert className="border-amber-500/30 bg-amber-500/5">
        <Info className="h-4 w-4 text-amber-400" />
        <AlertTitle className="text-foreground flex items-center gap-2">
          MVP operativo · datos <span className="px-1.5 py-0.5 rounded text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-300">simulated</span>
        </AlertTitle>
        <AlertDescription className="text-muted-foreground text-xs leading-relaxed">
          UI real + DB Supabase real (nodos, tareas, recurrentes, ejecuciones persistentes). Heartbeat, tokens y logs marcados como <span className="text-amber-300">simulated</span> hasta conectar
          <code className="mx-1 px-1.5 py-0.5 rounded bg-muted text-foreground">potus-bridge</code> (Mac Mini local). Crear / Play / Done ya escribe en DB; al conectar el bridge físico, el mismo flujo dispara ejecución real sin cambios en la UI.
        </AlertDescription>
      </Alert>

      {/* Nodos */}
      <div className="grid gap-4 sm:grid-cols-2">
        {nodes.map((n) => (
          <NodeStatusCard key={n.id} node={n} tasks={tasks.filter((t) => t.node_id === n.id)} />
        ))}
      </div>

      {/* Tabs operativos */}
      <Tabs defaultValue="tasks" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="tasks">Tareas</TabsTrigger>
          <TabsTrigger value="recurring">Recurrentes</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>

        <TabsContent value="tasks">
          <TasksTab
            nodes={nodes}
            tasks={tasks}
            onCreate={createTask}
            onRun={runTask}
            onComplete={completeTask}
            onDelete={deleteTask}
          />
        </TabsContent>

        <TabsContent value="recurring">
          <RecurringTab
            nodes={nodes}
            recurring={recurring}
            onCreate={createRecurring}
            onToggle={toggleRecurring}
            onExecute={executeNow}
            onDelete={deleteRecurring}
          />
        </TabsContent>

        <TabsContent value="logs">
          <ExecutionsTab executions={executions} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
