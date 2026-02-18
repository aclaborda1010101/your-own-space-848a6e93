import { useEffect, useCallback, useState, useRef } from 'react';
import { useAuth } from './useAuth';
import { JarvisWebSocketClient, WebSocketMessage, MessageHandler } from '@/lib/websocket-client';

/**
 * Hook para utilizar WebSocket en componentes React
 * Conecta automáticamente cuando hay sesión disponible
 * Desconecta al desmontar el componente
 */
export const useWebSocket = () => {
  const { session } = useAuth();
  const clientRef = useRef<JarvisWebSocketClient | null>(null);
  const [connected, setConnected] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [latency, setLatency] = useState<number | null>(null);
  const [queuedMessages, setQueuedMessages] = useState(0);

  // Inicializar cliente y conectar
  useEffect(() => {
    if (!session?.access_token) {
      console.log('[useWebSocket] No session, skipping connection');
      return;
    }

    const initWebSocket = async () => {
      try {
        const client = JarvisWebSocketClient.getInstance();
        clientRef.current = client;

        // Registrar listeners de estado
        const unsubscribeConnection = client.onConnectionStateChange((isConnected) => {
          setConnected(isConnected);
          const state = client.getState();
          setAuthenticated(state.authenticated);
          setQueuedMessages(state.queuedMessages);
          
          if (isConnected) {
            console.log('[useWebSocket] Connected ✓');
          } else {
            console.log('[useWebSocket] Disconnected');
          }
        });

        const unsubscribeLatency = client.onLatencyChange((lat) => {
          setLatency(lat);
          if (lat > 100) {
            console.warn(`[useWebSocket] High latency: ${lat}ms`);
          }
        });

        // Conectar
        try {
          await client.connect(session.access_token);
        } catch (err) {
          console.warn('[useWebSocket] Connection attempt failed (will retry):', err);
          // El cliente intentará reconectar automáticamente
        }

        // Cleanup
        return () => {
          unsubscribeConnection();
          unsubscribeLatency();
        };
      } catch (err) {
        console.error('[useWebSocket] Init error:', err);
      }
    };

    const cleanup = initWebSocket();

    return () => {
      cleanup?.then((fn) => fn?.());
    };
  }, [session?.access_token]);

  // Desconectar al desmontar
  useEffect(() => {
    return () => {
      // No desconectamos automáticamente porque el cliente es singleton
      // y otros componentes pueden estar usándolo
      console.log('[useWebSocket] Component unmounted');
    };
  }, []);

  /**
   * Enviar tarea
   */
  const sendTask = useCallback(
    (task: Record<string, any>) => {
      if (clientRef.current) {
        clientRef.current.sendTask(task);
      } else {
        console.warn('[useWebSocket] Client not initialized');
      }
    },
    []
  );

  /**
   * Enviar respuesta
   */
  const sendResponse = useCallback(
    (taskId: string, result: Record<string, any>) => {
      if (clientRef.current) {
        clientRef.current.sendResponse(taskId, result);
      } else {
        console.warn('[useWebSocket] Client not initialized');
      }
    },
    []
  );

  /**
   * Registrar handler para tipo de mensaje
   */
  const on = useCallback(
    (type: string, handler: MessageHandler) => {
      if (clientRef.current) {
        clientRef.current.registerMessageHandler(type, handler);
      }
    },
    []
  );

  /**
   * Enviar mensaje genérico
   */
  const send = useCallback(
    (message: WebSocketMessage) => {
      if (clientRef.current) {
        clientRef.current.send(message);
      } else {
        console.warn('[useWebSocket] Client not initialized');
      }
    },
    []
  );

  /**
   * Obtener cliente (para casos avanzados)
   */
  const getClient = useCallback(
    () => clientRef.current || JarvisWebSocketClient.getInstance(),
    []
  );

  return {
    connected,
    authenticated,
    latency,
    queuedMessages,
    sendTask,
    sendResponse,
    on,
    send,
    getClient,
    isReady: connected && authenticated,
  };
};

/**
 * Hook para escuchar mensajes de tipo específico
 */
export const useWebSocketMessage = (
  type: string,
  callback: (message: WebSocketMessage) => void
) => {
  const { on } = useWebSocket();

  useEffect(() => {
    on(type, callback);
  }, [type, callback, on]);
};
