import { Menu, Bell, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopBarProps {
  onMenuClick: () => void;
}

export const TopBar = ({ onMenuClick }: TopBarProps) => {
  const now = new Date();
  const greeting = now.getHours() < 12 ? "Buenos días" : now.getHours() < 20 ? "Buenas tardes" : "Buenas noches";

  return (
    <header className="h-16 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-30">
      <div className="h-full flex items-center justify-between px-4 lg:px-6">
        {/* Left */}
        <div className="flex items-center gap-4">
          <button 
            onClick={onMenuClick}
            className="lg:hidden p-2 rounded-lg hover:bg-secondary text-muted-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          
          <div>
            <p className="text-sm text-muted-foreground">{greeting}</p>
            <h2 className="text-lg font-semibold text-foreground">
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
            </h2>
          </div>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Search className="w-5 h-5" />
          </Button>
          
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-primary rounded-full" />
          </Button>
        </div>
      </div>
    </header>
  );
};
