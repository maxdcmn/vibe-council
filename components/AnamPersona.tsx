'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@anam-ai/js-sdk';

export default function AnamPersona() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [status, setStatus] = useState('Ready to start');
  const [anamClient, setAnamClient] = useState<any>(null);

  const startSession = async () => {
    try {
      setStatus('Creating session...');
      const response = await fetch('/api/anam/session-token', {
        method: 'POST',
      });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get session token');
      }

      setStatus('Connecting to Anam.ai...');
      const client = createClient(data.sessionToken);
      setAnamClient(client);

      if (videoRef.current) {
        await client.streamToVideoElement('anam-persona-video');
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
          id="anam-persona-video"
          ref={videoRef}
          autoPlay
          playsInline
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
