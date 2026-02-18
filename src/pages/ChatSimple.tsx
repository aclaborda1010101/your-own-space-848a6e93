/**
 * ChatSimple - Simplified real-time chat for testing
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:37 GMT+1
 * 
 * Test page - can be accessed at /chat-simple
 */

import { SidebarNew } from '@/components/layout/SidebarNew';
import { TopBar } from '@/components/layout/TopBar';
import { useSidebarState } from '@/hooks/useSidebarState';
import { useAuth } from '@/hooks/useAuth';
import { ChatBox } from '@/components/ChatBox';

export default function ChatSimple() {
  const { sidebarOpen, setSidebarOpen } = useSidebarState();
  const { user } = useAuth();

  return (
    <div className="flex h-screen bg-background">
      <SidebarNew sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex flex-col flex-1 overflow-hidden">
        <TopBar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <div className="flex-1 overflow-hidden">
          <ChatBox userId={user?.id} className="h-full" />
        </div>
      </div>
    </div>
  );
}
