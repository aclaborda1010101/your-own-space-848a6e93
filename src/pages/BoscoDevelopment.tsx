import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Brain, Palette, MessageSquare, Globe, Sparkles, Wand2,
  BookOpen, Target, Clock, Lightbulb, RefreshCw, Star,
  Puzzle, Dumbbell, Heart
} from "lucide-react";
import { cn } from "@/lib/utils";

interface DevelopmentActivity {
  title: string;
  description: string;
  duration: number;
  materials: string[];
  methodology: string;
  learningGoal: string;
}

const AREAS = [
  {
    id: "cognitive",
    emoji: "🧠",
    label: "Cognitivo",
    color: "text-blue-500",
    bgColor: "bg-blue-500/20",
    borderColor: "border-blue-500/30",
    icon: Brain,
    methodologies: ["Harvard Project Zero", "Visible Thinking"],
    description: "Puzzles, memoria, patrones, pre-lectura, pre-matemáticas",
    activities: [
      { title: "Secuencias con bloques", description: "Crear patrones ABAB, AABB con bloques de colores. Progresión: 2 colores → 3 colores → formas.", duration: 15, materials: ["Bloques de colores", "Mesa amplia"], methodology: "Visible Thinking", learningGoal: "Reconocimiento de patrones y pensamiento secuencial" },
      { title: "Memory de parejas", description: "Juego de memoria con tarjetas. Empezar con 6 parejas, subir a 10. Variante: emparejar número con cantidad de objetos.", duration: 10, materials: ["Tarjetas de memoria"], methodology: "Harvard Project Zero", learningGoal: "Memoria de trabajo y concentración" },
      { title: "Pre-lectura con cuentos", description: "Leer un cuento y hacer preguntas: ¿Qué crees que pasará? ¿Por qué hizo eso? Señalar palabras mientras se lee.", duration: 20, materials: ["Cuento apropiado para 5 años"], methodology: "Visible Thinking", learningGoal: "Comprensión lectora y predicción narrativa" },
    ]
  },
  {
    id: "creative",
    emoji: "🎨",
    label: "Creativo",
    color: "text-pink-500",
    bgColor: "bg-pink-500/20",
    borderColor: "border-pink-500/30",
    icon: Palette,
    methodologies: ["Reggio Emilia", "Project Zero"],
    description: "Arte, música, storytelling, imaginación",
    activities: [
      { title: "Pintura libre con música", description: "Poner música clásica/instrumental y dejar que Bosco pinte lo que la música le inspira. Sin guía, solo expresión.", duration: 20, materials: ["Pinturas", "Papel grande", "Música"], methodology: "Reggio Emilia", learningGoal: "Expresión artística y conexión sensorial" },
      { title: "Inventar un personaje", description: "Crear un personaje con nombre, historia, poderes y debilidades. Dibujarlo y crear una mini-aventura.", duration: 15, materials: ["Papel", "Colores"], methodology: "Project Zero", learningGoal: "Creatividad narrativa y diseño de personajes" },
      { title: "Teatro de sombras", description: "Usar una linterna y las manos para crear sombras. Inventar una historia corta con los personajes de sombras.", duration: 15, materials: ["Linterna", "Pared blanca"], methodology: "Reggio Emilia", learningGoal: "Imaginación, motricidad fina y narración" },
    ]
  },
  {
    id: "motor",
    emoji: "🤸",
    label: "Motor",
    color: "text-orange-500",
    bgColor: "bg-orange-500/20",
    borderColor: "border-orange-500/30",
    icon: Dumbbell,
    methodologies: ["Desarrollo integral", "Psicomotricidad"],
    description: "Coordinación, deporte, manualidades",
    activities: [
      { title: "Circuito de obstáculos", description: "Crear un circuito con cojines, sillas y cuerdas. Gatear, saltar, equilibrio. Cronometrar y mejorar.", duration: 20, materials: ["Cojines", "Sillas", "Cuerda"], methodology: "Psicomotricidad", learningGoal: "Coordinación motora gruesa y equilibrio" },
      { title: "Recortar y pegar collage", description: "Recortar formas de revistas y crear un collage temático (animales, colores, mi familia).", duration: 15, materials: ["Revistas", "Tijeras infantiles", "Pegamento"], methodology: "Desarrollo integral", learningGoal: "Motricidad fina y coordinación ojo-mano" },
      { title: "Yoga animal", description: "Hacer posturas de yoga imitando animales: árbol, gato, perro boca abajo, cobra. Respiración consciente.", duration: 10, materials: ["Esterilla o alfombra"], methodology: "Desarrollo integral", learningGoal: "Flexibilidad, equilibrio y conciencia corporal" },
    ]
  },
  {
    id: "social",
    emoji: "💬",
    label: "Social-emocional",
    color: "text-red-500",
    bgColor: "bg-red-500/20",
    borderColor: "border-red-500/30",
    icon: Heart,
    methodologies: ["Growth Mindset (Dweck)", "Disciplina Positiva"],
    description: "Empatía, resolución de conflictos, autoregulación",
    activities: [
      { title: "El semáforo de emociones", description: "Rojo = para y respira, Amarillo = piensa opciones, Verde = actúa. Practicar con situaciones cotidianas.", duration: 10, materials: ["Tarjetas de colores rojo/amarillo/verde"], methodology: "Growth Mindset (Dweck)", learningGoal: "Autoregulación emocional y toma de decisiones" },
      { title: "¿Cómo se siente el personaje?", description: "Leer un cuento y pausar para preguntar: ¿Cómo se siente? ¿Qué haría yo? ¿Cómo podemos ayudar?", duration: 15, materials: ["Cuento con conflictos emocionales"], methodology: "Disciplina Positiva", learningGoal: "Empatía y perspectiva del otro" },
      { title: "Mi frasco de gratitud", description: "Cada día escribir o dibujar algo por lo que estamos agradecidos. Leer los papelitos el fin de semana.", duration: 5, materials: ["Frasco de cristal", "Papelitos de colores"], methodology: "Growth Mindset (Dweck)", learningGoal: "Gratitud, positividad y reflexión" },
    ]
  },
  {
    id: "world",
    emoji: "🌍",
    label: "Conocimiento del mundo",
    color: "text-teal-500",
    bgColor: "bg-teal-500/20",
    borderColor: "border-teal-500/30",
    icon: Globe,
    methodologies: ["Aprendizaje por descubrimiento", "STEM temprano"],
    description: "Ciencia, naturaleza, culturas",
    activities: [
      { title: "Explorador de insectos", description: "Salir al parque con lupa. Observar insectos, contar patas, dibujar lo que vemos. ¿Dónde viven? ¿Qué comen?", duration: 20, materials: ["Lupa", "Cuaderno de campo", "Lápices"], methodology: "Aprendizaje por descubrimiento", learningGoal: "Observación científica y clasificación" },
      { title: "Experimento: volcán de vinagre", description: "Crear un volcán con plastilina, vinagre y bicarbonato. Observar la reacción y explicar por qué burbujea.", duration: 15, materials: ["Plastilina", "Vinagre", "Bicarbonato", "Colorante"], methodology: "STEM temprano", learningGoal: "Método científico y reacciones químicas básicas" },
      { title: "Viaje virtual a un país", description: "Elegir un país en el mapa, ver fotos, escuchar su música y probar una receta sencilla de allí.", duration: 20, materials: ["Mapa o globo", "Tablet", "Ingredientes sencillos"], methodology: "Aprendizaje por descubrimiento", learningGoal: "Curiosidad cultural y geografía básica" },
    ]
  },
];

