import { useCallback, useRef, useState } from "react";
import { toast } from "sonner";

export type RecordingState = "idle" | "recording";

interface UseAudioRecorderOptions {
  onAudioData?: (base64Audio: string) => void;
  enabled?: boolean;
}

export function useAudioRecorder({
  onAudioData,
  enabled = true,
}: UseAudioRecorderOptions = {}) {
  const [recordingState, setRecordingState] =
    useState<RecordingState>("idle");
  const [isMuted, setIsMuted] = useState(false);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const startRecording = useCallback(async () => {
    try {
      console.log("🎤 [Recorder] Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;
      console.log("✅ [Recorder] Microphone access granted");

      if (!audioContextRef.current) {
        console.log("🔊 [Recorder] Creating AudioContext (16kHz)");
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      }

      const audioContext = audioContextRef.current;

      // Load the AudioWorklet processor
      try {
        console.log("📦 [Recorder] Loading AudioWorklet module...");
        await audioContext.audioWorklet.addModule("/audio-processor.js");
        console.log("✅ [Recorder] AudioWorklet module loaded");
      } catch (e) {
        // Module might already be loaded, ignore error
        console.log("ℹ️ [Recorder] AudioWorklet module already loaded or failed to load:", e);
      }

      const source = audioContext.createMediaStreamSource(stream);
      sourceNodeRef.current = source;

      const workletNode = new AudioWorkletNode(
        audioContext,
        "audio-capture-processor"
      );
      workletNodeRef.current = workletNode;

      // Handle audio data from the worklet
      workletNode.port.onmessage = (event) => {
        if (!isMuted && enabled && onAudioData && event.data.audioData) {
          // Convert ArrayBuffer to base64
          const uint8Array = new Uint8Array(event.data.audioData);
          const base64 = btoa(String.fromCharCode(...uint8Array));
          onAudioData(base64);
        }
      };

      source.connect(workletNode);
      workletNode.connect(audioContext.destination);

      setRecordingState("recording");
      console.log("✅ [Recorder] Recording started");
      toast.success("Microphone started");
    } catch (error) {
      console.error("❌ [Recorder] Failed to start microphone:", error);
      toast.error("Failed to access microphone");
      throw error;
    }
  }, [isMuted, enabled, onAudioData]);

  const stopRecording = useCallback(() => {
    console.log("⏹️ [Recorder] Stopping recording...");
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
      console.log("✅ [Recorder] Media stream stopped");
    }

    if (sourceNodeRef.current) {
      sourceNodeRef.current.disconnect();
      sourceNodeRef.current = null;
      console.log("✅ [Recorder] Source node disconnected");
    }

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
      console.log("✅ [Recorder] Worklet node disconnected");
    }

    setRecordingState("idle");
    console.log("✅ [Recorder] Recording stopped");
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    toast.message(isMuted ? "Microphone unmuted" : "Microphone muted");
  }, [isMuted]);

  const cleanup = useCallback(() => {
    console.log("🧹 [Recorder] Cleaning up...");
    stopRecording();
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close();
      audioContextRef.current = null;
      console.log("✅ [Recorder] AudioContext closed");
    }
  }, [stopRecording]);

  return {
    recordingState,
    isMuted,
    startRecording,
    stopRecording,
    toggleMute,
    cleanup,
  };
}
