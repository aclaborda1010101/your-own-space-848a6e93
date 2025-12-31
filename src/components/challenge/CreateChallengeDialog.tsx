import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, X, Target, CheckCircle, Compass, Ban, ShieldCheck, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

type GoalType = "objetivo" | "proposito" | "prohibicion" | "excepcion";
type Frequency = "daily" | "global";

interface GoalInput {
  title: string;
  description?: string;
  goalType: GoalType;
  frequency: Frequency;
  targetCount?: number;
}

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChallenge: (
    name: string,
    durationDays: number,
    goals: { title: string; description?: string; frequency?: string; targetCount?: number; goalType?: string }[],
    options?: {
      description?: string;
      motivation?: string;
      reward?: string;
    }
  ) => Promise<unknown>;
}

const DURATION_OPTIONS = [
  { days: 30, label: "30 días", description: "Ideal para empezar" },
  { days: 90, label: "90 días", description: "Cambio de hábito" },
  { days: 180, label: "180 días", description: "Transformación" },
  { days: 365, label: "365 días", description: "Compromiso total" },
];

const GOAL_TYPE_OPTIONS: { value: GoalType; label: string; icon: typeof Target; color: string; description: string }[] = [
  { value: "objetivo", label: "Objetivo", icon: CheckCircle, color: "bg-success/20 text-success border-success/30", description: "Lo que quieres lograr" },
  { value: "proposito", label: "Propósito", icon: Compass, color: "bg-primary/20 text-primary border-primary/30", description: "Tu intención/motivación" },
  { value: "prohibicion", label: "Prohibición", icon: Ban, color: "bg-destructive/20 text-destructive border-destructive/30", description: "Lo que evitarás" },
  { value: "excepcion", label: "Excepción", icon: ShieldCheck, color: "bg-warning/20 text-warning border-warning/30", description: "Excepciones permitidas" },
];

