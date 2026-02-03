
# Plan: Corregir OpenAI Realtime Voice

## Problema Detectado

Después de analizar el código y los logs:

1. La edge function `jarvis-voice` funciona correctamente - devuelve el token ephemeral
2. El flujo se detiene después de "requesting microphone access..." 
3. No hay logs adicionales que muestren si el WebRTC se establece
4. Faltan atributos críticos en el elemento audio para móviles iOS

## Cambios Necesarios

### 1. Mejorar el elemento audio para compatibilidad móvil

Agregar atributos necesarios para iOS/Safari:
- `playsInline` - Requerido en iOS
- `crossOrigin` para evitar problemas CORS
- Forzar la reproducción con un intento de play()

### 2. Añadir ICE servers para conexiones más robustas

RTCPeerConnection sin configuración puede fallar en redes restrictivas. Añadir servidores STUN públicos de Google.

### 3. Corregir el orden de establecimiento de estado

El estado `isActive` no debe establecerse hasta que la conexión esté realmente activa o durante el proceso de conexión, pero con manejo más robusto.

### 4. Mejorar el logging para depuración

Añadir más logs en puntos críticos para identificar dónde falla exactamente.

## Archivos a Modificar

| Archivo | Cambio |
|---------|--------|
| `src/hooks/useJarvisRealtime.tsx` | Añadir atributos audio iOS, ICE servers, mejor logging |

## Detalle Técnico

```typescript
// Cambios en useJarvisRealtime.tsx

// 1. RTCPeerConnection con ICE servers
const pc = new RTCPeerConnection({
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ]
});

// 2. Audio element con atributos iOS
const audioEl = document.createElement('audio');
audioEl.autoplay = true;
audioEl.playsInline = true;  // CRÍTICO para iOS
audioEl.setAttribute('playsinline', ''); // Algunos navegadores
audioEl.style.display = 'none';
document.body.appendChild(audioEl);

// 3. Forzar reproducción en ontrack
pc.ontrack = (event) => {
  console.log('[JARVIS] Received remote audio track');
  audioEl.srcObject = event.streams[0];
  // Forzar play para navegadores que lo requieren
  audioEl.play().catch(e => console.log('[JARVIS] Audio play warning:', e));
};

// 4. Log adicional para depuración
console.log('[JARVIS] PeerConnection created with ICE servers');
console.log('[JARVIS] Microphone tracks:', mediaStreamRef.current.getTracks().length);
```

## Resultado Esperado

- El flujo completo debería mostrar logs hasta "WebRTC connection established successfully!"
- La barra de estado PotusStatusBar debería aparecer mostrando "Escuchando..."
- El audio de JARVIS debería reproducirse en móviles iOS y Android
