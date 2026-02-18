import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useDashboardLayout, CARD_LABELS, DashboardCardId } from "@/hooks/useDashboardLayout";
import { LayoutDashboard } from "lucide-react";

const ALL_CARDS: DashboardCardId[] = [
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

export const DashboardVisibilityCard = () => {
  const { layout, setCardVisibility } = useDashboardLayout();

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
      <CardContent className="space-y-2">
        {ALL_CARDS.map((id) => {
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
      </CardContent>
    </Card>
  );
};
