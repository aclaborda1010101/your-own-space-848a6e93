import { useState } from "react";
import { SidebarNew } from "@/components/layout/SidebarNew";
import { TopBar } from "@/components/layout/TopBar";
import { BottomNavBar } from "@/components/layout/BottomNavBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { useUserSettings } from "@/hooks/useUserSettings";
import { useAuth } from "@/hooks/useAuth";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { DataExportCard } from "@/components/settings/DataExportCard";
import { ThemeSettingsCard } from "@/components/settings/ThemeSettingsCard";
import { AccessibilitySettingsCard } from "@/components/settings/AccessibilitySettingsCard";
import { ICloudCalendarSettingsCard } from "@/components/settings/ICloudCalendarSettingsCard";
import { ProfileSettingsCard } from "@/components/settings/ProfileSettingsCard";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { MenuVisibilityCard } from "@/components/settings/MenuVisibilityCard";
import { DashboardVisibilityCard } from "@/components/settings/DashboardVisibilityCard";

// Collapsible wrapper component
const CollapsibleSection = ({
    children,
    defaultOpen = false,
}: {
    children: React.ReactNode;
    defaultOpen?: boolean;
}) => {
    const [open, setOpen] = useState(defaultOpen);

    // Clone child to inject toggle props
    const child = children as React.ReactElement<{
          isCollapsible?: boolean;
          isOpen?: boolean;
          onToggle?: () => void;
    }>;

    return (
          <>
            {React.cloneElement(child, {
                    isCollapsible: true,
                    isOpen: open,
                    onToggle: () => setOpen((v) => !v),
          })}
          </>>
        );
};

// Wrapper card that supports collapsing
const SettingsSection = ({
    icon,
    title,
    description,
    children,
    isCollapsible,
    isOpen,
    onToggle,
    defaultOpen = false,
}: {
    icon: React.ReactNode;
    title: string;
    description?: string;
    children: React.ReactNode;
    isCollapsible?: boolean;
    isOpen?: boolean;
    onToggle?: () => void;
    defaultOpen?: boolean;
}) => {
    const [localOpen, setLocalOpen] = useState(defaultOpen);
    const open = isCollapsible ? isOpen : localOpen;
    const toggle = isCollapsible ? onToggle : () => setLocalOpen((v) => !v);
  
    return (
          <Card className="overflow-hidden">
                <CardHeader
                          className="cursor-pointer select-none py-4 px-4 sm:px-6"
                          onClick={toggle}
                        >
                        <div className="flex items-center justify-between gap-2 min-w-0">
                                  <div className="flex items-center gap-2 min-w-0">
                                              <span className="flex-shrink-0 text-primary">{icon}</span>span>
                                              <div className="min-w-0">
                                                            <CardTitle className="text-sm sm:text-base font-semibold leading-tight truncate">
                                                              {title}
                                                            </CardTitle>CardTitle>
                                                {description && !open && (
                                          <p className="text-xs text-muted-foreground mt-0.5 truncate hidden sm:block">
                                            {description}
                                          </p>p>
                                                            )}
                                              </div>div>
                                  </div>div>
                                  <span className="flex-shrink-0 text-muted-foreground">
                                    {open ? (
                                        <ChevronUp className="h-4 w-4" />
                                      ) : (
                                        <ChevronDown className="h-4 w-4" />
                                      )}
                                  </span>span>
                        </div>div>
                </CardHeader>CardHeader>
            {open && (
                    <CardContent className="px-4 sm:px-6 pb-4 sm:pb-6 pt-0">
                      {children}
                    </CardContent>CardContent>
                )}
          </Card>Card>
        );
};

import React from "react";

