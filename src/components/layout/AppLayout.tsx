import { ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BottomNavBar } from "./BottomNavBar";
import { PotusStatusBar } from "@/components/voice/PotusStatusBar";
import { useJarvisHybrid } from "@/hooks/useJarvisHybrid";
import { cn } from "@/lib/utils";

interface AppLayoutProps {
  children: ReactNode;
  showBackButton?: boolean;
}

export const AppLayout = ({ children, showBackButton = false }: AppLayoutProps) => {
  const location = useLocation();
  const { isActive, state, transcript, response, toggleSession, stopRecording } = useJarvisHybrid();
  
  // Don't show bottom nav on login page
  const isLoginPage = location.pathname === '/login';
  
  // Map realtime state to status bar state
  const statusState = state === 'connecting' ? 'processing' : 
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
          onClose={stopSession} 
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
          onJarvisPress={toggleSession}
          isJarvisActive={isActive}
        />
      )}
    </div>
  );
};
