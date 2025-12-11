import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useAudioPlayer } from "./useAudioPlayer";
import { useAudioRecorder } from "./useAudioRecorder";

export type ConnectionState = "disconnected" | "connecting" | "connected" | "error";
export type ConversationState = "idle" | "listening" | "speaking";

interface ConversationInitiatedMessage {
  type: "conversation_initiation_metadata";
  conversation_initiation_metadata_event: {
    conversation_id: string;
  };
}

interface UseVoiceAgentOptions {
  agentName?: string;
  autoConnect?: boolean;
}

export function useVoiceAgent({
  agentName = "Agent",
  autoConnect = false,
}: UseVoiceAgentOptions = {}) {
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("disconnected");
  const [conversationState, setConversationState] =
    useState<ConversationState>("idle");
  const [conversationId, setConversationId] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const audioPlayer = useAudioPlayer();
  
  const sendAudioData = useCallback((base64Audio: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          user_audio_chunk: base64Audio,
        })
      );
    }
  }, []);

  const audioRecorder = useAudioRecorder({
    onAudioData: sendAudioData,
    enabled: conversationState !== "speaking",
  });

  // Update conversation state based on playback
  useEffect(() => {
    if (audioPlayer.playbackState === "playing") {
      setConversationState("speaking");
    } else if (
      audioRecorder.recordingState === "recording" &&
      audioPlayer.playbackState === "idle"
    ) {
      setConversationState("listening");
    }
  }, [audioPlayer.playbackState, audioRecorder.recordingState]);

  const connect = useCallback(async () => {
    try {
      console.log(`🔌 [${agentName}] Starting connection...`);
      setConnectionState("connecting");

      // Clear any existing reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Get signed URL from our API
      console.log(`🔑 [${agentName}] Fetching signed URL...`);
      const response = await fetch("/api/voice/conversation");
      const data = await response.json();

      if (!data.signedUrl) {
        throw new Error("Failed to get signed URL");
      }

      console.log(`🔗 [${agentName}] Creating WebSocket connection...`);
      // Create WebSocket connection
      const ws = new WebSocket(data.signedUrl);
      wsRef.current = ws;

      ws.onopen = async () => {
        console.log(`✅ [${agentName}] WebSocket connected (readyState: ${ws.readyState})`);
        setConnectionState("connected");
        toast.success(`${agentName} connected`);

        // Start microphone
        console.log(`🎤 [${agentName}] Starting microphone...`);
        await audioRecorder.startRecording();

        // Note: ElevenLabs WebSocket doesn't require keepalive pings
        // The connection stays alive as long as we're sending audio data
        console.log(`✅ [${agentName}] Connection established, audio streaming active`)
      };

      ws.onmessage = (event) => {
        try {
          // Handle binary data (audio)
          if (event.data instanceof Blob) {
            console.log(`[${agentName}] Received binary audio blob`);
            event.data.arrayBuffer().then((buffer) => {
              const base64 = btoa(
                String.fromCharCode(...new Uint8Array(buffer))
              );
              audioPlayer.playAudioChunk(base64);
            });
            return;
          }

          const message = JSON.parse(event.data);
          console.log(`📨 [${agentName}] Message type:`, message.type);

          // Handle conversation initiation
          if (message.type === "conversation_initiation_metadata") {
            const initMessage = message as ConversationInitiatedMessage;
            setConversationId(
              initMessage.conversation_initiation_metadata_event.conversation_id
            );
            console.log(
              `✅ [${agentName}] Conversation started:`,
              initMessage.conversation_initiation_metadata_event.conversation_id
            );
          }

          // Handle audio in various formats
          if (message.audio) {
            audioPlayer.playAudioChunk(message.audio);
          } else if (
            message.type === "audio" &&
            message.audio_event?.audio_base_64
          ) {
            audioPlayer.playAudioChunk(message.audio_event.audio_base_64);
          } else if (message.type === "audio" && message.audio_event?.chunk) {
            audioPlayer.playAudioChunk(message.audio_event.chunk);
          } else if (
            message.type === "agent_response" &&
            message.agent_response_event?.audio
          ) {
            audioPlayer.playAudioChunk(message.agent_response_event.audio);
          }

          // Handle interruption
          if (message.type === "interruption") {
            console.log(`⚠️ [${agentName}] Interruption detected`);
            audioPlayer.clearQueue();
          }

          // Handle agent response text
          if (message.type === "agent_response") {
            console.log(
              `💬 [${agentName}] Response:`,
              message.agent_response_event?.agent_response
            );
          }
        } catch (error) {
          console.error(`❌ [${agentName}] Error parsing message:`, error);
        }
      };

      ws.onerror = (error) => {
        console.error(`❌ [${agentName}] WebSocket error:`, error);
        setConnectionState("error");
        toast.error(`${agentName} connection error`);
      };

      ws.onclose = (event) => {
        console.log(`🔌 [${agentName}] WebSocket closed - Code: ${event.code}, Reason: ${event.reason || "No reason provided"}, Clean: ${event.wasClean}`);
        console.trace(`📍 [${agentName}] WebSocket close stack trace`);
        
        console.log(`🔄 [${agentName}] Updating state to disconnected`);
        setConnectionState("disconnected");
        setConversationState("idle");
        audioRecorder.stopRecording();
        
        // Provide more informative messages based on close code
        if (event.code === 1000) {
          // Normal closure
          if (event.reason === "Component unmounted") {
            console.log(`🧹 [${agentName}] Connection closed due to component unmount`);
          } else if (event.reason === "User disconnected") {
            console.log(`👤 [${agentName}] Connection closed by user action`);
          } else {
            console.log(`✅ [${agentName}] Normal connection closure`);
          }
          toast.message(`${agentName} disconnected`);
        } else if (event.code === 1006) {
          // Abnormal closure (no close frame)
          toast.error(`${agentName} connection lost unexpectedly`);
          console.error(`❌ [${agentName}] Abnormal closure - possible network issue or server timeout`);
        } else if (event.code === 1008) {
          // Invalid message
          toast.error(`${agentName} disconnected: Invalid message format`);
          console.error(`❌ [${agentName}] Server rejected a message - Code 1008: ${event.reason}`);
        } else if (event.code >= 4000) {
          // Custom error codes
          toast.error(`${agentName} disconnected: ${event.reason || "Server error"}`);
        } else {
          toast.error(`${agentName} disconnected unexpectedly`);
          console.error(`❌ [${agentName}] Unexpected close code: ${event.code}`);
        }
      };
    } catch (error) {
      console.error(`[${agentName}] Failed to connect:`, error);
      setConnectionState("error");
      toast.error(
        error instanceof Error ? error.message : `${agentName} failed to connect`
      );
    }
  }, [agentName, audioRecorder, audioPlayer]);

  const disconnect = useCallback(() => {
    console.log(`🔌 [${agentName}] Disconnect called`);

    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current) {
      console.log(`🔌 [${agentName}] Closing WebSocket (readyState: ${wsRef.current.readyState})`);
      wsRef.current.close(1000, "User disconnected");
      wsRef.current = null;
    }

    audioRecorder.stopRecording();
    setConversationId(null);
  }, [agentName, audioRecorder]);

  // Cleanup on unmount ONLY - using refs to avoid recreating effect
  useEffect(() => {
    console.log(`🎬 [${agentName}] useVoiceAgent mounted`);
    
    return () => {
      console.log(`🧹 [${agentName}] useVoiceAgent unmounting - cleaning up`);

      // Clear reconnect timeout
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      // Close WebSocket
      if (wsRef.current) {
        wsRef.current.close(1000, "Component unmounted");
        wsRef.current = null;
      }

      // Stop recording and cleanup audio
      audioRecorder.stopRecording();
      audioPlayer.cleanup();
      audioRecorder.cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  // Auto-connect if enabled
  useEffect(() => {
    if (autoConnect && connectionState === "disconnected") {
      connect();
    }
  }, [autoConnect, connectionState, connect]);

  return {
    connectionState,
    conversationState,
    conversationId,
    isMuted: audioRecorder.isMuted,
    connect,
    disconnect,
    toggleMute: audioRecorder.toggleMute,
    audioContext: audioPlayer.audioContext,
    queueLength: audioPlayer.queueLength,
    isPlaying: audioPlayer.isPlaying,
  };
}
