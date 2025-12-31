import { useTheme } from "next-themes";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sun, Moon, Monitor, Palette } from "lucide-react";
import { cn } from "@/lib/utils";

export const ThemeSettingsCard = () => {
  const { theme, setTheme } = useTheme();

  const themes = [
    { 
      value: "dark", 
      label: "Oscuro", 
      description: "Tema oscuro estilo JARVIS",
      icon: Moon 
    },
    { 
      value: "light", 
      label: "Claro", 
      description: "Tema claro para uso diurno",
      icon: Sun 
    },
    { 
      value: "system", 
      label: "Sistema", 
      description: "Sigue la configuración del sistema",
      icon: Monitor 
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5 text-primary" />
          Apariencia
        </CardTitle>
        <CardDescription>
          Personaliza el tema visual de la aplicación
        </CardDescription>
      </CardHeader>
      <CardContent>
        <RadioGroup
          value={theme}
          onValueChange={setTheme}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {themes.map((t) => {
            const Icon = t.icon;
            const isSelected = theme === t.value;
            
            return (
              <Label
                key={t.value}
                htmlFor={t.value}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 cursor-pointer transition-all",
                  isSelected 
                    ? "border-primary bg-primary/10" 
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                )}
              >
                <RadioGroupItem value={t.value} id={t.value} className="sr-only" />
                <div className={cn(
                  "p-3 rounded-full",
                  isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
                )}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="text-center">
                  <p className={cn(
                    "font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {t.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t.description}
                  </p>
                </div>
              </Label>
            );
          })}
        </RadioGroup>
      </CardContent>
    </Card>
  );
};