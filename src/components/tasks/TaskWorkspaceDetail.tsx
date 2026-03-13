import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Clock3, FileText, Save, Sparkles } from "lucide-react";

export type TaskWorkspaceStatus = "pendiente" | "en-curso" | "bloqueada" | "hecha";

export interface TaskWorkspaceRecord {
  taskId: string;
  title: string;
  status: TaskWorkspaceStatus;
  nextStep: string;
  detail: string;
  lastUpdatedAt: string;
}

interface TaskWorkspaceTask {
  id: string;
  title: string;
  completed: boolean;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
}

interface TaskWorkspaceDetailProps {
  task: TaskWorkspaceTask | null;
  workspace: TaskWorkspaceRecord | null;
  onSave: (taskId: string, updates: Omit<TaskWorkspaceRecord, "taskId">) => void;
}

const statusConfig: Record<TaskWorkspaceStatus, { label: string; className: string }> = {
  pendiente: { label: "Pendiente", className: "bg-muted text-muted-foreground border-border" },
  "en-curso": { label: "En curso", className: "bg-primary/10 text-primary border-primary/20" },
  bloqueada: { label: "Bloqueada", className: "bg-destructive/10 text-destructive border-destructive/20" },
  hecha: { label: "Hecha", className: "bg-success/10 text-success border-success/20" },
};

const formatLastUpdated = (value?: string) => {
  if (!value) return "Sin cambios todavía";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Sin cambios todavía";

  return new Intl.DateTimeFormat("es-ES", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
};

export const buildDefaultWorkspace = (task: TaskWorkspaceTask): TaskWorkspaceRecord => ({
  taskId: task.id,
  title: task.title,
  status: task.completed ? "hecha" : "pendiente",
  nextStep: task.completed ? "Tarea completada" : "Definir siguiente paso",
  detail: task.completed
    ? "Expediente generado automáticamente. La tarea ya figura como completada."
    : "Expediente vivo listo para completar contexto, decisiones y progreso.",
  lastUpdatedAt: new Date().toISOString(),
});

export const TaskWorkspaceDetail = ({ task, workspace, onSave }: TaskWorkspaceDetailProps) => {
  const resolvedWorkspace = useMemo(() => {
    if (!task) return null;
    return workspace ?? buildDefaultWorkspace(task);
  }, [task, workspace]);

  const [title, setTitle] = useState("");
  const [status, setStatus] = useState<TaskWorkspaceStatus>("pendiente");
  const [nextStep, setNextStep] = useState("");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    if (!resolvedWorkspace) {
      setTitle("");
      setStatus("pendiente");
      setNextStep("");
      setDetail("");
      return;
    }

    setTitle(resolvedWorkspace.title);
    setStatus(resolvedWorkspace.status);
    setNextStep(resolvedWorkspace.nextStep);
    setDetail(resolvedWorkspace.detail);
  }, [resolvedWorkspace]);

  if (!task || !resolvedWorkspace) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="py-10 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <FileText className="h-5 w-5 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">Selecciona una tarea</p>
          <p className="mt-1 text-sm text-muted-foreground">
            El expediente vivo aparecerá aquí con su estado, siguiente paso y detalle.
          </p>
        </CardContent>
      </Card>
    );
  }

  const handleSave = () => {
    onSave(task.id, {
      title: title.trim() || task.title,
      status,
      nextStep: nextStep.trim() || "Sin siguiente paso definido",
      detail: detail.trim() || "Sin detalle adicional",
      lastUpdatedAt: new Date().toISOString(),
    });
  };

  return (
    <Card className="border-border bg-card sticky top-4">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Expediente vivo</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">Vista detalle editable de la tarea seleccionada.</p>
          </div>
          <Badge variant="outline" className={statusConfig[status].className}>
            {statusConfig[status].label}
          </Badge>
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-background/60 p-3 text-sm sm:grid-cols-2">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Prioridad</p>
            <p className="mt-1 font-medium text-foreground">{task.priority}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Duración</p>
            <p className="mt-1 font-medium text-foreground">{task.duration} min</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Tipo</p>
            <p className="mt-1 font-medium capitalize text-foreground">{task.type}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">Último cambio</p>
            <p className="mt-1 flex items-center gap-2 font-medium text-foreground">
              <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
              {formatLastUpdated(resolvedWorkspace.lastUpdatedAt)}
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="workspace-title">Título</Label>
          <Input
            id="workspace-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <Select value={status} onValueChange={(value: TaskWorkspaceStatus) => setStatus(value)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pendiente">Pendiente</SelectItem>
              <SelectItem value="en-curso">En curso</SelectItem>
              <SelectItem value="bloqueada">Bloqueada</SelectItem>
              <SelectItem value="hecha">Hecha</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-next-step">Siguiente paso</Label>
          <Input
            id="workspace-next-step"
            value={nextStep}
            onChange={(event) => setNextStep(event.target.value)}
            placeholder="Qué toca hacer ahora"
            className="bg-background"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="workspace-detail">Vista detalle</Label>
          <Textarea
            id="workspace-detail"
            value={detail}
            onChange={(event) => setDetail(event.target.value)}
            placeholder="Contexto, avances, bloqueos o decisiones"
            className="min-h-[180px] bg-background"
          />
        </div>

        <Separator />

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            MVP navegable con expediente por tarea.
          </div>
          <Button onClick={handleSave} className="gap-2">
            <Save className="h-4 w-4" />
            Guardar expediente
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
