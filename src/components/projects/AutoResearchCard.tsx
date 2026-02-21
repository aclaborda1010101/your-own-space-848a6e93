import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, Globe, CheckCircle2, Building2, MapPin, Package, TrendingUp, Users, AlertTriangle } from "lucide-react";
import type { ProjectContext } from "@/hooks/useAutoResearch";

interface AutoResearchCardProps {
  researching: boolean;
  context: ProjectContext | null;
  onResearch: (url: string) => Promise<ProjectContext | null>;
  onConfirm: () => void;
  onClear: () => void;
}

export const AutoResearchCard = ({ researching, context, onResearch, onConfirm, onClear }: AutoResearchCardProps) => {
  const [url, setUrl] = useState("");

  if (researching) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 flex items-center gap-3">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <div>
            <p className="text-sm font-medium text-foreground">Investigando empresa...</p>
            <p className="text-xs text-muted-foreground">Analizando web y buscando información externa</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (context) {
    return (
      <Card className="border-green-500/20 bg-green-500/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400" />
            Research completado
            {context.confidence_score && (
              <Badge variant="outline" className="text-xs ml-auto">
                {Math.round((context.confidence_score as number) * 100)}% confianza
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {context.company_name && (
            <div className="flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">{context.company_name}</span>
            </div>
          )}
          {context.company_description && (
            <p className="text-xs text-muted-foreground">{context.company_description}</p>
          )}
          <div className="flex flex-wrap gap-2">
            {context.sector_detected && (
              <Badge variant="outline" className="text-xs gap-1">
                <Package className="w-3 h-3" /> {context.sector_detected}
              </Badge>
            )}
            {context.geography_detected && (
              <Badge variant="outline" className="text-xs gap-1">
                <MapPin className="w-3 h-3" /> {context.geography_detected}
              </Badge>
            )}
          </div>
          {context.products_services?.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {context.products_services.slice(0, 5).map((p, i) => (
                <Badge key={i} variant="secondary" className="text-xs">{p}</Badge>
              ))}
            </div>
          )}
          {context.competitors?.length > 0 && (
            <div className="flex items-center gap-2">
              <Users className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                Competidores: {context.competitors.map(c => c.name).join(", ")}
              </span>
            </div>
          )}
          {context.sector_trends?.length > 0 && (
            <div className="flex items-center gap-2">
              <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">
                {context.sector_trends.slice(0, 2).join(" • ")}
              </span>
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <Button size="sm" onClick={onConfirm} className="gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" /> Confirmar
            </Button>
            <Button size="sm" variant="outline" onClick={onClear}>
              Corregir manualmente
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.empresa.com"
          className="flex-1"
        />
        <Button
          size="sm"
          variant="outline"
          disabled={!url.trim()}
          onClick={() => onResearch(url)}
          className="gap-1 shrink-0"
        >
          <Globe className="w-3.5 h-3.5" /> Investigar
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Opcional: analizaremos la web y buscaremos info para pre-rellenar campos
      </p>
    </div>
  );
};
