/**
 * WebSocket Client para Jarvis App
 * Conecta a Gateway POTUS (ws://192.168.1.10:18789/jarvis-app)
 * Con auto-reconnect y exponential backoff
 */

export interface WebSocketMessage {
  type: 'task' | 'response' | 'status' | 'ping' | 'pong' | 'auth' | 'error';
  payload?: Record<string, any>;
  id?: string;
  timestamp?: number;
}

export type MessageHandler = (message: WebSocketMessage) => void;

interface ReconnectConfig {
  maxAttempts: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

const DEFAULT_RECONNECT_CONFIG: ReconnectConfig = {
  maxAttempts: 10,
  initialDelay: 1000, // 1 segundo
  maxDelay: 30000, // 30 segundos
  backoffMultiplier: 1.5,
};

export class JarvisWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private jwtToken: string | null = null;
  private messageHandlers: Map<string, MessageHandler> = new Map();
  private reconnectAttempts = 0;
  private reconnectConfig: ReconnectConfig;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private isIntentionallyClosed = false;
  private messageQueue: WebSocketMessage[] = [];
  private isAuthenticated = false;
  private lastMessageTime = Date.now();
  private connectionStartTime = 0;

  // Eventos para observabilidad
  private connectionStateListeners: ((connected: boolean) => void)[] = [];
  private latencyListeners: ((latency: number) => void)[] = [];

  constructor(url: string = 'ws://192.168.1.10:19000/jarvis-app') {
    this.url = url;
    this.reconnectConfig = { ...DEFAULT_RECONNECT_CONFIG };
    
    // Handler por defecto para todas las mensajes
    this.registerMessageHandler('default', (msg) => {
      console.log('[JARVIS WebSocket] Message:', msg);
    });
  }

