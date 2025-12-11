import { useCallback, useRef, useState } from "react";

export type PlaybackState = "idle" | "playing";

export interface AudioPlayerCallbacks {
  onPlaybackStart?: () => void;
  onPlaybackEnd?: () => void;
}

export function useAudioPlayer() {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);
  const currentSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const callbacksRef = useRef<AudioPlayerCallbacks>({});

  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playNextInQueue = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setPlaybackState("idle");
      currentSourceRef.current = null;
      callbacksRef.current.onPlaybackEnd?.();
      return;
    }

    if (!isPlayingRef.current) {
      isPlayingRef.current = true;
      setPlaybackState("playing");
      callbacksRef.current.onPlaybackStart?.();
    }

    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);
    currentSourceRef.current = source;

    source.onended = () => {
      currentSourceRef.current = null;
      playNextInQueue();
    };

    source.start();
  }, []);

  const playAudioChunk = useCallback(
    async (base64Audio: string) => {
      const audioContext = initAudioContext();

      try {
        // Resume AudioContext if suspended (required by browsers)
        if (audioContext.state === 'suspended') {
          console.log('🔊 [AudioPlayer] Resuming suspended AudioContext');
          await audioContext.resume();
        }

        // Decode base64 to array buffer
        const binaryString = atob(base64Audio);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }

        // Convert Int16 PCM to Float32 for Web Audio API
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);

        for (let i = 0; i < pcm16.length; i++) {
          float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
        }

        // Create audio buffer with 16kHz sample rate (ElevenLabs default)
        const sampleRate = 16000;
        const audioBuffer = audioContext.createBuffer(
          1, // mono
          float32.length,
          sampleRate
        );

        audioBuffer.getChannelData(0).set(float32);
        audioQueueRef.current.push(audioBuffer);

        console.log(`🎵 [AudioPlayer] Added chunk to queue. Queue length: ${audioQueueRef.current.length}, Is playing: ${isPlayingRef.current}`);

        // Start playing if not already playing
        if (!isPlayingRef.current) {
          playNextInQueue();
        }
      } catch (error) {
        console.error("❌ [AudioPlayer] Error playing audio chunk:", error);
      }
    },
    [initAudioContext, playNextInQueue]
  );

  const clearQueue = useCallback(() => {
    // Stop current playback
    if (currentSourceRef.current) {
      try {
        currentSourceRef.current.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      currentSourceRef.current = null;
    }
    
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setPlaybackState("idle");
    callbacksRef.current.onPlaybackEnd?.();
  }, []);

  const cleanup = useCallback(() => {
    clearQueue();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [clearQueue]);

  const setCallbacks = useCallback((callbacks: AudioPlayerCallbacks) => {
    callbacksRef.current = callbacks;
  }, []);

  return {
    playbackState,
    playAudioChunk,
    clearQueue,
    cleanup,
    setCallbacks,
    audioContext: audioContextRef.current,
    queueLength: audioQueueRef.current.length,
    isPlaying: isPlayingRef.current,
  };
}