export default function BoscoDevelopment() {
  const { user } = useAuth();
  const [selectedArea, setSelectedArea] = useState("cognitive");
  const [generatedActivity, setGeneratedActivity] = useState<DevelopmentActivity | null>(null);
  const [generating, setGenerating] = useState(false);
  const [resources] = useState([
    { type: "📚", title: "Mente absorbente (Montessori)", age: "3-6 años" },
    { type: "📱", title: "Khan Academy Kids", age: "2-7 años" },
    { type: "🎮", title: "ScratchJr", age: "5-7 años" },
    { type: "📚", title: "El monstruo de colores", age: "3-6 años" },
    { type: "📱", title: "Duolingo ABC", age: "3-6 años" },
  ]);

  const currentArea = AREAS.find(a => a.id === selectedArea) || AREAS[0];

  const generateActivity = async () => {
    if (!user) return;
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("jarvis-bosco", {
        body: {
          messages: [{
            role: "user",
            content: `Genera UNA actividad de desarrollo ${currentArea.label} para un niño de 5 años.
Área: ${currentArea.description}
Metodologías: ${currentArea.methodologies.join(", ")}

Responde SOLO en JSON:
{
  "title": "nombre corto",
  "description": "qué hacer (2-3 frases)",
  "duration": minutos,
  "materials": ["material1"],
  "methodology": "metodología usada",
  "learningGoal": "qué aprende (1 frase)"
}`
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
    } catch {
      toast.error("Error al generar actividad");
    }
    setGenerating(false);
  };

  return (
    <main className="p-4 lg:p-6 space-y-6">
      <Breadcrumbs />

      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-2xl shadow-lg">
          🌱
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Desarrollo de Bosco</h1>
          <p className="text-muted-foreground text-sm">Harvard Project Zero • Visible Thinking • Growth Mindset (Dweck)</p>
        </div>
      </div>

      {/* Area selector */}
      <div className="grid grid-cols-5 gap-2">
        {AREAS.map(area => (
          <button
            key={area.id}
            onClick={() => { setSelectedArea(area.id); setGeneratedActivity(null); }}
            className={cn(
              "flex flex-col items-center gap-1 p-3 rounded-xl transition-all text-center",
              selectedArea === area.id
                ? `${area.bgColor} ring-2 ring-primary`
                : "bg-muted/50 hover:bg-muted"
            )}
          >
            <span className="text-2xl">{area.emoji}</span>
            <span className="text-xs font-medium">{area.label}</span>
          </button>
        ))}
      </div>

      {/* Current area detail */}
      <Card className={cn("border", currentArea.borderColor)}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", currentArea.bgColor)}>
                <currentArea.icon className={cn("w-5 h-5", currentArea.color)} />
              </div>
              <div>
                <CardTitle className="text-lg">{currentArea.emoji} {currentArea.label}</CardTitle>
                <p className="text-xs text-muted-foreground">{currentArea.description}</p>
              </div>
            </div>
            <div className="flex gap-1">
              {currentArea.methodologies.map(m => (
                <Badge key={m} variant="outline" className="text-[10px]">{m}</Badge>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Generate button */}
          <Button onClick={generateActivity} disabled={generating} variant="outline" className="w-full">
            <Wand2 className={cn("w-4 h-4 mr-2", generating && "animate-spin")} />
            Generar actividad de {currentArea.label}
          </Button>

          {/* Generated activity */}
          {generatedActivity && (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <p className="font-medium text-sm">{generatedActivity.title}</p>
                  <Badge variant="outline" className="text-[10px] ml-auto">
                    <Clock className="w-3 h-3 mr-1" />{generatedActivity.duration} min
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground">{generatedActivity.description}</p>
                <div className="flex gap-1 flex-wrap">
                  {generatedActivity.materials.map((m, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground"><Target className="w-3 h-3 inline mr-1" />{generatedActivity.learningGoal}</p>
              </CardContent>
            </Card>
          )}

          {/* Preset activities */}
          <div className="grid gap-3 md:grid-cols-1">
            {currentArea.activities.map((activity, i) => (
              <Card key={i} className="bg-muted/30">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm">{activity.title}</p>
                    <div className="flex gap-2">
                      <Badge variant="outline" className="text-[10px]">{activity.methodology}</Badge>
                      <Badge variant="secondary" className="text-[10px]">
                        <Clock className="w-3 h-3 mr-1" />{activity.duration} min
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{activity.description}</p>
                  <div className="flex gap-1 flex-wrap">
                    {activity.materials.map((m, i) => (
                      <Badge key={i} variant="secondary" className="text-[10px]">{m}</Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Target className="w-3 h-3" /> {activity.learningGoal}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Resources */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-green-500" />
            Lecturas y recursos
          </CardTitle>
          <p className="text-xs text-muted-foreground">Libros, apps y juegos recomendados por edad y nivel</p>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2">
            {resources.map((r, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <span className="text-xl">{r.type}</span>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.title}</p>
                  <p className="text-xs text-muted-foreground">{r.age}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
