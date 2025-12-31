import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, MessageCircle, History, Sparkles } from "lucide-react";
import { CoachSessionDialog } from "./CoachSessionDialog";
import { CheckInData } from "@/components/dashboard/CheckInCard";

interface CoachCardProps {
  checkInData?: CheckInData;
}

export const CoachCard = ({ checkInData }: CoachCardProps) => {
  const [dialogOpen, setDialogOpen] = useState(false);

  // Determine suggested protocol based on check-in
  const getSuggestedProtocol = () => {
    if (!checkInData) return null;
    
    if (checkInData.energy <= 2 && checkInData.mood <= 2) {
      return { protocol: "crisis", label: "Sesión de apoyo recomendada" };
    }
    if (checkInData.energy <= 2) {
      return { protocol: "tired", label: "Día de baja energía" };
    }
    if (checkInData.energy >= 4 && checkInData.mood >= 4) {
      return { protocol: "push", label: "Buen momento para avanzar" };
    }
    return { protocol: "balanced", label: "Sesión regular disponible" };
  };

  const suggestion = getSuggestedProtocol();

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center relative">
              <Brain className="w-4 h-4 text-primary" />
              <div className="absolute -top-1 -right-1 w-2 h-2 bg-success rounded-full" />
            </div>
            JARVIS Coach
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Coaching personalizado con protocolos adaptativos según tu estado emocional.
          </p>

          {suggestion && (
            <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-sm text-foreground">{suggestion.label}</span>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className="text-xs">Ansiedad</Badge>
            <Badge variant="outline" className="text-xs">Bloqueo</Badge>
            <Badge variant="outline" className="text-xs">Empuje</Badge>
            <Badge variant="outline" className="text-xs">Cansancio</Badge>
          </div>

          <Button onClick={() => setDialogOpen(true)} className="w-full">
            <MessageCircle className="w-4 h-4 mr-2" />
            Iniciar sesión de coaching
          </Button>
        </CardContent>
      </Card>

      <CoachSessionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        checkInData={checkInData}
      />
    </>
  );
};
