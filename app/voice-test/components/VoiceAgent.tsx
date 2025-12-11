"use client";

import { Mic, MicOff, Phone, PhoneOff, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useVoiceAgent } from "../hooks/useVoiceAgent";

interface VoiceAgentProps {
  agentId: string;
  agentName: string;
  onRemove?: () => void;
  canRemove?: boolean;
}

export function VoiceAgent({
  agentId,
  agentName,
  onRemove,
  canRemove = true,
}: VoiceAgentProps) {
  const {
    connectionState,
    conversationState,
    conversationId,
    isMuted,
    connect,
    disconnect,
    toggleMute,
    audioContext,
    queueLength,
    isPlaying,
  } = useVoiceAgent({ agentName });

  const isConnected = connectionState === "connected";

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h3 className="text-lg font-semibold">{agentName}</h3>
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
              connectionState === "connected"
                ? "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-50"
                : connectionState === "connecting"
                  ? "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-50"
                  : connectionState === "error"
                    ? "bg-red-100 text-red-900 dark:bg-red-900/40 dark:text-red-50"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            )}
          >
            <span
              className={cn(
                "h-1.5 w-1.5 rounded-full",
                connectionState === "connected"
                  ? "bg-emerald-500"
                  : connectionState === "connecting"
                    ? "bg-amber-500 animate-pulse"
                    : connectionState === "error"
                      ? "bg-red-500"
                      : "bg-zinc-400"
              )}
            />
            {connectionState === "disconnected" && "Offline"}
            {connectionState === "connecting" && "Connecting"}
            {connectionState === "connected" && "Live"}
            {connectionState === "error" && "Error"}
          </span>
        </div>
        {canRemove && onRemove && (
          <button
            onClick={onRemove}
            disabled={isConnected}
            className="rounded-lg p-2 text-zinc-400 transition hover:bg-red-50 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50 dark:hover:bg-red-900/20"
            title="Remove agent"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Connection Controls */}
      <div className="mb-4 flex flex-col gap-2">
        {!isConnected ? (
          <button
            onClick={connect}
            disabled={connectionState === "connecting"}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium text-white transition",
              "bg-emerald-600 hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
            )}
          >
            <Phone className="h-4 w-4" />
            {connectionState === "connecting" ? "Connecting..." : "Connect"}
          </button>
        ) : (
          <>
            <button
              onClick={disconnect}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-red-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-700"
            >
              <PhoneOff className="h-4 w-4" />
              Disconnect
            </button>
            <button
              onClick={toggleMute}
              className={cn(
                "inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition",
                isMuted
                  ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300"
                  : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
              )}
            >
              {isMuted ? (
                <>
                  <MicOff className="h-4 w-4" />
                  Unmute
                </>
              ) : (
                <>
                  <Mic className="h-4 w-4" />
                  Mute
                </>
              )}
            </button>
          </>
        )}
      </div>

      {/* Status Grid */}
      <div className="space-y-2">
        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            State
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              conversationState === "listening"
                ? "text-blue-600 dark:text-blue-400"
                : conversationState === "speaking"
                  ? "text-purple-600 dark:text-purple-400"
                  : "text-zinc-500"
            )}
          >
            {conversationState === "idle" && "Idle"}
            {conversationState === "listening" && "🎤 Listening"}
            {conversationState === "speaking" && "🔊 Speaking"}
          </span>
        </div>

        <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            Microphone
          </span>
          <span
            className={cn(
              "text-xs font-semibold",
              isMuted
                ? "text-red-600 dark:text-red-400"
                : isConnected
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-zinc-500"
            )}
          >
            {isMuted ? "Muted" : isConnected ? "Active" : "Inactive"}
          </span>
        </div>

        {conversationId && (
          <div className="flex items-center justify-between rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900">
            <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              Session
            </span>
            <span className="font-mono text-xs text-zinc-600 dark:text-zinc-400">
              {conversationId.slice(0, 8)}
            </span>
          </div>
        )}
      </div>

      {/* Debug Info (only when connected) */}
      {isConnected && (
        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <p className="mb-1 text-xs font-medium text-amber-900 dark:text-amber-100">
            🐛 Debug
          </p>
          <div className="space-y-0.5 text-xs text-amber-800 dark:text-amber-200">
            <p>Context: {audioContext?.state || "N/A"}</p>
            <p>Queue: {queueLength} | Playing: {isPlaying ? "Yes" : "No"}</p>
          </div>
        </div>
      )}
    </div>
  );
}
