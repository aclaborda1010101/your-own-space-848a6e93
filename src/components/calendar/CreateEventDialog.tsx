import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Briefcase, Heart, Users, Wallet, Activity } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { title: string; time: string; duration: number; description?: string; type?: string }) => Promise<any>;
  selectedDate: Date | null;
  selectedHour: number | null;
}

const eventTypes = [
  { value: "work", label: "Trabajo", icon: Briefcase },
  { value: "life", label: "Vida", icon: Heart },
  { value: "finance", label: "Finanzas", icon: Wallet },
  { value: "health", label: "Salud", icon: Activity },
  { value: "family", label: "Familia", icon: Users },
];

export const CreateEventDialog = ({ 
  open, 
  onOpenChange, 
  onCreate, 
  selectedDate, 
  selectedHour 
}: CreateEventDialogProps) => {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("work");
  const [saving, setSaving] = useState(false);

  // Update time when dialog opens with new slot
  useState(() => {
    if (selectedHour !== null) {
      setTime(`${selectedHour.toString().padStart(2, '0')}:00`);
    }
  });

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen && selectedHour !== null) {
      setTime(`${selectedHour.toString().padStart(2, '0')}:00`);
      setTitle("");
      setDescription("");
      setDuration(30);
      setEventType("work");
    }
    onOpenChange(isOpen);
  };

  const handleCreate = async () => {
    if (!title.trim()) return;
    
    setSaving(true);
    try {
      await onCreate({
        title,
        time,
        duration,
        description: description || undefined,
        type: eventType,
      });
      setTitle("");
      setDescription("");
      setDuration(30);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const dateLabel = selectedDate 
    ? format(selectedDate, "EEEE d 'de' MMMM", { locale: es })
    : "";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear evento</DialogTitle>
          {dateLabel && (
            <p className="text-sm text-muted-foreground capitalize">{dateLabel}</p>
          )}
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="new-title" className="text-foreground">Título</Label>
            <Input
              id="new-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Nombre del evento..."
              className="bg-background border-border"
              autoFocus
            />
          </div>

          <div className="grid gap-2">
            <Label className="text-foreground">Tipo</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger className="bg-background border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    <div className="flex items-center gap-2">
                      <type.icon className="w-4 h-4" />
                      {type.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="new-time" className="text-foreground">Hora</Label>
              <Input
                id="new-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="bg-background border-border"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="new-duration" className="text-foreground">Duración</Label>
              <Select value={duration.toString()} onValueChange={(v) => setDuration(parseInt(v))}>
                <SelectTrigger className="bg-background border-border">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="15">15 min</SelectItem>
                  <SelectItem value="30">30 min</SelectItem>
                  <SelectItem value="45">45 min</SelectItem>
                  <SelectItem value="60">1 hora</SelectItem>
                  <SelectItem value="90">1.5 horas</SelectItem>
                  <SelectItem value="120">2 horas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          
          <div className="grid gap-2">
            <Label htmlFor="new-description" className="text-foreground">Descripción (opcional)</Label>
            <Textarea
              id="new-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Añade detalles..."
              className="bg-background border-border resize-none"
              rows={2}
            />
          </div>
        </div>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleCreate} disabled={saving || !title.trim()}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
            Crear evento
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
