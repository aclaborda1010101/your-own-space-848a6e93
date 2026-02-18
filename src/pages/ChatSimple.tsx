/**
 * ChatSimple - Simplified real-time chat for testing
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:37 GMT+1
 * 
 * Test page - can be accessed at /chat-simple
 */

import { useAuth } from '@/hooks/useAuth';
import { ChatBox } from '@/components/ChatBox';

export default function ChatSimple() {
  const { user } = useAuth();

  return (
    <div className="h-[calc(100vh-4rem)] overflow-hidden">
      <ChatBox userId={user?.id} className="h-full" />
    </div>
  );
}
