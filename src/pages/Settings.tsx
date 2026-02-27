import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2, User, Bot, Calendar as CalendarIcon, Palette, Eye, LayoutDashboard, Bell as BellIcon, HardDrive, RotateCcw, DollarSign } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAuth } from "@/hooks/useAuth";
import { Breadcrumbs } from "@/components/layout/Breadcrumbs";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { ThemeSettingsCard } from "@/components/settings/ThemeSettingsCard";
import { AccessibilitySettingsCard } from "@/components/settings/AccessibilitySettingsCard";
import { ICloudCalendarSettingsCard } from "@/components/settings/ICloudCalendarSettingsCard";
import { ProfileSettingsCard } from "@/components/settings/ProfileSettingsCard";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { MenuVisibilityCard } from "@/components/settings/MenuVisibilityCard";
import { DashboardVisibilityCard } from "@/components/settings/DashboardVisibilityCard";
import { AICostTrackerCard } from "@/components/settings/AICostTrackerCard";

const SettingsSection = ({
  icon,
  title,
  description,
  children,
  defaultOpen = false,
}: {
  icon: React.ReactNode;
  title: string;
  description?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="cursor-pointer select-none py-4 px-4 sm:px-6"
        onClick={() => setOpen((v) => !v)}
      >
        <div className="flex items-center justify-between gap-2 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="flex-shrink-0 text-primary">{icon}</span>
            <div className="min-w-0">
              <CardTitle className="text-sm sm:text-base font-semibold leading-tight truncate">
                {title}
              </CardTitle>
              {description && !open && (
                <p className="text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">
                  {description}
                </p>
              )}
            </div>
          </div>
          <span className="flex-shrink-0 text-muted-foreground">
            {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        </div>
      </CardHeader>
      {open && (
        <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
          {children}
        </CardContent>
      )}
    </Card>
  );
};

const Settings = () => {
  const { user } = useAuth();
  const { loading, updateSettings } = useUserSettings();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Cargando ajustes...</p>
        </div>
      </div>
    );
  }

  return (
    <main className="p-3 sm:p-4 lg:p-6 space-y-3 sm:space-y-4 max-w-3xl mx-auto">
      <Breadcrumbs />

      <div className="pt-1 pb-2">
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ajustes</h1>
        <p className="text-muted-foreground text-xs sm:text-sm">
          Personaliza tu experiencia en JARVIS
        </p>
      </div>

      <SettingsSection
        icon={<User className="h-4 w-4 sm:h-5 sm:w-5" />}
        title="Perfil"
        description="Información de tu cuenta"
        defaultOpen={true}
      >
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
            <span className="text-xl sm:text-2xl font-bold text-primary">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </span>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-foreground text-sm sm:text-base truncate">
              {user?.email?.split("@")[0] || "Usuario"}
            </p>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
          </div>
        </div>
      </SettingsSection>

      <SettingsSection icon={<Bot className="h-4 w-4 sm:h-5 sm:w-5" />} title="Perfil JARVIS" description="Personaliza como JARVIS te conoce">
        <ProfileSettingsCard />
      </SettingsSection>

      <SettingsSection icon={<CalendarIcon className="h-4 w-4 sm:h-5 sm:w-5" />} title="iCloud Calendar" description="Sincronizacion con Apple Calendar">
        <ICloudCalendarSettingsCard />
      </SettingsSection>

      <SettingsSection icon={<Palette className="h-4 w-4 sm:h-5 sm:w-5" />} title="Apariencia" description="Tema y estilo visual">
        <ThemeSettingsCard />
      </SettingsSection>

      <SettingsSection icon={<span className="text-base">Aa</span>} title="Accesibilidad" description="Tamano de texto e idioma">
        <AccessibilitySettingsCard />
      </SettingsSection>

      <SettingsSection icon={<Eye className="h-4 w-4 sm:h-5 sm:w-5" />} title="Visibilidad del menu" description="Elige que elementos aparecen en el menu lateral">
        <MenuVisibilityCard />
      </SettingsSection>

      <SettingsSection icon={<LayoutDashboard className="h-4 w-4 sm:h-5 sm:w-5" />} title="Tarjetas del Dashboard" description="Elige que tarjetas se muestran en tu Dashboard">
        <DashboardVisibilityCard />
      </SettingsSection>

      <SettingsSection icon={<BellIcon className="h-4 w-4 sm:h-5 sm:w-5" />} title="Notificaciones Push" description="Gestiona las alertas de la app">
        <NotificationSettings />
      </SettingsSection>

      <SettingsSection icon={<DollarSign className="h-4 w-4 sm:h-5 sm:w-5" />} title="Consumo de IA" description="Desglose de gasto por modelo, tokens y precio">
        <AICostTrackerCard />
      </SettingsSection>

      <SettingsSection icon={<HardDrive className="h-4 w-4 sm:h-5 sm:w-5" />} title="Exportar datos" description="Descarga tu informacion">
        <DataExportCard />
      </SettingsSection>

      <SettingsSection icon={<RotateCcw className="h-4 w-4 sm:h-5 sm:w-5" />} title="Setup Inicial" description="Relanzar el wizard de configuracion">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Vuelve a ejecutar el wizard de onboarding para importar contactos, WhatsApp y vincular datos.
          </p>
          <Button
            variant="outline"
            onClick={async () => {
              await updateSettings({ onboarding_completed: false } as any);
              navigate("/onboarding");
            }}
          >
            <RotateCcw className="h-4 w-4 mr-2" /> Relanzar wizard
          </Button>
        </div>
      </SettingsSection>
    </main>
  );
};

export default Settings;
