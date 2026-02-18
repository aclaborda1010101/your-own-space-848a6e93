import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useDashboardLayout, CARD_LABELS, DashboardCardId } from "@/hooks/useDashboardLayout";
import { useUserSettings } from "@/hooks/useUserSettings";
import { LayoutDashboard } from "lucide-react";

const GRID_CARDS: DashboardCardId[] = [
  "morning-briefing",
  "check-in",
  "daily-plan",
  "publications",
  "agenda",
  "challenge",
  "coach",
  "priorities",
  "alerts",
  "habits-insights",
];

const FIXED_CARDS: { key: "show_day_summary" | "show_quick_actions" | "show_notifications_panel" | "show_contacts_card"; label: string }[] = [
  { key: "show_day_summary", label: "Resumen del día" },
  { key: "show_quick_actions", label: "Acciones rápidas" },
  { key: "show_notifications_panel", label: "Alertas inteligentes" },
  { key: "show_contacts_card", label: "Red de Contactos" },
];

export const DashboardVisibilityCard = () => {
  const { layout, setCardVisibility } = useDashboardLayout();
  const { settings, updateSettings } = useUserSettings();

  const handleFixedToggle = (key: typeof FIXED_CARDS[number]["key"], checked: boolean) => {
    updateSettings({ [key]: checked });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutDashboard className="h-5 w-5 text-primary" />
          Tarjetas del Dashboard
        </CardTitle>
        <CardDescription>
          Elige qué tarjetas se muestran en tu Dashboard
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fixed cards */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">TARJETAS FIJAS</p>
          <div className="space-y-2">
            {FIXED_CARDS.map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <Label className="cursor-pointer text-sm font-normal">{label}</Label>
                <Switch
                  checked={settings[key] !== false}
                  onCheckedChange={(checked) => handleFixedToggle(key, checked)}
                />
              </div>
            ))}
          </div>
        </div>

        <Separator />

        {/* Grid cards */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground font-mono mb-2">TARJETAS DEL GRID</p>
          <div className="space-y-2">
            {GRID_CARDS.map((id) => {
              const isVisible = layout.cardSettings[id]?.visible !== false;
              return (
                <div key={id} className="flex items-center justify-between py-1.5">
                  <Label className="cursor-pointer text-sm font-normal">
                    {CARD_LABELS[id] || id}
                  </Label>
                  <Switch
                    checked={isVisible}
                    onCheckedChange={(checked) => setCardVisibility(id, checked)}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
