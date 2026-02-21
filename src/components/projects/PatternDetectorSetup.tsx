import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Radar } from "lucide-react";
import { AutoResearchCard } from "./AutoResearchCard";
import { useAutoResearch } from "@/hooks/useAutoResearch";

interface PatternDetectorSetupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId?: string;
  onTranslate: (params: {
    sector: string;
    geography?: string;
    time_horizon?: string;
    business_objective?: string;
  }) => Promise<void>;
}

export const PatternDetectorSetup = ({ open, onOpenChange, projectId, onTranslate }: PatternDetectorSetupProps) => {
  const [sector, setSector] = useState("");
  const [geography, setGeography] = useState("");
  const [timeHorizon, setTimeHorizon] = useState("");
  const [objective, setObjective] = useState("");
  const [loading, setLoading] = useState(false);
  const [researchConfirmed, setResearchConfirmed] = useState(false);

  const { researching, context, runResearch, clearContext } = useAutoResearch();

  // Pre-fill fields when research context arrives
  useEffect(() => {
    if (context && !researchConfirmed) {
      if (context.sector_detected) setSector(context.sector_detected);
      if (context.geography_detected) setGeography(context.geography_detected);
    }
  }, [context, researchConfirmed]);

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
    clearContext();
    setResearchConfirmed(false);
  };

  const handleResearch = async (url: string) => {
    if (!projectId) return null;
    return await runResearch(projectId, url);
  };

  const handleResearchConfirm = () => {
    setResearchConfirmed(true);
  };

  const handleResearchClear = () => {
    clearContext();
    setResearchConfirmed(false);
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
          {/* 1. URL de empresa (Auto-Research) */}
          {projectId && (
            <div>
              <Label>URL de la empresa (opcional)</Label>
              <AutoResearchCard
                researching={researching}
                context={context}
                onResearch={handleResearch}
                onConfirm={handleResearchConfirm}
                onClear={handleResearchClear}
              />
            </div>
          )}

          {/* 2. Sector */}
          <div>
            <Label>Sector *</Label>
            <Input value={sector} onChange={(e) => setSector(e.target.value)} placeholder="Ej: Farmacias, Fintech, Retail..." />
          </div>

          {/* 3. Geografía */}
          <div>
            <Label>Geografía</Label>
            <Input value={geography} onChange={(e) => setGeography(e.target.value)} placeholder="Ej: España, Europa, Global..." />
          </div>

          {/* 4. Horizonte temporal */}
          <div>
            <Label>Horizonte temporal</Label>
            <Input value={timeHorizon} onChange={(e) => setTimeHorizon(e.target.value)} placeholder="Ej: 6 meses, 1 año, 3 años..." />
          </div>

          {/* 5. Objetivo */}
          <div>
            <Label>¿Qué quieres detectar o predecir?</Label>
            <Textarea value={objective} onChange={(e) => setObjective(e.target.value)} placeholder="Describe en tus palabras lo que quieres anticipar. Ej: 'quiero predecir desabastecimiento de medicamentos en farmacias'" rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleTranslate} disabled={!sector.trim() || loading || researching}>
            {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Radar className="w-4 h-4 mr-2" />}
            {loading ? "Generando petición técnica..." : "Generar Petición Técnica"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
