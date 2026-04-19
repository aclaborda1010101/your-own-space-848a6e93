import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { SidebarNew } from "./SidebarNew";
import { TopBar } from "./TopBar";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

import { ForceRefreshButton } from "./ForceRefreshButton";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  
  // Don't show bottom nav on login page
  const isLoginPage = location.pathname === '/login';
  const isWizardPage = location.pathname.startsWith('/projects/wizard/');
  
  return (
    <div className="min-h-screen min-h-[100dvh] bg-background">
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
        {!isWizardPage && (
          <div className="hidden md:block">
            <TopBar onMenuClick={openSidebar} />
          </div>
        )}
        
        <main
          className={cn(
            // Safe area iOS: en móvil respeta la status bar (en desktop la TopBar ya gestiona)
            "pt-[env(safe-area-inset-top)] md:pt-0"
          )}
          style={
            !isWizardPage
              ? { paddingBottom: "calc(5rem + env(safe-area-inset-bottom))" }
              : undefined
          }
        >
          {children}
        </main>
      </div>
      
      {/* Bottom nav - hidden on login and wizard pages */}
      {!isLoginPage && !isWizardPage && (
        <BottomNavBar />
      )}

      <ForceRefreshButton />
    </div>
  );
};

export { AppLayout };
export default AppLayout;
