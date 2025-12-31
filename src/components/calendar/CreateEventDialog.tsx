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
import { Textarea } from "@/components/ui/textarea";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Briefcase, Heart, Users, Wallet, Activity, CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface CreateEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (data: { title: string; time: string; duration: number; description?: string; type?: string; date?: string }) => Promise<any>;
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
  const [date, setDate] = useState<Date | undefined>(selectedDate || new Date());
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("work");
  const [saving, setSaving] = useState(false);

  // Update date and time when dialog opens with new slot
  useEffect(() => {
    if (open) {
      if (selectedDate) {
        setDate(selectedDate);
      }
      if (selectedHour !== null) {
        setTime(`${selectedHour.toString().padStart(2, '0')}:00`);
      }
    }
  }, [open, selectedDate, selectedHour]);

  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      if (selectedDate) {
        setDate(selectedDate);
      } else {
        setDate(new Date());
      }
      if (selectedHour !== null) {
        setTime(`${selectedHour.toString().padStart(2, '0')}:00`);
      } else {
        setTime("");
      }
      setTitle("");
      setDescription("");
      setDuration(30);
      setEventType("work");
    }
    onOpenChange(isOpen);
  };

  const handleCreate = async () => {
    if (!title.trim() || !date) return;
    
    setSaving(true);
    try {
      await onCreate({
        title,
        time,
        duration,
        description: description || undefined,
        type: eventType,
        date: format(date, "yyyy-MM-dd"),
      });
      setTitle("");
      setDescription("");
      setDuration(30);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="text-foreground">Crear evento</DialogTitle>
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
            <Label className="text-foreground">Fecha</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !date && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, "EEEE d 'de' MMMM yyyy", { locale: es }) : <span>Seleccionar fecha</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  initialFocus
                  locale={es}
                  className={cn("p-3 pointer-events-auto")}
                />
              </PopoverContent>
            </Popover>
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