const Settings = () => {
    const {
          isOpen: sidebarOpen,
          isCollapsed: sidebarCollapsed,
          open: openSidebar,
          close: closeSidebar,
          toggleCollapse: toggleSidebarCollapse,
    } = useSidebarState();
    const { user } = useAuth();
    const { loading } = useUserSettings();
  
    if (loading) {
          return (
                  <div className="min-h-screen bg-background flex items-center justify-center">
                          <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                    <p className="text-muted-foreground">Cargando ajustes...</p>p>
                          </div>div>
                  </div>div>
                );
    }
  
    return (
          <div className="min-h-screen bg-background">
                <SidebarNew
                          isOpen={sidebarOpen}
                          onClose={closeSidebar}
                          isCollapsed={sidebarCollapsed}
                          onToggleCollapse={toggleSidebarCollapse}
                        />
          
                <div
                          className={cn(
                                      "transition-all duration-300",
                                      sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
                                    )}
                        >
                        <TopBar onMenuClick={openSidebar} />
                
                        <main className="p-3 sm:p-4 lg:p-6 pb-24 lg:pb-6 space-y-3 sm:space-y-4 max-w-3xl mx-auto">
                          {/* Header */}
                                  <div className="pt-1 pb-2">
                                              <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                                                            Ajustes
                                              </h1>h1>
                                              <p className="text-muted-foreground text-xs sm:text-sm">
                                                            Personaliza tu experiencia en JARVIS
                                              </p>p>
                                  </div>div>
                        
                          {/* Perfil (cuenta) */}
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
                                                                            </span>span>
                                                            </div>div>
                                                            <div className="min-w-0">
                                                                            <p className="font-medium text-foreground text-sm sm:text-base truncate">
                                                                              {user?.email?.split("@")[0] || "Usuario"}
                                                                            </p>p>
                                                                            <p className="text-xs sm:text-sm text-muted-foreground truncate">
                                                                              {user?.email}
                                                                            </p>p>
                                                            </div>div>
                                              </div>div>
                                  </SettingsSection>SettingsSection>
                        
                          {/* JARVIS Profile */}
                                  <SettingsSection
                                                icon={<span className="text-base">🤖</span>span>}
                                              title="Perfil JARVIS"
                                              description="Personaliza cómo JARVIS te conoce"
                                            >
                                              <ProfileSettingsCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* iCloud Calendar */}
                                  <SettingsSection
                                                icon={<span className="text-base">📅</span>span>}
                                              title="iCloud Calendar"
                                              description="Sincronización con Apple Calendar"
                                            >
                                              <ICloudCalendarSettingsCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Apariencia */}
                                  <SettingsSection
                                                icon={<span className="text-base">🎨</span>span>}
                                              title="Apariencia"
                                              description="Tema y estilo visual"
                                            >
                                              <ThemeSettingsCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Accesibilidad */}
                                  <SettingsSection
                                                icon={<span className="text-base">Aa</span>span>}
                                              title="Accesibilidad"
                                              description="Tamaño de texto e idioma"
                                            >
                                              <AccessibilitySettingsCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Visibilidad del menú */}
                                  <SettingsSection
                                                icon={<span className="text-base">👁️</span>span>}
                                              title="Visibilidad del menú"
                                              description="Elige qué elementos aparecen en el menú lateral"
                                            >
                                              <MenuVisibilityCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Tarjetas del Dashboard */}
                                  <SettingsSection
                                                icon={<span className="text-base">📊</span>span>}
                                              title="Tarjetas del Dashboard"
                                              description="Elige qué tarjetas se muestran en tu Dashboard"
                                            >
                                              <DashboardVisibilityCard embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Notificaciones */}
                                  <SettingsSection
                                                icon={<span className="text-base">🔔</span>span>}
                                              title="Notificaciones Push"
                                              description="Gestiona las alertas de la app"
                                            >
                                              <NotificationSettings embedded />
                                  </SettingsSection>SettingsSection>
                        
                          {/* Exportar datos */}
                                  <SettingsSection
                                                icon={<span className="text-base">💾</span>span>}
                                              title="Exportar datos"
                                              description="Descarga tu información"
                                            >
                                              <DataExportCard embedded />
                                  </SettingsSection>SettingsSection>
                        </main>main>
                </div>div>
          
                <BottomNavBar />
          </div>div>
        );
};

export default Settings;</>
