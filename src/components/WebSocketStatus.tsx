/**
 * Componente de visualización del estado WebSocket
 * Útil para debugging y monitoreo
 */

import { useEffect, useState } from 'react';
import { JarvisWebSocketClient } from '@/lib/websocket-client';
import { Activity, AlertCircle, CheckCircle2, Zap } from 'lucide-react';

export const WebSocketStatus = () => {
  const [state, setState] = useState({
    connected: false,
    authenticated: false,
    reconnectAttempts: 0,
    queuedMessages: 0,
    lastMessageTime: 0,
  });
  const [latency, setLatency] = useState<number | null>(null);

  useEffect(() => {
    const client = JarvisWebSocketClient.getInstance();

    const updateState = () => {
      setState(client.getState());
    };

    // Update inicial
    updateState();

    // Listeners
    const unsubConnection = client.onConnectionStateChange(() => {
      updateState();
    });

    const unsubLatency = client.onLatencyChange((lat) => {
      setLatency(lat);
      updateState();
    });

    // Poll estado
    const interval = setInterval(updateState, 1000);

    return () => {
      unsubConnection();
      unsubLatency();
      clearInterval(interval);
    };
  }, []);

  const isHealthy = state.connected && state.authenticated && (latency ? latency < 100 : true);
  const statusColor = state.connected ? 'text-green-500' : 'text-red-500';
  const statusBg = state.connected ? 'bg-green-50' : 'bg-red-50';

  return (
    <div className={`p-4 rounded-lg border ${statusBg}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {isHealthy ? (
            <CheckCircle2 className={`${statusColor} w-5 h-5`} />
          ) : state.connected ? (
            <Zap className="text-yellow-500 w-5 h-5" />
          ) : (
            <AlertCircle className="text-red-500 w-5 h-5" />
          )}
          <div>
            <div className="font-semibold">
              {state.connected ? 'WebSocket Connected' : 'WebSocket Disconnected'}
            </div>
            <div className="text-xs text-gray-600">
              Auth: {state.authenticated ? '✓' : '✗'} | 
              Latency: {latency ? `${latency}ms` : 'N/A'} |
              Queued: {state.queuedMessages}
            </div>
          </div>
        </div>
        <div className="text-right text-xs">
          {state.reconnectAttempts > 0 && (
            <div className="text-yellow-600">
              Reconnect attempts: {state.reconnectAttempts}
            </div>
          )}
        </div>
      </div>

      {state.queuedMessages > 0 && (
        <div className="mt-2 text-xs text-blue-600 flex items-center gap-1">
          <Activity className="w-3 h-3" />
          {state.queuedMessages} message(s) queued, will send when connected
        </div>
      )}
    </div>
  );
};
