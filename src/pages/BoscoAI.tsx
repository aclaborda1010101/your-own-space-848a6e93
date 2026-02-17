import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { toast } from "sonner";
import {
  Brain, Sparkles, Palette, Puzzle, Wand2, Clock, Users, Target,
  BookOpen, RefreshCw, Lightbulb, Mic, Image as ImageIcon, GraduationCap, Cpu
} from "lucide-react";
import { cn } from "@/lib/utils";

interface AIActivity {
  title: string;
  description: string;
  category: "exploration" | "creation" | "logic";
  duration: number;
  materials: string[];
  parentGuide: string;
  learningObjective: string;
}

const CATEGORIES = [
  { id: "exploration", label: "Exploración", icon: Mic, color: "text-blue-500", bgColor: "bg-blue-500/15",
    description: "Usar asistente de voz, adivinar animales con IA, explorar el mundo" },
  { id: "creation", label: "Creación", icon: Palette, color: "text-pink-500", bgColor: "bg-pink-500/15",
    description: "Crear cuentos con IA, hacer música, diseñar personajes" },
  { id: "logic", label: "Pensamiento lógico", icon: Puzzle, color: "text-green-500", bgColor: "bg-green-500/15",
    description: "Puzzles de secuencias, clasificar imágenes, si-entonces" },
];

const PRESET_ACTIVITIES: AIActivity[] = [
  {
    title: "¿Qué animal soy?",
    description: "Bosco describe un animal y la IA intenta adivinarlo. Luego la IA describe uno y Bosco adivina.",
    category: "exploration",
    duration: 10,
    materials: ["Tablet o móvil con asistente de voz"],
    parentGuide: "Ayuda a Bosco a formular descripciones con 3 pistas: tamaño, color y dónde vive. Celebra cada acierto.",
    learningObjective: "Desarrollar capacidad descriptiva y clasificación de seres vivos"
  },
  {
    title: "Mi cuento mágico",
    description: "Crear un cuento corto con la IA eligiendo personaje, lugar y problema. La IA genera la historia y Bosco dibuja las escenas.",
    category: "creation",
    duration: 20,
    materials: ["Tablet", "Papel y colores para dibujar"],
    parentGuide: "Deja que Bosco elija los elementos del cuento. Después de que la IA lo genere, léanlo juntos y que dibuje su escena favorita.",
    learningObjective: "Narrativa, creatividad visual y comprensión lectora"
  },
  {
    title: "Secuencias mágicas",
    description: "La IA muestra patrones de colores o formas y Bosco debe completar la secuencia. Empieza fácil (AB-AB) y sube la dificultad.",
    category: "logic",
    duration: 10,
    materials: ["Bloques de colores o fichas"],
    parentGuide: "Si se atasca, dale la primera pista del patrón. Usa objetos físicos para complementar lo digital.",
    learningObjective: "Reconocimiento de patrones y pensamiento secuencial"
  },
  {
    title: "Dibuja lo que la IA dice",
    description: "La IA describe una escena paso a paso y Bosco la dibuja. Después comparan el resultado.",
    category: "creation",
    duration: 15,
    materials: ["Papel grande", "Pinturas o rotuladores"],
    parentGuide: "Lee las instrucciones de la IA despacio. Acepta cualquier interpretación artística de Bosco.",
    learningObjective: "Escucha activa, interpretación y expresión artística"
  },
  {
    title: "Si esto, entonces aquello",
    description: "Juego de causa-efecto: '¿Qué pasa si llueve mucho?' La IA da opciones y Bosco elige, creando cadenas de consecuencias.",
    category: "logic",
    duration: 10,
    materials: ["Ninguno"],
    parentGuide: "Acepta respuestas creativas. Pregunta '¿y luego qué pasaría?' para extender el razonamiento.",
    learningObjective: "Pensamiento causal y toma de decisiones"
  },
  {
    title: "Mi canción inventada",
    description: "Bosco elige un tema (animales, el espacio, su familia) y la IA le ayuda a crear una canción corta con rimas.",
    category: "creation",
    duration: 15,
    materials: ["Instrumentos de juguete (opcional)"],
    parentGuide: "Canten juntos la canción resultante. Pueden inventar una melodía simple.",
    learningObjective: "Expresión musical, rimas y creatividad verbal"
  },
];

