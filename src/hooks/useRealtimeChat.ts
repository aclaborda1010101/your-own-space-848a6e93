/**
 * useRealtimeChat - Real-time chat with Supabase Realtime
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:33 GMT+1
 */

import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
  metadata?: {
    source?: 'text' | 'voice';
    audio_url?: string;
  };
}

export interface UseRealtimeChatReturn {
  messages: ChatMessage[];
  loading: boolean;
  error: string | null;
  sendMessage: (content: string) => Promise<void>;
  isTyping: boolean;
}

export function useRealtimeChat(userId?: string): UseRealtimeChatReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isTyping, setIsTyping] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!userId) {
      setError('No user ID provided');
      setLoading(false);
      return;
    }

    // Fetch initial messages
    async function fetchMessages() {
      try {
        const { data, error: fetchError } = await supabase
          .from('conversation_history')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: true })
          .limit(100);

        if (fetchError) throw fetchError;

        setMessages(data || []);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching messages:', err);
        setError(err instanceof Error ? err.message : 'Failed to fetch messages');
        setLoading(false);
      }
    }

    fetchMessages();

    // Subscribe to real-time updates
    const channel = supabase
      .channel('conversation-changes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'conversation_history',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const newMessage = payload.new as ChatMessage;
          setMessages((prev) => [...prev, newMessage]);

          // Stop typing indicator when assistant responds
          if (newMessage.role === 'assistant') {
            setIsTyping(false);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    // Cleanup
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [userId]);

  const sendMessage = async (content: string) => {
    if (!userId || !content.trim()) return;

    setIsTyping(true);
    setError(null);

    try {
      const { error: insertError } = await supabase
        .from('conversation_history')
        .insert({
          user_id: userId,
          role: 'user',
          content: content.trim(),
          metadata: { source: 'text' },
        });

      if (insertError) throw insertError;

      // Note: message will appear via Realtime subscription
    } catch (err) {
      console.error('Error sending message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');
      setIsTyping(false);
    }
  };

  return {
    messages,
    loading,
    error,
    sendMessage,
    isTyping,
  };
}
