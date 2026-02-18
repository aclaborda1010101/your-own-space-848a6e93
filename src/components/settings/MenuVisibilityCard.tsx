import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useUserSettings } from "@/hooks/useUserSettings";
import { toast } from "sonner";
import {
  LayoutDashboard,
  MessageSquare,
  Mic,
  Activity,
  Trophy,
  Newspaper,
  UtensilsCrossed,
  Wallet,
  Gauge,
  PenLine,
  Baby,
  Brain,
  Sparkles,
  Languages,
  GraduationCap,
  Settings,
  Eye,
  CheckSquare,
  Calendar,
} from "lucide-react";

interface MenuItem {
  icon: React.ElementType;
  label: string;
  path: string;
  permanent?: boolean;
}

const menuGroups: { title: string; items: MenuItem[] }[] = [
  {
    title: "Principal",
    items: [
      { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard", permanent: true },
      { icon: MessageSquare, label: "JARVIS", path: "/chat" },
      { icon: Mic, label: "Comunicaciones", path: "/communications" },
      { icon: CheckSquare, label: "Tareas", path: "/tasks" },
      { icon: Calendar, label: "Calendario", path: "/calendar" },
      { icon: Activity, label: "Salud", path: "/health" },
      { icon: Trophy, label: "Deportes", path: "/sports" },
    ],
  },
  {
    title: "Módulos",
    items: [
      { icon: Newspaper, label: "Noticias IA", path: "/ai-news" },
      { icon: UtensilsCrossed, label: "Nutrición", path: "/nutrition" },
      { icon: Wallet, label: "Finanzas", path: "/finances" },
      { icon: Gauge, label: "Mi Estado", path: "/agustin/state" },
      { icon: PenLine, label: "Contenido", path: "/content" },
    ],
  },
  {
    title: "Bosco",
    items: [
      { icon: Baby, label: "Actividades", path: "/bosco" },
      { icon: Brain, label: "Análisis Profundo", path: "/bosco/analysis" },
    ],
  },
  {
    title: "Formación",
    items: [
      { icon: Sparkles, label: "Coach", path: "/coach" },
      { icon: Languages, label: "Inglés", path: "/english" },
      { icon: GraduationCap, label: "Curso IA", path: "/ai-course" },
    ],
  },
  {
    title: "Sistema",
    items: [
      { icon: Settings, label: "Ajustes", path: "/settings", permanent: true },
    ],
  },
];

export const MenuVisibilityCard = () => {
  const { settings, updateSettings } = useUserSettings();
  const hiddenItems = settings.hidden_menu_items || [];

  const toggleItem = async (path: string) => {
    const newHidden = hiddenItems.includes(path)
      ? hiddenItems.filter((p) => p !== path)
      : [...hiddenItems, path];

    try {
      await updateSettings({ hidden_menu_items: newHidden });
    } catch {
      toast.error("Error al guardar la configuración del menú");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Eye className="h-5 w-5 text-primary" />
          Visibilidad del menú
        </CardTitle>
        <CardDescription>
          Elige qué elementos aparecen en el menú lateral
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {menuGroups.map((group) => (
          <div key={group.title} className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {group.title}
            </p>
            <div className="space-y-2">
              {group.items.map((item) => {
                const isVisible = !hiddenItems.includes(item.path);
                return (
                  <div
                    key={item.path}
                    className="flex items-center justify-between py-1.5"
                  >
                    <Label className="flex items-center gap-2.5 cursor-pointer text-sm font-normal">
                      <item.icon className="h-4 w-4 text-muted-foreground" />
                      {item.label}
                    </Label>
                    <Switch
                      checked={isVisible}
                      onCheckedChange={() => toggleItem(item.path)}
                      disabled={item.permanent}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
