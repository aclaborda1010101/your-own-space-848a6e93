/**
 * JARVIS Voice Hooks
 * 
 * Realtime voice system with:
 * - Groq Whisper STT (ultrafast)
 * - Claude AI (context-aware responses)
 * - ElevenLabs TTS (JARVIS voice)
 */

export { useVoiceRecognition, type RecognitionState } from '../useVoiceRecognition';
export { useJarvisTTS, type TTSState } from '../useJarvisTTS';
export { 
  useJarvisRealtimeVoice, 
  type JarvisRealtimeState, 
  type AgentType 
} from '../useJarvisRealtimeVoice';
