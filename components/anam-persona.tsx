'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@anam-ai/js-sdk';

interface AnamPersonaProps {
  personaConfig?: any;
  personaId?: string;
  onClientReady?: (client: any) => void;
  inputStream?: MediaStream;
  onOutputStreamReady?: (outputStream: MediaStream) => void;
  onStartSessionReady?: (startFn: () => Promise<void>) => void;
  muted?: boolean;
}

export default function AnamPersona({
  personaConfig,
  personaId,
  onClientReady,
  inputStream,
  onOutputStreamReady,
  onStartSessionReady,
  muted,
}: AnamPersonaProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Ready to start');
  const [anamClient, setAnamClient] = useState<any>(null);
  const startSessionRef = useRef<(() => Promise<void>) | null>(null);

  const startSession = async () => {
    try {
      setStatus('Creating session...');
      const response = await fetch('/api/anam/session-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ personaId, personaConfig }),
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get session token');
      }

      setStatus('Connecting to Anam.ai...');
      const client = createClient(data.sessionToken);
      setAnamClient(client);

      if (onClientReady) {
        onClientReady(client);
      }

      if (videoRef.current) {
        // Use stream() method as suggested to get direct access to the stream
        // Default to microphone if no inputStream provided (though Council should provide one)
        const input = inputStream || undefined; 
        
        // Assuming client.stream returns [MediaStream] or similar based on user snippet
        // "const [videoStream1] = await anamClient1.stream(userInputStream);"
        const result = await client.stream(input);
        
        // Handle both array return (as per user snippet) or single object
        const outputStream = Array.isArray(result) ? result[0] : result;

        videoRef.current.srcObject = outputStream;
        
        if (onOutputStreamReady) {
            onOutputStreamReady(outputStream);
        }

        setIsSessionActive(true);
        setStatus('Connected! You can speak now.');
      }
    } catch (error) {
      console.error('Failed to start session:', error);
      setStatus(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };


  const stopSession = () => {
    if (anamClient) {
      anamClient.stopStreaming();
      setAnamClient(null);
      setIsSessionActive(false);
      setStatus('Session ended');
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  };

  // Expose startSession function to parent (only once)
  const startSessionExposedRef = useRef(false);
  
  useEffect(() => {
    startSessionRef.current = startSession;
    if (onStartSessionReady && !isSessionActive && !startSessionExposedRef.current) {
      startSessionExposedRef.current = true;
      onStartSessionReady(startSession);
    }
  }, [onStartSessionReady, isSessionActive]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (anamClient) {
        anamClient.stopStreaming();
      }
    };
  }, [anamClient]);

  return (
    <div className="flex flex-col items-center gap-4 p-4 border rounded-lg shadow-sm bg-card text-card-foreground">
      <div className="relative w-full max-w-md aspect-video bg-muted rounded-md overflow-hidden">
        <video
          id={`anam-persona-video-${personaConfig?.name || 'default'}`}
          ref={videoRef}
          autoPlay
          playsInline
          crossOrigin="anonymous"
          muted={muted}
          className="w-full h-full object-cover"
        />
        {!isSessionActive && (
          <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
            Persona Video Area
          </div>
        )}
      </div>

      <div className="text-sm font-medium text-center">{status}</div>

      <div className="flex gap-2">
        <button
          onClick={startSession}
          disabled={isSessionActive}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Start Chat
        </button>
        <button
          onClick={stopSession}
          disabled={!isSessionActive}
          className="px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Stop Chat
        </button>
      </div>
    </div>
  );
}
