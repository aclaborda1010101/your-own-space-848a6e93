import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { SidebarNew } from "./SidebarNew";
import { TopBar } from "./TopBar";
import { PotusStatusBar } from "@/components/voice/PotusStatusBar";
import { useJarvisHybrid } from "@/hooks/useJarvisHybrid";
import { useSidebarState } from "@/hooks/useSidebarState";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isActive, state, transcript, response, toggleSession, stopRecording } = useJarvisHybrid();
  const { isOpen: sidebarOpen, isCollapsed: sidebarCollapsed, open: openSidebar, close: closeSidebar, toggleCollapse: toggleSidebarCollapse } = useSidebarState();
  
  // Don't show bottom nav on login page
  const isLoginPage = location.pathname === '/login';
  
  // Map realtime state to status bar state
  const statusState = state === 'processing' ? 'processing' : 
                      state === 'listening' ? 'listening' :
                      state === 'speaking' ? 'speaking' : 'idle';
  
  // Show response when speaking, transcript when listening
  const displayText = state === 'speaking' && response ? response : transcript;
  
  return (
    <div className="min-h-screen bg-background">
      {/* JARVIS Status Bar - non-blocking, appears at top */}
      {isActive && (
        <PotusStatusBar 
          state={statusState} 
          transcript={displayText}
          audioLevel={state === 'listening' ? 0.5 : 0}
          onClose={stopRecording} 
        />
      )}
      
      {/* Sidebar - always visible */}
      <SidebarNew 
        isOpen={sidebarOpen} 
        onClose={closeSidebar}
        isCollapsed={sidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />
      
      {/* Main content area with sidebar offset */}
      <div className={cn(
        "transition-all duration-300",
        sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
      )}>
        <TopBar onMenuClick={openSidebar} />
        
        <main className={cn(
          "pb-20 lg:pb-0",
          isActive && "pt-14"
        )}>
          {children}
        </main>
      </div>
      
      {/* Bottom nav - always visible on mobile */}
      {!isLoginPage && (
        <BottomNavBar 
          onJarvisPress={toggleSession}
          isJarvisActive={isActive}
        />
      )}
    </div>
  );
};
