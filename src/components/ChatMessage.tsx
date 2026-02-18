/**
 * ChatMessage - Individual message component
 * JARVIS APP - Real-time Communication Implementation
 * Created: 2026-02-18 05:34 GMT+1
 */

import { formatDistance } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import type { ChatMessage as ChatMessageType } from '@/hooks/useRealtimeChat';

interface ChatMessageProps {
  message: ChatMessageType;
  isOwnMessage: boolean;
}

export function ChatMessage({ message, isOwnMessage }: ChatMessageProps) {
  const timeAgo = formatDistance(new Date(message.created_at), new Date(), {
    addSuffix: true,
    locale: es,
  });

  const isVoiceMessage = message.metadata?.source === 'voice';

  return (
    <div
      className={cn(
        'flex gap-3 mb-4 animate-in fade-in slide-in-from-bottom-2',
        isOwnMessage ? 'flex-row-reverse' : 'flex-row'
      )}
    >
      {/* Avatar */}
      <Avatar className="h-8 w-8 mt-1">
        <AvatarImage
          src={isOwnMessage ? undefined : '/jarvis-avatar.png'}
          alt={isOwnMessage ? 'User' : 'JARVIS'}
        />
        <AvatarFallback className={isOwnMessage ? 'bg-primary' : 'bg-accent'}>
          {isOwnMessage ? 'U' : 'J'}
        </AvatarFallback>
      </Avatar>

      {/* Message Content */}
      <div
        className={cn(
          'flex flex-col max-w-[70%]',
          isOwnMessage ? 'items-end' : 'items-start'
        )}
      >
        {/* Bubble */}
        <div
          className={cn(
            'rounded-2xl px-4 py-2 shadow-sm',
            isOwnMessage
              ? 'bg-primary text-primary-foreground rounded-tr-none'
              : 'bg-muted rounded-tl-none'
          )}
        >
          {/* Voice indicator */}
          {isVoiceMessage && (
            <div className="flex items-center gap-2 mb-1 text-xs opacity-70">
              <svg
                className="h-3 w-3"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
              <span>Mensaje de voz</span>
            </div>
          )}

          {/* Text content */}
          <p className="text-sm whitespace-pre-wrap break-words">
            {message.content}
          </p>
        </div>

        {/* Timestamp */}
        <span className="text-xs text-muted-foreground mt-1 px-2">
          {timeAgo}
        </span>
      </div>
    </div>
  );
}
