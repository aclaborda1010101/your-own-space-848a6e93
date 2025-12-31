import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CalendarEvent } from "@/hooks/useGoogleCalendar";
import { Trash2, Loader2, Briefcase, Heart, Wallet, Activity, Users } from "lucide-react";

const eventTypes = [
  { value: "work", label: "Trabajo", icon: Briefcase },
  { value: "life", label: "Vida", icon: Heart },
  { value: "finance", label: "Finanzas", icon: Wallet },
  { value: "health", label: "Salud", icon: Activity },
  { value: "family", label: "Familia", icon: Users },
];

interface EventDialogProps {
  event: CalendarEvent | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdate: (eventId: string, data: { title?: string; time?: string; duration?: number; description?: string; type?: string }) => Promise<any>;
  onDelete: (eventId: string) => Promise<boolean>;
}

export const EventDialog = ({ event, open, onOpenChange, onUpdate, onDelete }: EventDialogProps) => {
  const [title, setTitle] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState(30);
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState("work");
  const [saving, setSaving] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (event) {
      setTitle(event.title);
      setTime(event.time);
      setEventType(event.type || "work");
      // Parse duration from string like "30 min" or "1h 30min"
      const durationMatch = event.duration.match(/(\d+)\s*h?\s*(\d+)?/);
      if (durationMatch) {
        const hours = event.duration.includes('h') ? parseInt(durationMatch[1]) : 0;
        const mins = event.duration.includes('h') ? parseInt(durationMatch[2] || '0') : parseInt(durationMatch[1]);
        setDuration(hours * 60 + mins);
      } else {
        setDuration(30);
      }
      setDescription(event.description || "");
    }
  }, [event]);

  const handleSave = async () => {
    if (!event) return;
    
    setSaving(true);
    try {
      await onUpdate(event.id, {
        title,
        time,
        duration,
        description,
        type: eventType,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!event) return;
    
    setSaving(true);
    try {
      const success = await onDelete(event.id);
      if (success) {
        setShowDeleteConfirm(false);
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  if (!event) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="text-foreground">Editar evento</DialogTitle>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-foreground">Título</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-background border-border"
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
                <Label htmlFor="time" className="text-foreground">Hora</Label>
                <Input
                  id="time"
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="bg-background border-border"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="duration" className="text-foreground">Duración (min)</Label>
                <Input
                  id="duration"
                  type="number"
                  min={15}
                  max={480}
                  step={15}
                  value={duration}
                  onChange={(e) => setDuration(parseInt(e.target.value) || 30)}
                  className="bg-background border-border"
                />
              </div>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="description" className="text-foreground">Descripción</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="bg-background border-border resize-none"
                rows={3}
              />
            </div>
          </div>
          
          <DialogFooter className="flex justify-between sm:justify-between">
            <Button
              variant="destructive"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={saving}
              className="gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Eliminar
            </Button>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Guardar
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar evento?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará "{event.title}" de tu Google Calendar. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={saving}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};
