import { useCallback, useRef, useState } from "react";

export type PlaybackState = "idle" | "playing";

export function useAudioPlayer() {
  const [playbackState, setPlaybackState] = useState<PlaybackState>("idle");
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

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
      return;
    }

    isPlayingRef.current = true;
    setPlaybackState("playing");

    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      playNextInQueue();
    };

    source.start();
  }, []);

  const playAudioChunk = useCallback(
    async (base64Audio: string) => {
      const audioContext = initAudioContext();

      try {
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

        // Start playing if not already playing
        if (!isPlayingRef.current) {
          playNextInQueue();
        }
      } catch (error) {
        console.error("Error playing audio chunk:", error);
      }
    },
    [initAudioContext, playNextInQueue]
  );

  const clearQueue = useCallback(() => {
    audioQueueRef.current = [];
    isPlayingRef.current = false;
    setPlaybackState("idle");
  }, []);

  const cleanup = useCallback(() => {
    clearQueue();
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  }, [clearQueue]);

  return {
    playbackState,
    playAudioChunk,
    clearQueue,
    cleanup,
    audioContext: audioContextRef.current,
    queueLength: audioQueueRef.current.length,
    isPlaying: isPlayingRef.current,
  };
}
