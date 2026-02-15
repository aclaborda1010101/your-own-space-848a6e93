import { useState } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarDays, Clock } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

interface AcceptEventDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onConfirm: (date: string, time: string) => void;
  loading?: boolean;
}

export function AcceptEventDialog({ open, onOpenChange, title, onConfirm, loading }: AcceptEventDialogProps) {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState("10:00");

  const handleConfirm = () => {
    if (!date) return;
    const dateStr = format(date, "yyyy-MM-dd");
    onConfirm(dateStr, time);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarDays className="w-5 h-5 text-primary" />
            Agendar evento
          </DialogTitle>
          <DialogDescription>Selecciona fecha y hora para: <strong>{title}</strong></DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex justify-center">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={es}
              className={cn("p-3 pointer-events-auto")}
            />
          </div>

          <div className="space-y-2">
            <Label className="flex items-center gap-1.5">
              <Clock className="w-4 h-4" /> Hora
            </Label>
            <Input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button onClick={handleConfirm} disabled={!date || loading}>
            {loading ? "Creando..." : "Crear evento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
