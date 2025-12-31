import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { 
  Type, 
  Languages,
  ALargeSmall
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUserSettings, FontSize, Language } from "@/hooks/useUserSettings";
import { toast } from "sonner";

export const AccessibilitySettingsCard = () => {
  const { settings, updateSettings } = useUserSettings();

  const fontSizes: { value: FontSize; label: string; preview: string }[] = [
    { value: "small", label: "Pequeño", preview: "Aa" },
    { value: "medium", label: "Mediano", preview: "Aa" },
    { value: "large", label: "Grande", preview: "Aa" },
  ];

  const languages: { value: Language; label: string; flag: string }[] = [
    { value: "es", label: "Español", flag: "🇪🇸" },
    { value: "en", label: "English", flag: "🇺🇸" },
  ];

  const handleFontSizeChange = async (value: FontSize) => {
    try {
      await updateSettings({ font_size: value });
      toast.success("Tamaño de fuente actualizado");
    } catch (error) {
      toast.error("Error al cambiar el tamaño de fuente");
    }
  };

  const handleLanguageChange = async (value: Language) => {
    try {
      await updateSettings({ language: value });
      toast.success(value === "es" ? "Idioma cambiado a Español" : "Language changed to English");
    } catch (error) {
      toast.error("Error al cambiar el idioma");
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ALargeSmall className="h-5 w-5 text-primary" />
          Accesibilidad
        </CardTitle>
        <CardDescription>
          Personaliza el tamaño del texto y el idioma
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Font Size */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Type className="h-4 w-4 text-muted-foreground" />
            Tamaño de fuente
          </Label>
          <RadioGroup
            value={settings.font_size}
            onValueChange={(v) => handleFontSizeChange(v as FontSize)}
            className="grid grid-cols-3 gap-3"
          >
            {fontSizes.map((size) => {
              const isSelected = settings.font_size === size.value;
              
              return (
                <Label
                  key={size.value}
                  htmlFor={`font-${size.value}`}
                  className={cn(
                    "flex flex-col items-center gap-2 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={size.value} id={`font-${size.value}`} className="sr-only" />
                  <span className={cn(
                    "font-bold",
                    size.value === "small" && "text-sm",
                    size.value === "medium" && "text-base",
                    size.value === "large" && "text-xl",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {size.preview}
                  </span>
                  <span className={cn(
                    "text-xs",
                    isSelected ? "text-primary" : "text-muted-foreground"
                  )}>
                    {size.label}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
        </div>

        {/* Language */}
        <div className="space-y-3">
          <Label className="flex items-center gap-2">
            <Languages className="h-4 w-4 text-muted-foreground" />
            Idioma
          </Label>
          <RadioGroup
            value={settings.language}
            onValueChange={(v) => handleLanguageChange(v as Language)}
            className="grid grid-cols-2 gap-3"
          >
            {languages.map((lang) => {
              const isSelected = settings.language === lang.value;
              
              return (
                <Label
                  key={lang.value}
                  htmlFor={`lang-${lang.value}`}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all",
                    isSelected 
                      ? "border-primary bg-primary/10" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                >
                  <RadioGroupItem value={lang.value} id={`lang-${lang.value}`} className="sr-only" />
                  <span className="text-2xl">{lang.flag}</span>
                  <span className={cn(
                    "font-medium",
                    isSelected ? "text-primary" : "text-foreground"
                  )}>
                    {lang.label}
                  </span>
                </Label>
              );
            })}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">
            El cambio de idioma se aplicará a la interfaz de usuario.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};