import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings2, Eye, EyeOff } from "lucide-react";
import { 
  DashboardCardId, 
  CardWidth, 
  CARD_LABELS,
  CardSettings,
} from "@/hooks/useDashboardLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface DashboardSettingsDialogProps {
  cardSettings: Record<DashboardCardId, CardSettings>;
  onVisibilityChange: (cardId: DashboardCardId, visible: boolean) => void;
  onWidthChange: (cardId: DashboardCardId, width: CardWidth) => void;
  onReset: () => void;
}

const WIDTH_OPTIONS: { value: CardWidth; label: string }[] = [
  { value: "1/3", label: "1/3" },
  { value: "1/2", label: "1/2" },
  { value: "2/3", label: "2/3" },
  { value: "full", label: "Completo" },
];

const ALL_CARDS: DashboardCardId[] = [
  "check-in",
  "daily-plan",
  "publications",
  "agenda",
  "challenge",
  "coach",
  "priorities",
  "alerts",
];

export const DashboardSettingsDialog = ({
  cardSettings,
  onVisibilityChange,
  onWidthChange,
  onReset,
}: DashboardSettingsDialogProps) => {
  const [open, setOpen] = useState(false);

  const hiddenCount = ALL_CARDS.filter(
    (id) => cardSettings[id]?.visible === false
  ).length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Settings2 className="w-4 h-4" />
          {hiddenCount > 0 && (
            <Badge 
              variant="secondary" 
              className="absolute -top-1 -right-1 h-4 w-4 p-0 text-[10px] flex items-center justify-center"
            >
              {hiddenCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings2 className="w-5 h-5" />
            Configurar Dashboard
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">
            Elige qué tarjetas mostrar y su ancho en el dashboard.
          </p>

          <div className="space-y-3">
            {ALL_CARDS.map((cardId) => {
              const settings = cardSettings[cardId];
              const isVisible = settings?.visible !== false;

              return (
                <div
                  key={cardId}
                  className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/30"
                >
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isVisible}
                      onCheckedChange={(checked) =>
                        onVisibilityChange(cardId, checked)
                      }
                    />
                    <div className="flex items-center gap-2">
                      {isVisible ? (
                        <Eye className="w-4 h-4 text-success" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-muted-foreground" />
                      )}
                      <Label className={!isVisible ? "text-muted-foreground" : ""}>
                        {CARD_LABELS[cardId]}
                      </Label>
                    </div>
                  </div>

                  <Select
                    value={settings?.width || "full"}
                    onValueChange={(value) =>
                      onWidthChange(cardId, value as CardWidth)
                    }
                    disabled={!isVisible}
                  >
                    <SelectTrigger className="w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {WIDTH_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>

          <div className="flex justify-end pt-2">
            <Button variant="outline" size="sm" onClick={onReset}>
              Restablecer todo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
