import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Languages, Bot, Compass, ArrowRight, Sparkles } from "lucide-react";

const coaches = [
  {
    id: "english",
    path: "/coaches/english",
    icon: Languages,
    emoji: "🇬🇧",
    title: "English Coach",
    subtitle: "Metodologías Krashen, Pimsleur, Cambridge CELTA/DELTA",
    description: "Micro-lecciones personalizadas de 15-20 min. Práctica activa con IA, role plays profesionales y seguimiento de progreso.",
    color: "from-sky-500 to-blue-600",
    shadow: "shadow-sky-500/30",
    badgeText: "A1-C2",
    badgeClass: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  },
  {
    id: "ai",
    path: "/coaches/ai",
    icon: Bot,
    emoji: "🤖",
    title: "AI Coach",
    subtitle: "De principiante a experto en inteligencia artificial",
    description: "Lecciones adaptadas a tu nivel, laboratorio práctico con retos diarios, recursos curados y roadmap personalizado.",
    color: "from-violet-500 to-purple-600",
    shadow: "shadow-violet-500/30",
    badgeText: "Adaptativo",
    badgeClass: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  },
  {
    id: "life",
    path: "/coaches/life",
    icon: Compass,
    emoji: "🧭",
    title: "Life Coach",
    subtitle: "Hábitos, Deep Work, Productividad, Vulnerabilidad",
    description: "Sesiones de coaching 1:1 con IA socrática, check-ins diarios, plan de acción automático e insights de tus conversaciones PLAUD.",
    color: "from-emerald-500 to-teal-600",
    shadow: "shadow-emerald-500/30",
    badgeText: "Socrático",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  },
];

const Coaches = () => {
  const navigate = useNavigate();

  return (
    <main className="p-4 lg:p-6 max-w-5xl mx-auto space-y-6">
      <Breadcrumbs />

      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary" />
          🎓 Mis Profesores IA
        </h1>
        <p className="text-muted-foreground mt-1">
          Coaching personalizado con las mejores metodologías del mundo
        </p>
      </div>

      <div className="grid gap-6">
        {coaches.map((coach) => (
          <Card
            key={coach.id}
            className="group cursor-pointer hover:border-primary/30 transition-all duration-300"
            onClick={() => navigate(coach.path)}
          >
            <CardContent className="p-6">
              <div className="flex items-start gap-5">
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${coach.color} flex items-center justify-center shrink-0 shadow-lg ${coach.shadow} group-hover:scale-105 transition-transform`}>
                  <coach.icon className="w-8 h-8 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <h2 className="text-xl font-bold text-foreground">
                      {coach.emoji} {coach.title}
                    </h2>
                    <Badge className={coach.badgeClass}>{coach.badgeText}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mb-2">{coach.subtitle}</p>
                  <p className="text-sm text-foreground/80">{coach.description}</p>
                </div>
                <Button variant="ghost" size="icon" className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ArrowRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
};

export default Coaches;
