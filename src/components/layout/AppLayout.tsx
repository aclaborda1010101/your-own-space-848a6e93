import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { SidebarNew } from "./SidebarNew";
import { TopBar } from "./TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";
import { PotusFloatingChat } from "@/components/potus/PotusFloatingChat";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  
  // Don't show bottom nav on login page
  const isLoginPage = location.pathname === '/login';
  const isWizardPage = location.pathname.startsWith('/projects/wizard/');
  
  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar - hidden on wizard pages */}
      {!isWizardPage && (
        <SidebarNew 
          isOpen={sidebarOpen} 
          onClose={closeSidebar}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={toggleSidebarCollapse}
        />
      )}
      
      {/* Main content area */}
      <div className={cn(
        "transition-all duration-300",
        !isWizardPage && (sidebarCollapsed ? "lg:pl-20" : "lg:pl-72")
      )}>
        {!isWizardPage && <TopBar onMenuClick={openSidebar} />}
        
        <main className={cn(
          !isWizardPage && "pb-20 lg:pb-0"
        )}>
          {children}
        </main>
      </div>
      
      {/* Bottom nav - hidden on login and wizard pages */}
      {!isLoginPage && !isWizardPage && (
        <BottomNavBar />
      )}

      {!isLoginPage && !isWizardPage && <PotusFloatingChat />}
    </div>
  );
};
