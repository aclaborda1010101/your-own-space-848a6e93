import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Zap, Layers, Rocket, Clock, type LucideIcon } from "lucide-react";

interface RagCreatorProps {
  onStart: (domain: string, moralMode: string, tier?: string) => Promise<void>;
  creating: boolean;
}

const RAG_TIERS: Array<{ id: string; name: string; desc: string; time: string; cost: string; chunks: string; icon: LucideIcon; border: string; bg: string; activeBg: string }> = [
  {
    id: "basic",
    name: "Básico",
    desc: "Documentos del proyecto + fuentes core. Ideal para apps CRUD con componente de consulta.",
    time: "2-5 min · 30-80 chunks",
    cost: "$0.50-1.50",
    chunks: "30-80",
    icon: Zap,
    border: "border-blue-500/50",
    bg: "bg-blue-500/10",
    activeBg: "bg-blue-500/20",
  },
  {
    id: "normal",
    name: "Normal",
    desc: "Investigación selectiva con fuentes externas de calidad. Knowledge graph incluido.",
    time: "10-20 min · 100-300 chunks",
    cost: "$3-6",
    chunks: "100-300",
    icon: Layers,
    border: "border-orange-500/50",
    bg: "bg-orange-500/10",
    activeBg: "bg-orange-500/20",
  },
  {
    id: "pro",
    name: "Pro",
    desc: "Exhaustividad máxima. Todas las fuentes, taxonomía, contradicciones, 7 niveles de investigación.",
    time: "30-60 min · 300-800 chunks",
    cost: "$12-20",
    chunks: "300-800",
    icon: Rocket,
    border: "border-purple-500/50",
    bg: "bg-purple-500/10",
    activeBg: "bg-purple-500/20",
  },
];

export function RagCreator({ onStart, creating }: RagCreatorProps) {
  const [domain, setDomain] = useState("");
  const [selectedTier, setSelectedTier] = useState("normal");

  const handleStart = async () => {
    if (!domain.trim()) return;
    // Map tier to moral_mode for backward compat with DB constraint
    const moralModeMap: Record<string, string> = { basic: "estandar", normal: "profundo", pro: "total" };
    await onStart(domain, moralModeMap[selectedTier] || "total", selectedTier);
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
          {RAG_TIERS.map((tier) => (
            <Card
              key={tier.id}
              className={`cursor-pointer transition-all ${
                selectedTier === tier.id
                  ? `${tier.border} ${tier.activeBg} ring-1 ring-offset-0`
                  : `border-border hover:${tier.border} ${tier.bg}`
              }`}
              onClick={() => !creating && setSelectedTier(tier.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <tier.icon className="h-4 w-4 shrink-0" />
                  <span className="text-lg font-bold">{tier.name}</span>
                  {selectedTier === tier.id && (
                    <Badge variant="secondary" className="text-xs">Seleccionado</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{tier.desc}</p>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Clock className="h-3 w-3" /> {tier.time}</p>
                  <p className="text-xs font-semibold text-foreground">{tier.cost}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {selectedTier === "pro" && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-4">
          <h3 className="font-bold text-purple-400 text-sm flex items-center gap-2"><Rocket className="h-4 w-4" /> MODO PRO ACTIVADO</h3>
          <p className="text-xs text-purple-300/80 mt-1">
            Investigación exhaustiva en 7 niveles con todas las fuentes legales disponibles.
            Incluye knowledge graph, taxonomía, y detección de contradicciones.
          </p>
        </div>
      )}

      <Button
        onClick={handleStart}
        disabled={!domain.trim() || creating}
        className={`w-full py-3 font-bold ${
          selectedTier === "pro"
            ? "bg-purple-600 hover:bg-purple-700"
            : selectedTier === "normal"
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
