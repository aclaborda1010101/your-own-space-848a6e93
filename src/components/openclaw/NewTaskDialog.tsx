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
import { Plus } from "lucide-react";
import type { OCNode, TaskPriority } from "@/hooks/useOpenClawHub";

interface Props {
  nodes: OCNode[];
  onCreate: (v: {
    node_id: string;
    title: string;
    description?: string;
    priority?: TaskPriority;
  }) => Promise<any>;
  triggerLabel?: string;
}

export function NewTaskDialog({ nodes, onCreate, triggerLabel = "Nueva tarea" }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [nodeId, setNodeId] = useState<string>(nodes[0]?.id ?? "");
  const [priority, setPriority] = useState<TaskPriority>("normal");
  const [busy, setBusy] = useState(false);

  const reset = () => {
    setTitle("");
    setDesc("");
    setPriority("normal");
  };

  const submit = async () => {
    if (!title.trim() || !nodeId) return;
    setBusy(true);
    const r = await onCreate({ node_id: nodeId, title: title.trim(), description: desc.trim() || undefined, priority });
    setBusy(false);
    if (r) {
      reset();
      setOpen(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4 mr-1" /> {triggerLabel}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva tarea OpenClaw</DialogTitle>
          <DialogDescription>Se persiste en Supabase y aparece en la cola del nodo.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Título</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej. Sintetizar últimos emails" />
          </div>
          <div className="space-y-1.5">
            <Label>Descripción</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Contexto opcional" />
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
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
          <Button onClick={submit} disabled={busy || !title.trim() || !nodeId}>Crear</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
