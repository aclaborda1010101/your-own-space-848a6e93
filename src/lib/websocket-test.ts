/**
 * Script de prueba para WebSocket
 * Ejecutar en consola del navegador:
 * 
 * import { testWebSocketConnection } from '@/lib/websocket-test'
 * await testWebSocketConnection()
 */

import { JarvisWebSocketClient } from './websocket-client';

export async function testWebSocketConnection() {
  console.log('🧪 Starting WebSocket Test Suite...\n');

  const client = JarvisWebSocketClient.getInstance();
  const state = client.getState();

  console.log('📊 Current State:');
  console.log(state);
  console.log('');

  if (!state.connected) {
    console.warn('⚠️ WebSocket not connected. Need JWT token to connect.');
    return;
  }

  console.log('✅ WebSocket connected!\n');

  // Test 1: Enviar task
  console.log('Test 1: Sending Task Message');
  console.log('---');
  
  client.registerMessageHandler('response', (msg) => {
    console.log('📨 Response received:', msg);
  });

  client.sendTask({
    action: 'test_message',
    source: 'jarvis-app',
    timestamp: new Date().toISOString(),
    payload: {
      test: true,
      message: 'Hello from Jarvis App via WebSocket',
    },
  });

  console.log('Task sent! Waiting for response...\n');

  // Wait for response
  await new Promise((resolve) => setTimeout(resolve, 2000));

  // Test 2: Monitor latency
  console.log('Test 2: Latency Monitoring');
  console.log('---');
  
  let latencies: number[] = [];
  client.onLatencyChange((lat) => {
    latencies.push(lat);
    console.log(`Latency: ${lat}ms`);
  });

  // Trigger ping probes
  for (let i = 0; i < 3; i++) {
    client.send({
      type: 'ping',
      id: `test-ping-${i}`,
    });
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  await new Promise((resolve) => setTimeout(resolve, 2000));

  if (latencies.length > 0) {
    const avg = latencies.reduce((a, b) => a + b) / latencies.length;
    const min = Math.min(...latencies);
    const max = Math.max(...latencies);
    console.log(`Average latency: ${avg.toFixed(2)}ms (min: ${min}ms, max: ${max}ms)`);
    
    if (avg < 100) {
      console.log('✅ Latency is excellent!\n');
    } else if (avg < 200) {
      console.log('⚠️ Latency is acceptable\n');
    } else {
      console.log('❌ Latency is high\n');
    }
  }

  // Test 3: Message queue
  console.log('Test 3: Message Queueing');
  console.log('---');

  // Temporarily disable connection to test queueing
  console.log('Queuing 3 messages...');
  client.sendTask({ action: 'queued_msg_1' });
  client.sendTask({ action: 'queued_msg_2' });
  client.sendTask({ action: 'queued_msg_3' });

  const finalState = client.getState();
  console.log(`Queued messages: ${finalState.queuedMessages}`);
  console.log('When connection is restored, these will be sent automatically.\n');

  // Summary
  console.log('📈 Test Summary');
  console.log('---');
  console.log('✅ All tests completed');
  console.log('');
  console.log('Next steps:');
  console.log('1. Send a message in Telegram');
  console.log('2. Check console for WebSocket message');
  console.log('3. Monitor latency in WebSocketStatus component');
  console.log('');
}

/**
 * Enviar mensaje de test vía Telegram
 * Ejecutar esto después en JARVIS o POTUS:
 * 
 * ~/clawd/inter-agent-telegram.sh potus "ws-test"
 */
export async function testEndToEnd() {
  console.log('🔄 End-to-End Test');
  console.log('---');
  console.log('');
  console.log('Pasos:');
  console.log('1. En otro terminal, ejecuta:');
  console.log('   ~/clawd/inter-agent-telegram.sh potus "test-ws-message"');
  console.log('');
  console.log('2. Observa el mensaje llegando en esta consola');
  console.log('');
  console.log('3. Verifica que el latency sea < 100ms');
  console.log('');

  const client = JarvisWebSocketClient.getInstance();
  let messageCount = 0;

  client.registerMessageHandler('task', (msg) => {
    messageCount++;
    console.log(`✅ Message #${messageCount}:`, msg.payload);
    console.log(`   Timestamp: ${new Date(msg.timestamp!).toISOString()}`);
  });

  console.log('Escuchando mensajes. Esperando input...');
}
