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
import { Plus, X, Target, Briefcase, User, Sparkles } from "lucide-react";

interface GoalInput {
  title: string;
  description?: string;
  frequency: "daily" | "global";
  targetCount?: number;
}

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChallenge: (
    name: string,
    durationDays: number,
    goals: { title: string; description?: string; frequency?: string; targetCount?: number }[],
    options?: {
      description?: string;
      category?: string;
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

const CATEGORY_OPTIONS = [
  { value: "personal", label: "Personal", icon: User, color: "bg-primary/20 text-primary border-primary/30" },
  { value: "professional", label: "Profesional", icon: Briefcase, color: "bg-warning/20 text-warning border-warning/30" },
  { value: "other", label: "Otro", icon: Sparkles, color: "bg-accent/20 text-accent-foreground border-accent/30" },
];

export const CreateChallengeDialog = ({
  open,
  onOpenChange,
  onCreateChallenge,
}: CreateChallengeDialogProps) => {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState(30);
  const [category, setCategory] = useState("personal");
  const [motivation, setMotivation] = useState("");
  const [reward, setReward] = useState("");
  const [goals, setGoals] = useState<GoalInput[]>([
    { title: "", frequency: "daily" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAddGoal = () => {
    setGoals([...goals, { title: "", frequency: "daily" }]);
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, field: keyof GoalInput, value: string | number) => {
    const newGoals = [...goals];
    if (field === "frequency") {
      newGoals[index] = { ...newGoals[index], frequency: value as "daily" | "global" };
    } else if (field === "targetCount") {
      newGoals[index] = { ...newGoals[index], targetCount: Number(value) || undefined };
    } else {
      newGoals[index] = { ...newGoals[index], [field]: value };
    }
    setGoals(newGoals);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    const validGoals = goals.filter(g => g.title.trim()).map(g => ({
      title: g.title,
      description: g.description,
      frequency: g.frequency,
      targetCount: g.frequency === "global" ? (g.targetCount || 1) : undefined,
    }));
    if (validGoals.length === 0) return;

    setLoading(true);
    try {
      await onCreateChallenge(name, duration, validGoals, {
        description: description || undefined,
        category,
        motivation: motivation || undefined,
        reward: reward || undefined,
      });
      
      // Reset form
      setName("");
      setDescription("");
      setDuration(30);
      setCategory("personal");
      setMotivation("");
      setReward("");
      setGoals([{ title: "", frequency: "daily" }]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Crear nuevo reto
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">Nombre del reto</Label>
            <Input
              id="name"
              placeholder="Ej: Leer 12 libros este año"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label>Tipo de reto</Label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORY_OPTIONS.map((cat) => {
                const Icon = cat.icon;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategory(cat.value)}
                    className={`p-3 rounded-lg border text-center transition-all ${
                      category === cat.value
                        ? `${cat.color} border-current`
                        : "border-border hover:border-primary/50 bg-background"
                    }`}
                  >
                    <Icon className="w-5 h-5 mx-auto mb-1" />
                    <p className="text-sm font-medium">{cat.label}</p>
                  </button>
                );
              })}
            </div>
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

          {/* Goals */}
          <div className="space-y-3">
            <Label>Objetivos</Label>
            <p className="text-xs text-muted-foreground">
              Diario = completar cada día | Global = alcanzar X veces durante el reto
            </p>
            <div className="space-y-3">
              {goals.map((goal, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 space-y-2">
                  <div className="flex gap-2">
                    <Input
                      placeholder={`Objetivo ${i + 1}`}
                      value={goal.title}
                      onChange={(e) => handleGoalChange(i, "title", e.target.value)}
                      className="flex-1"
                    />
                    {goals.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemoveGoal(i)}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={goal.frequency}
                      onValueChange={(value) => handleGoalChange(i, "frequency", value)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Diario</SelectItem>
                        <SelectItem value="global">Global</SelectItem>
                      </SelectContent>
                    </Select>
                    {goal.frequency === "global" && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Meta:</span>
                        <Input
                          type="number"
                          min={1}
                          placeholder="Ej: 12"
                          value={goal.targetCount || ""}
                          onChange={(e) => handleGoalChange(i, "targetCount", e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">veces</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={handleAddGoal}
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Añadir objetivo
              </Button>
            </div>
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
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || goals.every(g => !g.title.trim()) || loading}
          >
            {loading ? "Creando..." : "Crear reto"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};