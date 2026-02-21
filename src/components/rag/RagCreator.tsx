import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Eye, Layers, Globe, Rocket, Clock, type LucideIcon } from "lucide-react";

interface RagCreatorProps {
  onStart: (domain: string, moralMode: string) => Promise<void>;
  creating: boolean;
}

const MORAL_MODES: Array<{ id: string; name: string; desc: string; time: string; icon: LucideIcon; border: string; bg: string; activeBg: string }> = [
  {
    id: "estandar",
    name: "Estándar",
    desc: "Fuentes públicas y legales, budget controlado",
    time: "2-3 horas · hasta 500 fuentes",
    icon: Eye,
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    activeBg: "bg-blue-500/20",
  },
  {
    id: "profundo",
    name: "Profundo",
    desc: "Preprints, patentes, tesis, datos gov, scraping ético, 3+ idiomas",
    time: "3-5 horas · hasta 2000 fuentes",
    icon: Layers,
    border: "border-orange-500/50",
    bg: "bg-orange-500/10",
    activeBg: "bg-orange-500/20",
  },
  {
    id: "total",
    name: "TOTAL",
    desc: "Exhaustividad absoluta. Todas las fuentes legales del planeta, sin techo, 5+ idiomas",
    time: "4-8 horas · 5000+ fuentes",
    icon: Globe,
    border: "border-purple-500/50",
    bg: "bg-purple-500/10",
    activeBg: "bg-purple-500/20",
  },
];

export function RagCreator({ onStart, creating }: RagCreatorProps) {
  const [domain, setDomain] = useState("");
  const [moralMode, setMoralMode] = useState("total");

  const handleStart = async () => {
    if (!domain.trim()) return;
    await onStart(domain, moralMode);
  };

  return (
    <div className="space-y-6">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">
          ¿Sobre qué dominio quieres construir el RAG?
        </label>
        <Textarea
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="Ej: Oncología pediátrica con enfoque en inmunoterapia CAR-T para leucemia linfoblástica aguda..."
          className="min-h-[100px] bg-background border-border"
          disabled={creating}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-3 block">
          Nivel de profundidad
        </label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {MORAL_MODES.map((mode) => (
            <Card
              key={mode.id}
              className={`cursor-pointer transition-all ${
                moralMode === mode.id
                  ? `${mode.border} ${mode.activeBg} ring-1 ring-offset-0`
                  : `border-border hover:${mode.border} ${mode.bg}`
              }`}
              onClick={() => !creating && setMoralMode(mode.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <mode.icon className="h-4 w-4 shrink-0" />
                  <span className="text-lg font-bold">{mode.name}</span>
                  {moralMode === mode.id && (
                    <Badge variant="secondary" className="text-xs">Seleccionado</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{mode.desc}</p>
                <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1"><Clock className="h-3 w-3" /> {mode.time}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {moralMode === "total" && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h3 className="font-bold text-purple-400 text-sm flex items-center gap-2"><Globe className="h-4 w-4" /> MODO TOTAL ACTIVADO</h3>
          <p className="text-xs text-purple-300/80 mt-1">
            Este modo busca con exhaustividad absoluta en todas las fuentes legales del planeta.
            Primero haremos un análisis doctoral (2-3 min), luego confirmas los subdominios
            detectados, y finalmente construimos el RAG con cobertura total.
          </p>
        </div>
      )}

      <Button
        onClick={handleStart}
        disabled={!domain.trim() || creating}
        className={`w-full py-3 font-bold ${
          moralMode === "total"
            ? "bg-purple-600 hover:bg-purple-700"
            : moralMode === "profundo"
              ? "bg-orange-600 hover:bg-orange-700"
              : "bg-blue-600 hover:bg-blue-700"
        }`}
        size="lg"
      >
        {creating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Iniciando análisis doctoral...
          </>
        ) : (
          <>
            <Rocket className="h-4 w-4 mr-2" />
            INICIAR ANÁLISIS DE DOMINIO
          </>
        )}
      </Button>
    </div>
  );
}
