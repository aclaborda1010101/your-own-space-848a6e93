/**
 * Componente que inicializa y gestiona el WebSocket globalmente
 * Se coloca dentro de AuthProvider para tener acceso al session
 */

import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { JarvisWebSocketClient } from '@/lib/websocket-client';

export const WebSocketInitializer = ({ children }: { children: React.ReactNode }) => {
  const { session, user } = useAuth();

  useEffect(() => {
    if (!session?.access_token || !user) {
      console.log('[WebSocketInitializer] No authenticated session, skipping WebSocket init');
      return;
    }

    const initWebSocket = async () => {
      try {
        const client = JarvisWebSocketClient.getInstance();
        const state = client.getState();

        // Si ya está conectado, no hacer nada
        if (state.connected && state.authenticated) {
          console.log('[WebSocketInitializer] WebSocket already connected');
          return;
        }

        // Conectar
        console.log('[WebSocketInitializer] Initializing WebSocket for user:', user.email);
        await client.connect(session.access_token);

        // Registrar handlers globales
        client.registerMessageHandler('task', (msg) => {
          console.log('[WebSocket Global] Task:', msg.payload);
          // Dispatch custom event para que componentes puedan escuchar
          window.dispatchEvent(
            new CustomEvent('jarvis:task', { detail: msg.payload })
          );
        });

        client.registerMessageHandler('response', (msg) => {
          console.log('[WebSocket Global] Response:', msg.id);
          window.dispatchEvent(
            new CustomEvent('jarvis:response', { detail: msg })
          );
        });

        client.registerMessageHandler('status', (msg) => {
          console.log('[WebSocket Global] Status:', msg.payload);
          window.dispatchEvent(
            new CustomEvent('jarvis:status', { detail: msg.payload })
          );
        });

        console.log('[WebSocketInitializer] WebSocket initialized ✓');
      } catch (err) {
        console.error('[WebSocketInitializer] Error:', err);
        // El cliente intentará reconectar automáticamente
      }
    };

    initWebSocket();
  }, [session?.access_token, user?.id]);

  return <>{children}</>;
};
