import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Radar } from "lucide-react";

interface PatternDetectorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTranslate: (params: {
    sector: string;
    geography?: string;
    time_horizon?: string;
    business_objective?: string;
  }) => Promise<void>;
}

export const PatternDetectorSetup = ({ open, onOpenChange, onTranslate }: PatternDetectorSetupProps) => {
  const [sector, setSector] = useState("");
  const [geography, setGeography] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);

  const handleTranslate = async () => {
    if (!sector.trim()) return;
    setLoading(true);
    await onTranslate({
      sector,
      geography: geography || undefined,
      time_horizon: timeHorizon || undefined,
      business_objective: objective || undefined,
    });
    setLoading(false);
    onOpenChange(false);
    setSector(""); setGeography(""); setTimeHorizon(""); setObjective("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            Nuevo Análisis de Patrones
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Sector *</Label>
            <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ej: Farmacias, Fintech, Retail..." />
          </div>
          <div>
            <Label>Geografía</Label>
            <Input value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="Ej: España, Europa, Global..." />
          </div>
          <div>
            <Label>Horizonte temporal</Label>
            <Input value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value)} placeholder="Ej: 6 meses, 1 año, 3 años..." />
          </div>
          <div>
            <Label>¿Qué quieres detectar o predecir?</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Describe en tus palabras lo que quieres anticipar. Ej: 'quiero predecir desabastecimiento de medicamentos en farmacias'" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleTranslate} disabled={!sector.trim() || loading}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Radar className="w-4 h-4 mr-2" />}
            {loading ? "Generando petición técnica..." : "Generar Petición Técnica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
