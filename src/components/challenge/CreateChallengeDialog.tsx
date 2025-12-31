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
import { Plus, X, Target } from "lucide-react";

interface CreateChallengeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateChallenge: (
    name: string,
    durationDays: number,
    goals: { title: string; description?: string }[],
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
  { value: "personal", label: "Personal" },
  { value: "health", label: "Salud" },
  { value: "work", label: "Trabajo" },
  { value: "learning", label: "Aprendizaje" },
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
  const [goals, setGoals] = useState<{ title: string; description?: string }[]>([
    { title: "" },
  ]);
  const [loading, setLoading] = useState(false);

  const handleAddGoal = () => {
    setGoals([...goals, { title: "" }]);
  };

  const handleRemoveGoal = (index: number) => {
    setGoals(goals.filter((_, i) => i !== index));
  };

  const handleGoalChange = (index: number, value: string) => {
    const newGoals = [...goals];
    newGoals[index] = { ...newGoals[index], title: value };
    setGoals(newGoals);
  };

  const handleSubmit = async () => {
    if (!name.trim()) return;
    
    const validGoals = goals.filter(g => g.title.trim());
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
      setGoals([{ title: "" }]);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
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
              placeholder="Ej: 30 días de ejercicio"
              value={name}
              onChange={(e) => setName(e.target.value)}
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

          {/* Category */}
          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORY_OPTIONS.map((cat) => (
                <Badge
                  key={cat.value}
                  variant={category === cat.value ? "default" : "outline"}
                  className="cursor-pointer"
                  onClick={() => setCategory(cat.value)}
                >
                  {cat.label}
                </Badge>
              ))}
            </div>
          </div>

          {/* Goals */}
          <div className="space-y-2">
            <Label>Objetivos diarios</Label>
            <div className="space-y-2">
              {goals.map((goal, i) => (
                <div key={i} className="flex gap-2">
                  <Input
                    placeholder={`Objetivo ${i + 1}`}
                    value={goal.title}
                    onChange={(e) => handleGoalChange(i, e.target.value)}
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
