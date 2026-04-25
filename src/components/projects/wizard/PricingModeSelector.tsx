import { Card, CardContent } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { DollarSign } from "lucide-react";

export type PricingMode = "none" | "custom" | "full";

interface Props {
  value: PricingMode;
  onChange: (mode: PricingMode) => void;
  disabled?: boolean;
  /** Compact mode reduces padding for placement above an existing step block. */
  compact?: boolean;
}

/**
 * Selector de "Cifras de inversión" usado en el paso de PRD/Alcance.
 * Antes vivía dentro de ProjectWizardStep3, pero el wizard actual usa el
 * componente genérico, así que se extrae aquí para que esté SIEMPRE visible.
 */
export const PricingModeSelector = ({ value, onChange, disabled = false, compact = false }: Props) => {
  return (
    <Card className="border-border/30 bg-muted/20">
      <CardContent className={compact ? "p-3 space-y-2" : "p-4 space-y-3"}>
        <div className="flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Cifras de inversión</span>
        </div>
        <RadioGroup
          value={value}
          onValueChange={(v) => onChange(v as PricingMode)}
          className="space-y-2"
          disabled={disabled}
        >
          <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
            <RadioGroupItem value="none" id="pricing-none" className="mt-0.5" />
            <Label htmlFor="pricing-none" className="cursor-pointer">
              <span className="text-sm font-medium">Sin cifras</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Inversión "a definir". Sin ROI. Los costes de APIs sí aparecen.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
            <RadioGroupItem value="custom" id="pricing-custom" className="mt-0.5" />
            <Label htmlFor="pricing-custom" className="cursor-pointer">
              <span className="text-sm font-medium">Rangos personalizados</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Rangos de inversión por fase. Sin ROI automático.
              </span>
            </Label>
          </div>
          <div className="flex items-start gap-3 p-2 rounded-lg hover:bg-muted/30">
            <RadioGroupItem value="full" id="pricing-full" className="mt-0.5" />
            <Label htmlFor="pricing-full" className="cursor-pointer">
              <span className="text-sm font-medium">Detalle completo</span>
              <span className="text-xs text-muted-foreground block mt-0.5">
                Estimación automática + ROI. Solo uso interno.
              </span>
            </Label>
          </div>
        </RadioGroup>
      </CardContent>
    </Card>
  );
};
