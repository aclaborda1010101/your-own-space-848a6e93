import { Briefcase, Heart, Wallet, Activity, Users } from "lucide-react";

const typeConfig = {
  work: { label: 'Trabajo', icon: Briefcase, bgClass: 'bg-blue-500' },
  life: { label: 'Vida', icon: Heart, bgClass: 'bg-emerald-500' },
  finance: { label: 'Finanzas', icon: Wallet, bgClass: 'bg-amber-500' },
  health: { label: 'Salud', icon: Activity, bgClass: 'bg-rose-500' },
  family: { label: 'Familia', icon: Users, bgClass: 'bg-violet-500' },
};

export function CalendarLegend() {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3 py-2 bg-muted/50 rounded-lg border">
      {Object.entries(typeConfig).map(([key, config]) => {
        const Icon = config.icon;
        return (
          <div key={key} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded-full ${config.bgClass}`} />
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{config.label}</span>
          </div>
        );
      })}
    </div>
  );
}
