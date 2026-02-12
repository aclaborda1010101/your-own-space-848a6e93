import { ReactNode, useState } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { SidebarNew } from "./SidebarNew";
import { TopBar } from "./TopBar";
import { PotusStatusBar } from "@/components/voice/PotusStatusBar";
import { useJarvisHybrid } from "@/hooks/useJarvisHybrid";
import { cn } from "@/lib/utils";
import { useSidebarState } from "@/hooks/useSidebarState";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isActive, state, transcript, response, toggleSession, stopRecording } = useJarvisHybrid();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const { isCollapsed, toggleCollapse } = useSidebarState();
  
  const isLoginPage = location.pathname === '/login';
  
  const statusState = state === 'processing' ? 'processing' : 
                      state === 'listening' ? 'listening' :
                      state === 'speaking' ? 'speaking' : 'idle';
  
  const displayText = state === 'speaking' && response ? response : transcript;
  
  return (
    <div className="min-h-screen bg-background">
      {/* JARVIS Status Bar */}
      {isActive && (
        <PotusStatusBar 
          state={statusState} 
          transcript={displayText}
          audioLevel={state === 'listening' ? 0.5 : 0}
          onClose={stopRecording} 
        />
      )}

      {/* Sidebar - desktop always visible, mobile togglable */}
      {!isLoginPage && (
        <SidebarNew
          isOpen={isMobileOpen}
          onClose={() => setIsMobileOpen(false)}
          isCollapsed={isCollapsed}
          onToggleCollapse={toggleCollapse}
        />
      )}
      
      {/* Main content */}
      <div className={cn(
        "pb-20 lg:pb-0 transition-all duration-300",
        !isLoginPage && (isCollapsed ? "lg:ml-20" : "lg:ml-72"),
        isActive && "pt-14"
      )}>
        {!isLoginPage && (
          <TopBar onMenuClick={() => setIsMobileOpen(true)} />
        )}
        <main>
          {children}
        </main>
      </div>
      
      {/* Bottom nav - mobile only */}
      {!isLoginPage && (
        <BottomNavBar 
          onJarvisPress={toggleSession}
          isJarvisActive={isActive}
          onMenuPress={() => setIsMobileOpen(true)}
        />
      )}
    </div>
  );
};
