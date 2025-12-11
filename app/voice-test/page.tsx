"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Phone, PhoneOff } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
type ConversationState = "idle" | "listening" | "speaking";

interface AudioMessage {
  audio: string; // base64 encoded audio
  alignment?: {
    char_start_times_ms: number[];
    chars_durations_ms: number[];
    chars: string[];
  };
}

interface ConversationInitiatedMessage {
  type: "conversation_initiation_metadata";
  conversation_initiation_metadata_event: {
    conversation_id: string;
  };
}

export default function VoiceTestPage() {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [conversationState, setConversationState] =
    useState<ConversationState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);

  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  // Initialize audio context
  const initAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      // Use default sample rate (usually 48kHz) for better compatibility
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const playNextInQueue = useCallback(() => {
    const audioContext = audioContextRef.current;
    if (!audioContext || audioQueueRef.current.length === 0) {
      isPlayingRef.current = false;
      setConversationState("listening");
      return;
    }

    isPlayingRef.current = true;
    setConversationState("speaking");

    const audioBuffer = audioQueueRef.current.shift()!;
    const source = audioContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(audioContext.destination);

    source.onended = () => {
      playNextInQueue();
    };

    source.start();
  }, []);

  // Play audio from the agent
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

        // ElevenLabs sends PCM16 audio at 16kHz or 24kHz
        // Convert Int16 PCM to Float32 for Web Audio API
        const pcm16 = new Int16Array(bytes.buffer);
        const float32 = new Float32Array(pcm16.length);
        
        for (let i = 0; i < pcm16.length; i++) {
          // Convert from Int16 (-32768 to 32767) to Float32 (-1.0 to 1.0)
          float32[i] = pcm16[i] / (pcm16[i] < 0 ? 32768 : 32767);
        }

        // Create audio buffer with the correct sample rate
        // ElevenLabs typically uses 16kHz or 24kHz for output
        const sampleRate = 16000; // Try 16kHz first, adjust if needed
        const audioBuffer = audioContext.createBuffer(
          1, // mono
          float32.length,
          sampleRate,
        );
        
        audioBuffer.getChannelData(0).set(float32);
        audioQueueRef.current.push(audioBuffer);

        // Start playing if not already playing
        if (!isPlayingRef.current) {
          playNextInQueue();
        }
      } catch (error) {
        console.error("Error playing audio chunk:", error);
        console.error("Audio data length:", base64Audio.length);
      }
    },
    [initAudioContext, playNextInQueue],
  );

  // Start microphone capture
  const startMicrophone = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      mediaStreamRef.current = stream;
      const audioContext = initAudioContext();
      const source = audioContext.createMediaStreamSource(stream);

      // Create a script processor for capturing audio
      const processor = audioContext.createScriptProcessor(2048, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (
          wsRef.current?.readyState === WebSocket.OPEN &&
          !isMuted &&
          conversationState !== "speaking"
        ) {
          const inputData = e.inputBuffer.getChannelData(0);

          // Convert Float32Array to Int16Array (PCM16)
          const pcm16 = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }

          // Send as base64
          const base64 = btoa(
            String.fromCharCode.apply(null, Array.from(new Uint8Array(pcm16.buffer))),
          );

          wsRef.current.send(
            JSON.stringify({
              user_audio_chunk: base64,
            }),
          );
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setConversationState("listening");
      toast.success("Microphone started");
    } catch (error) {
      console.error("Failed to start microphone:", error);
      toast.error("Failed to access microphone");
      throw error;
    }
  }, [initAudioContext, isMuted, conversationState]);

  // Stop microphone
  const stopMicrophone = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    setConversationState("idle");
  }, []);

  // Connect to ElevenLabs Conversational AI
  const connect = useCallback(async () => {
    try {
      setConnectionState("connecting");

      // Get signed URL from our API
      const response = await fetch("/api/voice/conversation");
      const data = await response.json();

      if (!data.signedUrl) {
        throw new Error("Failed to get signed URL");
      }

      // Create WebSocket connection
      const ws = new WebSocket(data.signedUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log("✅ WebSocket connected");
        setConnectionState("connected");
        toast.success("Connected to voice agent");

        // Start microphone
        await startMicrophone();
      };

      ws.onmessage = (event) => {
        try {
          // Check if it's binary data (audio)
          if (event.data instanceof Blob) {
            console.log("Received binary audio blob, size:", event.data.size);
            // Handle binary audio data
            event.data.arrayBuffer().then((buffer) => {
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(buffer))
              );
              playAudioChunk(base64);
            });
            return;
          }

          const message = JSON.parse(event.data);
          console.log("📨 WebSocket message type:", message.type);
          console.log("📨 Full message:", JSON.stringify(message, null, 2));

          // Handle conversation initiation
          if (message.type === "conversation_initiation_metadata") {
            const initMessage = message as ConversationInitiatedMessage;
            setConversationId(
              initMessage.conversation_initiation_metadata_event.conversation_id,
            );
            console.log(
              "✅ Conversation started:",
              initMessage.conversation_initiation_metadata_event.conversation_id,
            );
          }

          // Handle audio response from agent (base64 encoded)
          if (message.audio) {
            const audioMsg = message as AudioMessage;
            console.log("🔊 Received audio chunk (base64), length:", audioMsg.audio.length);
            playAudioChunk(audioMsg.audio);
          }

          // Handle audio event (might be in different format)
          if (message.type === "audio" && message.audio_event) {
            console.log("🔊 Received audio_event:", message.audio_event);
            if (message.audio_event.audio_base_64) {
              playAudioChunk(message.audio_event.audio_base_64);
            }
          }

          // Handle interruption
          if (message.type === "interruption") {
            console.log("⚠️ Interruption detected");
            // Clear audio queue when user interrupts
            audioQueueRef.current = [];
            isPlayingRef.current = false;
            setConversationState("listening");
          }

          // Handle agent response (text only, audio should come separately)
          if (message.type === "agent_response") {
            console.log("💬 Agent text response:", message.agent_response_event?.agent_response);
            console.log("⚠️ NOTE: Text received but no audio in this message!");
          }
        } catch (error) {
          console.error("❌ Error parsing message:", error);
        }
      };

      ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        setConnectionState("error");
        toast.error("Connection error");
      };

      ws.onclose = () => {
        console.log("WebSocket closed");
        setConnectionState("disconnected");
        setConversationState("idle");
        stopMicrophone();
        toast.message("Disconnected from voice agent");
      };
    } catch (error) {
      console.error("Failed to connect:", error);
      setConnectionState("error");
      toast.error(
        error instanceof Error ? error.message : "Failed to connect",
      );
    }
  }, [startMicrophone, stopMicrophone, playAudioChunk]);

  // Disconnect
  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    stopMicrophone();
    setConversationId(null);
  }, [stopMicrophone]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    setIsMuted((prev) => !prev);
    toast.message(isMuted ? "Microphone unmuted" : "Microphone muted");
  }, [isMuted]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [disconnect]);

  const isConnected = connectionState === "connected";

  return (
    <div className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-6 py-12 text-zinc-900 dark:text-zinc-50">
      <header className="flex items-center justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Voice Council · Native Speech-to-Speech
          </p>
          <h1 className="text-3xl font-semibold">
            ElevenLabs Conversational AI
          </h1>
          <p className="text-sm text-zinc-500">
            Real-time voice conversation with native speech-to-speech. No TTS,
            just pure conversational AI.
          </p>
        </div>
        <div className="flex items-center gap-3 text-sm text-zinc-600 dark:text-zinc-300">
          <span
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1",
              connectionState === "connected"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50"
                : connectionState === "connecting"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-50"
                  : connectionState === "error"
                    ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-50"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200",
            )}
          >
            <span
              className={cn(
                "h-2 w-2 rounded-full",
                connectionState === "connected"
                  ? "bg-emerald-500"
                  : connectionState === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : connectionState === "error"
                      ? "bg-red-500"
                      : "bg-zinc-400",
              )}
            />
            {connectionState === "disconnected" && "Disconnected"}
            {connectionState === "connecting" && "Connecting..."}
            {connectionState === "connected" && "Connected"}
            {connectionState === "error" && "Error"}
          </span>
          {conversationId && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs dark:bg-zinc-800">
              {conversationId.slice(0, 8)}
            </span>
          )}
        </div>
      </header>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Connection Controls */}
        <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="mb-4 text-lg font-semibold">Connection</h2>
          <div className="flex flex-col gap-4">
            {!isConnected ? (
              <button
                onClick={connect}
                disabled={connectionState === "connecting"}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-medium text-white transition",
                  "bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400",
                )}
              >
                <Phone className="h-5 w-5" />
                {connectionState === "connecting"
                  ? "Connecting..."
                  : "Start Conversation"}
              </button>
            ) : (
              <button
                onClick={disconnect}
                className="inline-flex items-center justify-center gap-2 rounded-full bg-red-600 px-6 py-3 text-base font-medium text-white transition hover:bg-red-700"
              >
                <PhoneOff className="h-5 w-5" />
                End Conversation
              </button>
            )}

            {isConnected && (
              <button
                onClick={toggleMute}
                className={cn(
                  "inline-flex items-center justify-center gap-2 rounded-full border px-6 py-3 text-base font-medium transition",
                  isMuted
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                    : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800",
                )}
              >
                {isMuted ? (
                  <>
                    <MicOff className="h-5 w-5" />
                    Unmute
                  </>
                ) : (
                  <>
                    <Mic className="h-5 w-5" />
                    Mute
                  </>
                )}
              </button>
            )}
          </div>

          <div className="mt-6 space-y-2 text-sm text-zinc-600 dark:text-zinc-400">
            <p className="font-medium">How it works:</p>
            <ul className="list-inside list-disc space-y-1">
              <li>Click &ldquo;Start Conversation&rdquo; to connect</li>
              <li>Allow microphone access when prompted</li>
              <li>Speak naturally - the agent will respond</li>
              <li>You can interrupt the agent at any time</li>
            </ul>
          </div>
        </div>

        {/* Status Display */}
        <div className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          <h2 className="text-lg font-semibold">Conversation Status</h2>

          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Connection
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  connectionState === "connected"
                    ? "text-emerald-600 dark:text-emerald-400"
                    : connectionState === "connecting"
                      ? "text-amber-600 dark:text-amber-400"
                      : connectionState === "error"
                        ? "text-red-600 dark:text-red-400"
                        : "text-zinc-500",
                )}
              >
                {connectionState === "disconnected" && "Disconnected"}
                {connectionState === "connecting" && "Connecting..."}
                {connectionState === "connected" && "Active"}
                {connectionState === "error" && "Error"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Conversation
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  conversationState === "listening"
                    ? "text-blue-600 dark:text-blue-400"
                    : conversationState === "speaking"
                      ? "text-purple-600 dark:text-purple-400"
                      : "text-zinc-500",
                )}
              >
                {conversationState === "idle" && "Idle"}
                {conversationState === "listening" && "Listening"}
                {conversationState === "speaking" && "Speaking"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                Microphone
              </span>
              <span
                className={cn(
                  "text-sm font-semibold",
                  isMuted
                    ? "text-red-600 dark:text-red-400"
                    : isConnected
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-zinc-500",
                )}
              >
                {isMuted ? "Muted" : isConnected ? "Active" : "Inactive"}
              </span>
            </div>
          </div>

          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <strong>💡 Tip:</strong> This uses ElevenLabs native
              speech-to-speech conversational AI. Your voice is processed in
              real-time with ultra-low latency.
            </p>
          </div>

          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
            <p className="text-xs font-medium text-amber-900 dark:text-amber-100">
              🐛 Debug Info
            </p>
            <div className="mt-2 space-y-1 text-xs text-amber-800 dark:text-amber-200">
              <p>Audio Context: {audioContextRef.current?.state || "not initialized"}</p>
              <p>Sample Rate: {audioContextRef.current?.sampleRate || "N/A"} Hz</p>
              <p>Queue Length: {audioQueueRef.current.length}</p>
              <p>Is Playing: {isPlayingRef.current ? "Yes" : "No"}</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Check browser console for detailed logs
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