export const CreateChallengeDialog = ({
  open,
  onOpenChange,
  onCreateChallenge,
}: CreateChallengeDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [motivation, setMotivation] = useState("");
  const [reward, setReward] = useState("");
  const [goals, setGoals] = useState<GoalInput[]>([
    { title: "", goalType: "objetivo", frequency: "daily" },
  ]);
  const [loading, setLoading] = useState(false);
  const [showValidation, setShowValidation] = useState(false);

  const hasValidName = name.trim().length > 0;
  const validGoals = goals.filter(g => g.title.trim());
  const hasAtLeastOneGoal = validGoals.length > 0;
  const hasAtLeastOneObjetivo = validGoals.some(g => g.goalType === "objetivo");

  const handleAddGoal = (goalType: GoalType = "objetivo") => {
    setGoals([...goals, { title: "", goalType, frequency: goalType === "objetivo" ? "daily" : "global" }]);
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, field: keyof GoalInput, value: string | number) => {
    const newGoals = [...goals];
    if (field === "frequency") {
      newGoals[index] = { ...newGoals[index], frequency: value as Frequency };
    } else if (field === "goalType") {
      newGoals[index] = { ...newGoals[index], goalType: value as GoalType };
    } else if (field === "targetCount") {
      newGoals[index] = { ...newGoals[index], targetCount: Number(value) || undefined };
    } else {
      newGoals[index] = { ...newGoals[index], [field]: value };
    }
    setGoals(newGoals);
  };

  const handleSubmit = async () => {
    setShowValidation(true);
    
    if (!hasValidName || !hasAtLeastOneGoal || !hasAtLeastOneObjetivo) return;
    
    const goalsToSubmit = validGoals.map(g => ({
      title: g.title,
      description: g.description,
      frequency: g.frequency,
      goalType: g.goalType,
      targetCount: g.frequency === "global" ? (g.targetCount || 1) : undefined,
    }));

    setLoading(true);
    try {
      await onCreateChallenge(name, duration, goalsToSubmit, {
        description: description || undefined,
        motivation: motivation || undefined,
        reward: reward || undefined,
      });
      
      // Reset form
      setName("");
      setDescription("");
      setDuration(30);
      setMotivation("");
      setReward("");
      setGoals([{ title: "", goalType: "objetivo", frequency: "daily" }]);
      setShowValidation(false);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  const getGoalTypeConfig = (goalType: GoalType) => {
    return GOAL_TYPE_OPTIONS.find(opt => opt.value === goalType) || GOAL_TYPE_OPTIONS[0];
  };

  const goalsByType = (type: GoalType) => goals.filter(g => g.goalType === type);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Crear nuevo reto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Validation Errors */}
          {showValidation && (!hasValidName || !hasAtLeastOneGoal || !hasAtLeastOneObjetivo) && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {!hasValidName && <p>• El nombre del reto es obligatorio</p>}
                {!hasAtLeastOneGoal && <p>• Debes añadir al menos un elemento</p>}
                {hasAtLeastOneGoal && !hasAtLeastOneObjetivo && <p>• Debes añadir al menos un objetivo</p>}
              </AlertDescription>
            </Alert>
          )}

          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del reto *</Label>
            <Input
              id="name"
              placeholder="Ej: Transformación fitness 90 días"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={showValidation && !hasValidName ? "border-destructive" : ""}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label>Duración</Label>
            <div className="grid grid-cols-2 gap-2">
              {DURATION_OPTIONS.map((opt) => (
                <button
                  key={opt.days}
                  onClick={() => setDuration(opt.days)}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    duration === opt.days
                      ? "border-primary bg-primary/10 text-foreground"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <p className="font-medium text-sm">{opt.label}</p>
                  <p className="text-xs text-muted-foreground">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Goals by Type */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Elementos del reto *</Label>
            </div>
            
            <p className="text-xs text-muted-foreground">
              Define objetivos, propósitos, prohibiciones y excepciones para tu reto.
              <span className="text-destructive"> Mínimo un objetivo requerido.</span>
            </p>

            {/* Goal Type Sections */}
            {GOAL_TYPE_OPTIONS.map((typeOpt) => {
              const Icon = typeOpt.icon;
              const typeGoals = goals.map((g, i) => ({ ...g, originalIndex: i })).filter(g => g.goalType === typeOpt.value);
              
              return (
                <div key={typeOpt.value} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("gap-1", typeOpt.color)}>
                        <Icon className="w-3 h-3" />
                        {typeOpt.label}
                      </Badge>
                      <span className="text-xs text-muted-foreground">{typeOpt.description}</span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleAddGoal(typeOpt.value)}
                      className="h-7 text-xs"
                    >
                      <Plus className="w-3 h-3 mr-1" />
                      Añadir
                    </Button>
                  </div>

                  {typeGoals.length > 0 && (
                    <div className="space-y-2 pl-2 border-l-2 border-border/50">
                      {typeGoals.map((goal) => (
                        <div key={goal.originalIndex} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                          <div className="flex gap-2">
                            <Input
                              placeholder={
                                typeOpt.value === "objetivo" ? "Ej: Hacer ejercicio" :
                                typeOpt.value === "proposito" ? "Ej: Mejorar mi salud" :
                                typeOpt.value === "prohibicion" ? "Ej: No comer azúcar" :
                                "Ej: Día de descanso semanal"
                              }
                              value={goal.title}
                              onChange={(e) => handleGoalChange(goal.originalIndex, "title", e.target.value)}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleRemoveGoal(goal.originalIndex)}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                          
                          {typeOpt.value === "objetivo" && (
                            <div className="flex gap-2 items-center">
                              <Select
                                value={goal.frequency}
                                onValueChange={(value) => handleGoalChange(goal.originalIndex, "frequency", value)}
                              >
                                <SelectTrigger className="w-28">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="daily">Diario</SelectItem>
                                  <SelectItem value="global">Global</SelectItem>
                                </SelectContent>
                              </Select>
                              {goal.frequency === "global" && (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">Meta:</span>
                                  <Input
                                    type="number"
                                    min={1}
                                    placeholder="12"
                                    value={goal.targetCount || ""}
                                    onChange={(e) => handleGoalChange(goal.originalIndex, "targetCount", e.target.value)}
                                    className="w-16 h-8"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Motivation */}
          <div className="space-y-2">
            <Label htmlFor="motivation">¿Por qué este reto? (opcional)</Label>
            <Textarea
              id="motivation"
              placeholder="Tu motivación personal..."
              value={motivation}
              onChange={(e) => setMotivation(e.target.value)}
              rows={2}
            />
          </div>

          {/* Reward */}
          <div className="space-y-2">
            <Label htmlFor="reward">Recompensa al completar (opcional)</Label>
            <Input
              id="reward"
              placeholder="Ej: Un viaje, un regalo..."
              value={reward}
              onChange={(e) => setReward(e.target.value)}
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="description">Descripción (opcional)</Label>
            <Textarea
              id="description"
              placeholder="Detalles adicionales..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? "Creando..." : "Crear reto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
