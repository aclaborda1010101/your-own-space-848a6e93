import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { PotusStatusBar } from "@/components/voice/PotusStatusBar";
import { usePotusVoice } from "@/hooks/usePotusVoice";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isActive, state, transcript, audioLevel, toggle, stop } = usePotusVoice();
  
  // Don't show bottom nav on login page
  const isLoginPage = location.pathname === '/login';
  
  return (
    <div className="min-h-screen bg-background">
      {/* JARVIS Status Bar - non-blocking, appears at top */}
      {isActive && (
        <PotusStatusBar 
          state={state} 
          transcript={transcript}
          audioLevel={audioLevel}
          onClose={stop} 
        />
      )}
      
      {/* Main content with padding for nav bars */}
      <main className={cn(
        "pb-20 lg:pb-0",
        isActive && "pt-14" // Add padding when status bar is visible
      )}>
        {children}
      </main>
      
      {/* Bottom nav - always visible on mobile */}
      {!isLoginPage && (
        <BottomNavBar 
          onJarvisPress={toggle}
          isJarvisActive={isActive}
        />
      )}
    </div>
  );
};
