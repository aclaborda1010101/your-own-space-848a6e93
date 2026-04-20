import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ContactSelect } from "@/components/tasks/ContactSelect";
import { cn } from "@/lib/utils";
import { Briefcase, Heart, Wallet, Users, Save } from "lucide-react";

interface Task {
  id: string;
  title: string;
  type: "work" | "life" | "finance";
  priority: "P0" | "P1" | "P2";
  duration: number;
  completed: boolean;
  isPersonal: boolean;
  contactId?: string;
  contactName?: string;
}

interface EditTaskDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (
    id: string,
    updates: Partial<Pick<Task, "title" | "type" | "priority" | "duration" | "isPersonal" | "contactId">>,
  ) => Promise<void>;
}

const typeConfig = {
  work: { icon: Briefcase, label: "Trabajo", color: "bg-primary/10 text-primary border-primary/20" },
  life: { icon: Heart, label: "Vida", color: "bg-success/10 text-success border-success/20" },
  finance: { icon: Wallet, label: "Finanzas", color: "bg-warning/10 text-warning border-warning/20" },
};

const priorities = ["P0", "P1", "P2"] as const;
const priorityColors = {
  P0: "bg-destructive/20 text-destructive border-destructive/30",
  P1: "bg-warning/20 text-warning border-warning/30",
  P2: "bg-muted text-muted-foreground border-border",
};

export const EditTaskDialog = ({ task, open, onOpenChange, onSave }: EditTaskDialogProps) => {
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"work" | "life" | "finance">("work");
  const [priority, setPriority] = useState<"P0" | "P1" | "P2">("P1");
  const [duration, setDuration] = useState(30);
  const [isPersonal, setIsPersonal] = useState(true);
  const [contactId, setContactId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setType(task.type);
      setPriority(task.priority);
      setDuration(task.duration);
      setIsPersonal(task.isPersonal);
      setContactId(task.contactId ?? null);
    }
  }, [task]);

  const handleSave = async () => {
    if (!task || !title.trim()) return;
    setSaving(true);
    await onSave(task.id, {
      title: title.trim(),
      type,
      priority,
      duration,
      isPersonal,
      contactId: contactId ?? undefined,
    });
    setSaving(false);
    onOpenChange(false);
  };

  const shared = !isPersonal;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-mono">EDITAR TAREA</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="task-title">Título</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background border-border"
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              {(["work", "life", "finance"] as const).map((t) => {
                const config = typeConfig[t];
                const Icon = config.icon;
                return (
                  <Button
                    key={t}
                    variant="outline"
                    size="sm"
                    onClick={() => setType(t)}
                    className={cn(
                      "flex-1 gap-2",
                      type === t ? config.color : "border-border text-muted-foreground"
                    )}
                  >
                    <Icon className="w-4 h-4" />
                    {config.label}
                  </Button>
                );
              })}
            </div>
          </div>

          {/* Priority */}
          <div className="space-y-2">
            <Label>Prioridad</Label>
            <div className="flex gap-2">
              {priorities.map((p) => (
                <Button
                  key={p}
                  variant="outline"
                  size="sm"
                  onClick={() => setPriority(p)}
                  className={cn(
                    "flex-1",
                    priority === p ? priorityColors[p] : "border-border text-muted-foreground"
                  )}
                >
                  {p}
                </Button>
              ))}
            </div>
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="task-duration">Duración (minutos)</Label>
            <Input
              id="task-duration"
              type="number"
              min={5}
              max={480}
              step={5}
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              className="bg-background border-border"
            />
          </div>

          {/* Contact link */}
          <div className="space-y-2">
            <Label>Contacto vinculado</Label>
            <ContactSelect
              value={contactId}
              onChange={(id) => setContactId(id)}
              className="w-full"
            />
          </div>

          {/* Shared toggle (privada por defecto) */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users className={cn("w-4 h-4", shared ? "text-primary" : "text-muted-foreground")} />
              <Label>Compartida con red</Label>
            </div>
            <Switch
              checked={shared}
              onCheckedChange={(v) => setIsPersonal(!v)}
              className="data-[state=checked]:bg-primary"
            />
          </div>
          <p className="text-[11px] text-muted-foreground -mt-2">
            Por defecto las tareas son privadas. Actívalo solo si quieres que las personas con acceso compartido la vean.
          </p>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="border-border">
            Cancelar
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !title.trim()}
            className="bg-primary text-primary-foreground gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Guardando..." : "Guardar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
