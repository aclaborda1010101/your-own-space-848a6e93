
# Unificar Voz en Botón JARVIS de Barra Inferior

## Resumen

Consolidar toda la funcionalidad de voz en el botón JARVIS de la barra de navegación inferior, eliminando el botón flotante duplicado y utilizando el hook `useJarvisRealtime` que ya implementa correctamente la conexión WebRTC con OpenAI Realtime API.

## Arquitectura Actual

```text
┌─────────────────────────────────────────────────────┐
│                    AppLayout                        │
├─────────────────────────────────────────────────────┤
│  useJarvisRealtime() ◄── Maneja WebRTC correctamente│
│         │                                           │
│         ▼                                           │
│  ┌─────────────────┐    ┌──────────────────────┐   │
│  │ PotusStatusBar  │    │  JarvisVoiceButton   │   │
│  │ (barra superior)│    │  (botón flotante)    │   │
│  └─────────────────┘    │  [DUPLICADO - BORRAR]│   │
│                         └──────────────────────┘   │
│  ┌─────────────────────────────────────────────┐   │
│  │           BottomNavBar                      │   │
│  │  [Dashboard] [Tareas] [🔴JARVIS] [Chat] [⚙]│   │
│  └─────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Arquitectura Objetivo

```text
┌─────────────────────────────────────────────────────┐
│                    AppLayout                        │
├─────────────────────────────────────────────────────┤
│  useJarvisRealtime() ◄── WebRTC + audio en DOM     │
│         │                                           │
│         ▼                                           │
│  ┌─────────────────┐                               │
│  │ PotusStatusBar  │ ◄── Aparece solo cuando activo│
│  │ "Escuchando..." │                               │
│  └─────────────────┘                               │
│                                                     │
│  ┌─────────────────────────────────────────────────┐│
│  │           BottomNavBar                          ││
│  │  [Dashboard] [Tareas] [🔴JARVIS] [Chat] [⚙]    ││
│  │                    ▲                            ││
│  │         Controla toggleSession()                ││
│  └─────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────┘
```

## Cambios a Realizar

### 1. Eliminar JarvisVoiceButton de páginas

**Archivos afectados:**
- `src/pages/Tasks.tsx` - Quitar import y uso de `<JarvisVoiceButton />`
- `src/pages/Calendar.tsx` - Quitar import y uso de `<JarvisVoiceButton />`

**Cambios:**
- Eliminar línea de import: `import { JarvisVoiceButton } from "@/components/voice/JarvisVoiceButton";`
- Eliminar componente: `<JarvisVoiceButton />`

### 2. Deprecar JarvisVoiceButton.tsx

**Archivo:** `src/components/voice/JarvisVoiceButton.tsx`

Convertir el archivo a un componente vacío con comentario de deprecación (similar a `PotusFloatingButton.tsx`):

```typescript
// Este componente está deprecado - la funcionalidad de voz
// ahora está integrada en BottomNavBar con useJarvisRealtime
// Se mantiene para compatibilidad pero no renderiza nada

export const JarvisVoiceButton = () => {
  return null;
};
```

### 3. Ya está implementado correctamente

Los siguientes archivos ya están configurados correctamente y NO requieren cambios:

**`src/hooks/useJarvisRealtime.tsx`**
- Ya implementa WebRTC con OpenAI Realtime API
- Ya añade el elemento audio al DOM (`document.body.appendChild(audioEl)`)
- Ya limpia correctamente (`audioElementRef.current.remove()`)
- Ya maneja estados: `idle`, `connecting`, `listening`, `speaking`

**`src/components/layout/AppLayout.tsx`**
- Ya usa `useJarvisRealtime()` 
- Ya pasa `toggleSession` a BottomNavBar
- Ya muestra `PotusStatusBar` cuando `isActive`

**`src/components/layout/BottomNavBar.tsx`**
- Ya tiene los 5 elementos correctos
- Ya cambia a rojo cuando `isJarvisActive`
- Ya llama `onJarvisPress` (que es `toggleSession`)

**`src/components/voice/PotusStatusBar.tsx`**
- Ya muestra "Escuchando..." / "JARVIS está hablando..."
- Ya tiene waveform reactivo

## Flujo de Voz (sin cambios)

1. Usuario pulsa **JARVIS** en barra inferior
2. `onJarvisPress()` → `toggleSession()` en `useJarvisRealtime`
3. Hook obtiene token de `jarvis-voice` edge function
4. Crea `RTCPeerConnection` con micrófono
5. Añade `<audio>` al DOM para reproducción
6. Conecta con OpenAI Realtime API vía WebRTC
7. `PotusStatusBar` aparece mostrando estado
8. Conversación bidireccional en tiempo real
9. Usuario pulsa **X** o **JARVIS** → `stopSession()`

## Resumen de Archivos

| Archivo | Acción |
|---------|--------|
| `src/pages/Tasks.tsx` | Quitar import y uso de JarvisVoiceButton |
| `src/pages/Calendar.tsx` | Quitar import y uso de JarvisVoiceButton |
| `src/components/voice/JarvisVoiceButton.tsx` | Deprecar (return null) |
| `src/hooks/useJarvisRealtime.tsx` | Sin cambios (ya correcto) |
| `src/components/layout/AppLayout.tsx` | Sin cambios (ya correcto) |
| `src/components/layout/BottomNavBar.tsx` | Sin cambios (ya correcto) |
| `src/components/voice/PotusStatusBar.tsx` | Sin cambios (ya correcto) |

## Impacto

- **Antes**: Botón flotante duplicado que competía con el botón de la barra inferior
- **Después**: Una sola entrada de voz unificada en el centro de la navegación
- La lógica WebRTC permanece intacta en el hook reutilizable
- El audio se reproduce correctamente al estar en el DOM
