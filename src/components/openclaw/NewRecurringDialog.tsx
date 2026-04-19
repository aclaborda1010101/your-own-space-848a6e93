import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Repeat } from "lucide-react";
import type { OCNode, TaskPriority } from "@/hooks/useOpenClawHub";

interface Props {
  nodes: OCNode[];
  onCreate: (v: {
    node_id: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
    schedule_label: string;
    schedule_cron?: string;
  }) => Promise<any>;
}

const SCHEDULES: Array<{ label: string; cron: string }> = [
  { label: "Cada hora", cron: "0 * * * *" },
  { label: "Cada 6h", cron: "0 */6 * * *" },
  { label: "Diario 08:00", cron: "0 8 * * *" },
  { label: "Diario 20:00", cron: "0 20 * * *" },
  { label: "Lun–Vie 09:00", cron: "0 9 * * 1-5" },
  { label: "Semanal lunes 07:00", cron: "0 7 * * 1" },
];

export function NewRecurringDialog({ nodes, onCreate }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [nodeId, setNodeId] = useState<string>(nodes[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [schedIdx, setSchedIdx] = useState("2"); // Diario 08:00
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!title.trim() || !nodeId) return;
    const sched = SCHEDULES[parseInt(schedIdx)];
    setBusy(true);
    const ok = await onCreate({
      node_id: nodeId,
      title: title.trim(),
      description: desc.trim() || undefined,
      priority,
      schedule_label: sched.label,
      schedule_cron: sched.cron,
    });
    setBusy(false);
    if (ok) {
      setTitle("");
      setDesc("");
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Repeat className="h-4 w-4 mr-1" /> Nueva recurrente
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tarea recurrente</DialogTitle>
          <DialogDescription>
            Programación persistida. La ejecución física se conectará al bridge POTUS cuando esté disponible.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Resumen ejecutivo diario" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Qué debe hacer" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Nodo</Label>
              <Select value={nodeId} onValueChange={setNodeId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {nodes.map((n) => (
                    <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as TaskPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Baja</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="high">Alta</SelectItem>
                  <SelectItem value="critical">Crítica</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Programación</Label>
            <Select value={schedIdx} onValueChange={setSchedIdx}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {SCHEDULES.map((s, i) => (
                  <SelectItem key={s.cron} value={String(i)}>
                    {s.label} <span className="text-muted-foreground ml-2 font-mono text-[10px]">{s.cron}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !nodeId}>Programar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
