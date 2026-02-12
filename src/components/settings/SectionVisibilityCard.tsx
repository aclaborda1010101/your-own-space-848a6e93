import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { 
  LayoutGrid, 
  PenLine, 
  Wallet, 
  UtensilsCrossed, 
  Newspaper, 
  Activity, 
  Trophy, 
  Mail, 
  GraduationCap
} from "lucide-react";
import { useUserSettings, SectionVisibility } from "@/hooks/useUserSettings";
import { toast } from "sonner";

const sections: { key: keyof SectionVisibility; label: string; icon: any }[] = [
  { key: "communications", label: "Comunicaciones", icon: Mail },
  { key: "health", label: "Salud", icon: Activity },
  { key: "sports", label: "Deportes", icon: Trophy },
  { key: "ai_news", label: "Noticias IA", icon: Newspaper },
  { key: "nutrition", label: "Nutrición", icon: UtensilsCrossed },
  { key: "finances", label: "Finanzas", icon: Wallet },
  { key: "content", label: "Contenido", icon: PenLine },
  { key: "academy", label: "Formación", icon: GraduationCap },
];

export const SectionVisibilityCard = () => {
  const { settings, updateSettings } = useUserSettings();
  const visibility = settings.section_visibility;

  const handleToggle = async (key: keyof SectionVisibility) => {
    const newVisibility = { ...visibility, [key]: !visibility[key] };
    try {
      await updateSettings({ section_visibility: newVisibility });
    } catch {
      toast.error("Error al guardar");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LayoutGrid className="h-5 w-5 text-primary" />
          Secciones visibles
        </CardTitle>
        <CardDescription>
          Elige qué secciones aparecen en el menú
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {sections.map(({ key, label, icon: Icon }) => (
          <div key={key} className="flex items-center justify-between">
            <Label className="flex items-center gap-3 cursor-pointer">
              <Icon className="h-4 w-4 text-muted-foreground" />
              {label}
            </Label>
            <Switch
              checked={visibility[key]}
              onCheckedChange={() => handleToggle(key)}
            />
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
