import { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

export interface MobileTab {
  value: string;
  label: string;
  icon?: ReactNode;
  badge?: string | number;
}

interface MobileTabsSelectorProps {
  tabs: MobileTab[];
  value: string;
  onValueChange: (v: string) => void;
  className?: string;
  /** En desktop usa tabs grid o auto; default 'auto' */
  desktopVariant?: "auto" | "grid";
}

/**
 * Renderiza un <Select> en móvil y un <TabsList> en desktop.
 * Evita el scroll horizontal de pestañas en pantallas pequeñas.
 *
 * Uso: envuelve este selector y los <TabsContent> dentro de un <Tabs>.
 */
export function MobileTabsSelector({
  tabs,
  value,
  onValueChange,
  className,
  desktopVariant = "auto",
}: MobileTabsSelectorProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    const current = tabs.find((t) => t.value === value);
    return (
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={cn(
            "w-full h-11 bg-card/60 border-border/60 backdrop-blur-sm font-medium",
            className
          )}
        >
          <SelectValue>
            <span className="flex items-center gap-2">
              {current?.icon}
              <span className="truncate">{current?.label || "Seleccionar"}</span>
              {current?.badge != null && (
                <span className="ml-auto text-xs text-muted-foreground">
                  {current.badge}
                </span>
              )}
            </span>
          </SelectValue>
        </SelectTrigger>
        <SelectContent className="z-50 bg-popover">
          {tabs.map((t) => (
            <SelectItem key={t.value} value={t.value}>
              <span className="flex items-center gap-2">
                {t.icon}
                <span>{t.label}</span>
                {t.badge != null && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t.badge}
                  </span>
                )}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  // Desktop: TabsList
  return (
    <TabsList
      className={cn(
        desktopVariant === "grid"
          ? `grid w-full grid-cols-${Math.min(tabs.length, 6)}`
          : "inline-flex flex-wrap h-auto",
        className
      )}
    >
      {tabs.map((t) => (
        <TabsTrigger key={t.value} value={t.value} className="gap-2">
          {t.icon}
          <span>{t.label}</span>
          {t.badge != null && (
            <span className="ml-1 text-xs text-muted-foreground">{t.badge}</span>
          )}
        </TabsTrigger>
      ))}
    </TabsList>
  );
}

/**
 * Wrapper convenience: contiene el Tabs + MobileTabsSelector.
 * Útil para no tener que importar Tabs aparte.
 */
export function MobileFriendlyTabs({
  tabs,
  value,
  onValueChange,
  className,
  children,
}: MobileTabsSelectorProps & { children: ReactNode }) {
  return (
    <Tabs value={value} onValueChange={onValueChange} className={className}>
      <MobileTabsSelector tabs={tabs} value={value} onValueChange={onValueChange} />
      {children}
    </Tabs>
  );
}