  /**
   * Conectar al WebSocket con JWT token
   */
  async connect(jwtToken: string): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log('[JARVIS WebSocket] Already connected');
      return;
    }

    this.jwtToken = jwtToken;
    this.isIntentionallyClosed = false;
    this.reconnectAttempts = 0;

    return this._connect();
  }

  /**
   * Conexión privada con retry logic
   */
  private _connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.connectionStartTime = Date.now();
        console.log(
          `[JARVIS WebSocket] Connecting (attempt ${this.reconnectAttempts + 1}/${this.reconnectConfig.maxAttempts})...`
        );

        this.ws = new WebSocket(this.url);
        this.ws.binaryType = 'arraybuffer';

        const connectTimeout = setTimeout(() => {
          if (this.ws?.readyState !== WebSocket.OPEN) {
            this.ws?.close();
            this.handleConnectionError('Connection timeout');
            reject(new Error('Connection timeout'));
          }
        }, 5000); // Timeout 5s

        this.ws.onopen = () => {
          clearTimeout(connectTimeout);
          console.log('[JARVIS WebSocket] Connected. Authenticating...');
          
          // Enviar autenticación
          if (this.jwtToken) {
            this.send({
              type: 'auth',
              payload: {
                token: this.jwtToken,
                client: 'jarvis-app',
              },
            });
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            this.lastMessageTime = Date.now();

            // Calcular latencia si es respuesta a ping
            if (message.type === 'pong' && message.id === 'ping-probe') {
              const latency = Date.now() - this.connectionStartTime;
              this.notifyLatency(latency);
              console.log(`[JARVIS WebSocket] Latency: ${latency}ms`);
            }

            // Manejar autenticación
            if (message.type === 'auth') {
              if (message.payload?.authenticated) {
                this.isAuthenticated = true;
                console.log('[JARVIS WebSocket] Authenticated ✓');
                this.reconnectAttempts = 0;
                this.flushMessageQueue();
                this.notifyConnectionState(true);
                this.startPingProbe();
                resolve();
              } else {
                throw new Error('Authentication failed');
              }
            }

            // Manejar mensajes por tipo
            if (message.type === 'task') {
              console.log('[JARVIS WebSocket] Task received:', message.payload);
              this.callMessageHandler('task', message);
            } else if (message.type === 'response') {
              console.log('[JARVIS WebSocket] Response received:', message.id);
              this.callMessageHandler('response', message);
            } else if (message.type === 'status') {
              console.log('[JARVIS WebSocket] Status update:', message.payload);
              this.callMessageHandler('status', message);
            } else if (message.type !== 'pong') {
              this.callMessageHandler('default', message);
            }
          } catch (err) {
            console.error('[JARVIS WebSocket] Parse error:', err);
          }
        };

        this.ws.onerror = (event) => {
          console.error('[JARVIS WebSocket] Error:', event);
          this.handleConnectionError(event.type);
          reject(new Error(`WebSocket error: ${event.type}`));
        };

        this.ws.onclose = () => {
          clearTimeout(connectTimeout);
          console.log('[JARVIS WebSocket] Disconnected');
          this.isAuthenticated = false;
          this.notifyConnectionState(false);
          this.stopPingProbe();

          if (!this.isIntentionallyClosed) {
            this.scheduleReconnect();
          }
        };
      } catch (err) {
        console.error('[JARVIS WebSocket] Connection error:', err);
        this.handleConnectionError(String(err));
        reject(err);
      }
    });
  }

  /**
   * Enviar mensaje al servidor
   */
  send(message: WebSocketMessage): void {
    // Agregar timestamp si no existe
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    // Generar ID si no existe
    if (!message.id) {
      message.id = `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    if (this.ws?.readyState === WebSocket.OPEN && this.isAuthenticated) {
      try {
        this.ws.send(JSON.stringify(message));
        console.log(`[JARVIS WebSocket] Sent: ${message.type}`, message.id);
      } catch (err) {
        console.error('[JARVIS WebSocket] Send error:', err);
        this.messageQueue.push(message);
      }
    } else {
      console.log(
        `[JARVIS WebSocket] Queued message (not connected): ${message.type}`
      );
      this.messageQueue.push(message);
    }
  }

  /**
   * Enviar tarea al servidor
   */
  sendTask(task: Record<string, any>): void {
    this.send({
      type: 'task',
      payload: task,
    });
  }

  /**
   * Enviar respuesta al servidor
   */
  sendResponse(taskId: string, result: Record<string, any>): void {
    this.send({
      type: 'response',
      id: taskId,
      payload: result,
    });
  }

  /**
   * Registrar handler para tipos de mensaje específicos
   */
  registerMessageHandler(type: string, handler: MessageHandler): void {
    this.messageHandlers.set(type, handler);
  }

  /**
   * Llamar handler registrado
   */
  private callMessageHandler(type: string, message: WebSocketMessage): void {
    const handler = this.messageHandlers.get(type) || this.messageHandlers.get('default');
    if (handler) {
      try {
        handler(message);
      } catch (err) {
        console.error(`[JARVIS WebSocket] Handler error for ${type}:`, err);
      }
    }
  }

  /**
   * Desconectar intencionalmente
   */
  disconnect(): void {
    this.isIntentionallyClosed = true;
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.stopPingProbe();
    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.notifyConnectionState(false);
  }

  /**
   * Manejar error de conexión con retry
   */
  private handleConnectionError(error: string): void {
    console.error(`[JARVIS WebSocket] Connection error: ${error}`);
    this.isAuthenticated = false;
    this.notifyConnectionState(false);

    if (!this.isIntentionallyClosed) {
      this.scheduleReconnect();
    }
  }

  /**
   * Programar reconexión con exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.reconnectConfig.maxAttempts) {
      console.error('[JARVIS WebSocket] Max reconnection attempts reached. Falling back to Supabase.');
      return;
    }

    const delay = Math.min(
      this.reconnectConfig.initialDelay *
        Math.pow(this.reconnectConfig.backoffMultiplier, this.reconnectAttempts),
      this.reconnectConfig.maxDelay
    );

    this.reconnectAttempts++;

    console.log(`[JARVIS WebSocket] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }

    this.reconnectTimeout = setTimeout(() => {
      this._connect().catch((err) => {
        console.error('[JARVIS WebSocket] Reconnection failed:', err);
      });
    }, delay);
  }

  /**
   * Enviar cola de mensajes pendientes
   */
  private flushMessageQueue(): void {
    if (this.messageQueue.length === 0) return;

    console.log(
      `[JARVIS WebSocket] Flushing ${this.messageQueue.length} queued messages`
    );

    const queue = this.messageQueue;
    this.messageQueue = [];

    queue.forEach((msg) => {
      this.send(msg);
    });
  }

  /**
   * Sonda de latencia: enviar ping periódico
   */
  private startPingProbe(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
    }

    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({
          type: 'ping',
          id: 'ping-probe',
        });
      }
    }, 30000); // Cada 30 segundos
  }

  /**
   * Detener sonda de latencia
   */
  private stopPingProbe(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  /**
   * Registrar listener de estado de conexión
   */
  onConnectionStateChange(listener: (connected: boolean) => void): () => void {
    this.connectionStateListeners.push(listener);
    return () => {
      const idx = this.connectionStateListeners.indexOf(listener);
      if (idx > -1) {
        this.connectionStateListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Registrar listener de latencia
   */
  onLatencyChange(listener: (latency: number) => void): () => void {
    this.latencyListeners.push(listener);
    return () => {
      const idx = this.latencyListeners.indexOf(listener);
      if (idx > -1) {
        this.latencyListeners.splice(idx, 1);
      }
    };
  }

  /**
   * Notificar cambio de estado de conexión
   */
  private notifyConnectionState(connected: boolean): void {
    this.connectionStateListeners.forEach((listener) => {
      try {
        listener(connected);
      } catch (err) {
        console.error('[JARVIS WebSocket] Listener error:', err);
      }
    });
  }

  /**
   * Notificar latencia
   */
  private notifyLatency(latency: number): void {
    this.latencyListeners.forEach((listener) => {
      try {
        listener(latency);
      } catch (err) {
        console.error('[JARVIS WebSocket] Latency listener error:', err);
      }
    });
  }

  /**
   * Obtener estado actual
   */
  getState() {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
      queuedMessages: this.messageQueue.length,
      lastMessageTime: this.lastMessageTime,
    };
  }

  /**
   * Obtener instancia singleton (global)
   */
  static getInstance(): JarvisWebSocketClient {
    if (!globalThis.__jarvisWebSocketClient) {
      globalThis.__jarvisWebSocketClient = new JarvisWebSocketClient();
    }
    return globalThis.__jarvisWebSocketClient;
  }
}

// Declarar tipo global
declare global {
  var __jarvisWebSocketClient: JarvisWebSocketClient | undefined;
}