export default function BoscoAI() {
  const { user } = useAuth();
  const [generatedActivity, setGeneratedActivity] = useState<AIActivity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  const filteredActivities = selectedCategory === "all"
    ? PRESET_ACTIVITIES
    : PRESET_ACTIVITIES.filter(a => a.category === selectedCategory);

  const generateCustomActivity = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-bosco", {
        body: {
          messages: [{
            role: "user",
            content: `Genera UNA actividad de IA para un niño de 5 años. Metodología Montessori + Reggio Emilia + pensamiento computacional.

Responde en este formato JSON exacto:
{
  "title": "nombre corto",
  "description": "qué hacer (2-3 frases)",
  "category": "exploration|creation|logic",
  "duration": número de minutos,
  "materials": ["material1", "material2"],
  "parentGuide": "instrucciones para el padre (2-3 frases)",
  "learningObjective": "qué aprende el niño (1 frase)"
}

SOLO el JSON, sin texto adicional.`
          }],
          context: { childAge: 5, childName: "Bosco" },
          queryType: "activity"
        }
      });

      if (error) throw error;
      const text = data?.message || "";
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        setGeneratedActivity(JSON.parse(jsonMatch[0]));
        toast.success("Actividad generada");
      }
    } catch (err) {
      console.error(err);
      toast.error("Error al generar actividad");
    }
    setGenerating(false);
  };

  const getCategoryConfig = (cat: string) => CATEGORIES.find(c => c.id === cat) || CATEGORIES[0];

  const renderActivityCard = (activity: AIActivity, index: number) => {
    const catConfig = getCategoryConfig(activity.category);
    return (
      <Card key={index} className="hover:shadow-md transition-shadow">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center", catConfig.bgColor)}>
                <catConfig.icon className={cn("w-4 h-4", catConfig.color)} />
              </div>
              <CardTitle className="text-base">{activity.title}</CardTitle>
            </div>
            <Badge variant="outline" className="text-xs gap-1">
              <Clock className="w-3 h-3" />{activity.duration} min
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground leading-relaxed">{activity.description}</p>

          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1 flex items-center gap-1">
              <Users className="w-3 h-3" /> Guía para el padre
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">{activity.parentGuide}</p>
          </div>

          <div className="p-3 rounded-lg bg-muted/50 border border-border/50">
            <p className="text-xs font-medium text-foreground mb-1 flex items-center gap-1">
              <Target className="w-3 h-3" /> Objetivo de aprendizaje
            </p>
            <p className="text-xs text-muted-foreground">{activity.learningObjective}</p>
          </div>

          {activity.materials.length > 0 && (
            <div className="flex gap-1 flex-wrap">
              <span className="text-xs text-muted-foreground mr-1">Materiales:</span>
              {activity.materials.map((m, i) => (
                <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
          <Brain className="w-6 h-6 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Bosco descubre la IA</h1>
          <p className="text-muted-foreground text-sm">Montessori + Reggio Emilia + Pensamiento Computacional — 5 años</p>
        </div>
      </div>

      {/* Methodology badges */}
      <div className="flex gap-2 flex-wrap">
        <Badge variant="outline" className="text-xs gap-1.5"><GraduationCap className="w-3 h-3" /> Montessori</Badge>
        <Badge variant="outline" className="text-xs gap-1.5"><Palette className="w-3 h-3" /> Reggio Emilia</Badge>
        <Badge variant="outline" className="text-xs gap-1.5"><Cpu className="w-3 h-3" /> Pensamiento Computacional</Badge>
      </div>

      {/* Categories */}
      <div className="grid gap-3 md:grid-cols-3">
        {CATEGORIES.map(cat => (
          <Card
            key={cat.id}
            className={cn(
              "cursor-pointer transition-all",
              selectedCategory === cat.id ? "ring-2 ring-primary" : "hover:border-primary/30"
            )}
            onClick={() => setSelectedCategory(selectedCategory === cat.id ? "all" : cat.id)}
          >
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", cat.bgColor)}>
                  <cat.icon className={cn("w-5 h-5", cat.color)} />
                </div>
                <div>
                  <p className="font-medium text-sm">{cat.label}</p>
                  <p className="text-xs text-muted-foreground">{cat.description}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Generate custom activity */}
      <Card className="border-purple-500/30 bg-gradient-to-r from-purple-500/5 to-indigo-500/5">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Wand2 className="w-5 h-5 text-purple-500" />
              <div>
                <p className="font-medium text-sm">Generar actividad personalizada</p>
                <p className="text-xs text-muted-foreground">La IA creará una actividad basada en los intereses de Bosco</p>
              </div>
            </div>
            <Button onClick={generateCustomActivity} disabled={generating} size="sm">
              <RefreshCw className={cn("w-4 h-4 mr-2", generating && "animate-spin")} />
              Generar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Generated activity */}
      {generatedActivity && (
        <div>
          <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-500" /> Actividad generada por IA
          </h3>
          {renderActivityCard(generatedActivity, -1)}
        </div>
      )}

      {/* Activity grid */}
      <div>
        <h3 className="text-lg font-semibold mb-3">
          {selectedCategory === "all" ? "Todas las actividades" : getCategoryConfig(selectedCategory).label}
        </h3>
        <div className="grid gap-4 md:grid-cols-2">
          {filteredActivities.map((activity, i) => renderActivityCard(activity, i))}
        </div>
      </div>
    </main>
  );
}
