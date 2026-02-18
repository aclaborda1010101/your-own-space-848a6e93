/**
 * Componente de Debug para WebSocket
 * Muestra mensajes en tiempo real que llegan vía WebSocket
 */

import { useState, useEffect } from 'react';
import { JarvisWebSocketClient, WebSocketMessage } from '@/lib/websocket-client';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Trash2, Copy } from 'lucide-react';

export const WebSocketDebug = () => {
  const [messages, setMessages] = useState<WebSocketMessage[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);

  useEffect(() => {
    const client = JarvisWebSocketClient.getInstance();

    // Registrar todas las recepciones
    const handleAllMessages = (msg: WebSocketMessage) => {
      setMessages((prev) => [
        { ...msg, timestamp: msg.timestamp || Date.now() },
        ...prev.slice(0, 99), // Mantener últimos 100 mensajes
      ]);
    };

    client.registerMessageHandler('task', handleAllMessages);
    client.registerMessageHandler('response', handleAllMessages);
    client.registerMessageHandler('status', handleAllMessages);
    client.registerMessageHandler('default', handleAllMessages);

    // Escuchar custom events
    const handleCustomEvent = (e: CustomEvent) => {
      setMessages((prev) => [
        {
          type: (e.type.split(':')[1] as any) || 'custom',
          payload: e.detail,
          timestamp: Date.now(),
        },
        ...prev.slice(0, 99),
      ]);
    };

    window.addEventListener('jarvis:task', handleCustomEvent as any);
    window.addEventListener('jarvis:response', handleCustomEvent as any);
    window.addEventListener('jarvis:status', handleCustomEvent as any);

    return () => {
      window.removeEventListener('jarvis:task', handleCustomEvent as any);
      window.removeEventListener('jarvis:response', handleCustomEvent as any);
      window.removeEventListener('jarvis:status', handleCustomEvent as any);
    };
  }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold">WebSocket Debug Console</h3>
          <p className="text-xs text-gray-500">
            {messages.length} message(s) received
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={autoScroll}
              onChange={(e) => setAutoScroll(e.target.checked)}
            />
            Auto scroll
          </label>
          <button
            onClick={() => setMessages([])}
            className="p-1 hover:bg-gray-100 rounded"
            title="Clear messages"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      <ScrollArea className="h-96 border rounded bg-black text-white font-mono text-xs p-3">
        {messages.length === 0 ? (
          <div className="text-gray-500 text-center py-8">
            Esperando mensajes WebSocket...
          </div>
        ) : (
          <div className="space-y-2">
            {messages.map((msg, idx) => {
              const time = new Date(msg.timestamp || 0).toLocaleTimeString();
              return (
                <div key={idx} className="border-b border-gray-700 pb-2 last:border-0">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <span className="text-gray-400">{time}</span>
                      <span className="ml-2 font-semibold text-blue-400">
                        {msg.type}
                      </span>
                      {msg.id && (
                        <span className="ml-2 text-gray-500">#{msg.id.slice(0, 8)}</span>
                      )}
                    </div>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(JSON.stringify(msg, null, 2));
                      }}
                      className="p-1 hover:bg-gray-700 rounded text-xs"
                      title="Copy message"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>

                  {msg.payload && (
                    <div className="mt-1 text-gray-300 bg-gray-900 p-2 rounded text-xs overflow-x-auto">
                      <pre>{JSON.stringify(msg.payload, null, 2)}</pre>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>

      <div className="mt-2 text-xs text-gray-600">
        💡 Abre la consola del navegador (F12) para ver logs detallados:
        <code className="bg-gray-100 px-2 py-1 rounded ml-1">
          [JARVIS WebSocket]
        </code>
      </div>
    </Card>
  );
};
