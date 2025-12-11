'use client';

import { useState, useRef, useEffect } from 'react';
import AnamPersona from './AnamPersona';

export default function Council() {
  const [clientA, setClientA] = useState<any>(null);
  const [clientB, setClientB] = useState<any>(null);
  const [logs, setLogs] = useState<string[]>([]);
  const [isCouncilActive, setIsCouncilActive] = useState(false);

  // Input streams for the agents (what they hear)
  const [inputStreamA, setInputStreamA] = useState<MediaStream | undefined>(undefined);
  const [inputStreamB, setInputStreamB] = useState<MediaStream | undefined>(undefined);

  // Audio Context and Nodes
  const audioContextRef = useRef<AudioContext | null>(null);
  const destARef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const destBRef = useRef<MediaStreamAudioDestinationNode | null>(null);
  const userSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const agentASourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const agentBSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const [audioLevelA, setAudioLevelA] = useState(0);
  const [audioLevelB, setAudioLevelB] = useState(0);

  const log = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  const initializeAudio = async () => {
    try {
      log('Initializing Audio Context...');
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      // Create destinations (inputs for agents)
      const destA = audioCtx.createMediaStreamDestination();
      const destB = audioCtx.createMediaStreamDestination();
      destARef.current = destA;
      destBRef.current = destB;

      // Set these as inputs for the agents
      setInputStreamA(destA.stream);
      setInputStreamB(destB.stream);

      // Get User Microphone
      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const userSource = audioCtx.createMediaStreamSource(userStream);
      userSourceRef.current = userSource;

      // Connect User to both agents
      userSource.connect(destA);
      userSource.connect(destB);

      log('Audio initialized. User mic connected to agents. Please start agents.');
      setIsCouncilActive(true);

    } catch (error) {
      console.error('Failed to setup audio:', error);
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleOutputStreamA = (stream: MediaStream) => {
    if (!audioContextRef.current || !destBRef.current) return;
    log('Received Output Stream from Optimist');
    
    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    agentASourceRef.current = source;

    // Route Optimist -> Pessimist
    source.connect(destBRef.current);
    // Route Optimist -> User Speakers
    source.connect(ctx.destination);

    setupAnalyzer(source, setAudioLevelA);
  };

  const handleOutputStreamB = (stream: MediaStream) => {
    if (!audioContextRef.current || !destARef.current) return;
    log('Received Output Stream from Pessimist');

    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    agentBSourceRef.current = source;

    // Route Pessimist -> Optimist
    source.connect(destARef.current);
    // Route Pessimist -> User Speakers
    source.connect(ctx.destination);

    setupAnalyzer(source, setAudioLevelB);
  };

  const setupAnalyzer = (source: AudioNode, setLevel: (level: number) => void) => {
    if (!audioContextRef.current) return;
    const analyser = audioContextRef.current.createAnalyser();
    source.connect(analyser);
    
    const data = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = sum / data.length;
        setLevel(avg);
        requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  };

  const stopCouncil = () => {
    setIsCouncilActive(false);
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    setInputStreamA(undefined);
    setInputStreamB(undefined);
    log('Council stopped.');
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-4 justify-center">
        <div className="flex-1">
          <h2 className="text-xl font-bold text-center mb-2">The Optimist</h2>
          <AnamPersona
            personaConfig={{
              name: 'Optimist',
              systemPrompt: 'You are an eternal optimist. You see the bright side of everything. You are talking to a pessimist and a human user.',
            }}
            onClientReady={setClientA}
            inputStream={inputStreamA}
            onOutputStreamReady={handleOutputStreamA}
            muted={true}
          />
          <div className="mt-2">
            <div className="text-xs text-center mb-1">Output Audio Level</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-100" 
                    style={{ width: `${Math.min(100, audioLevelA * 2)}%` }}
                />
            </div>
          </div>
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-center mb-2">The Pessimist</h2>
          <AnamPersona
            personaConfig={{
              name: 'Pessimist',
              systemPrompt: 'You are a grumpy pessimist. You find flaws in everything. You are talking to an optimist and a human user.',
            }}
            onClientReady={setClientB}
            inputStream={inputStreamB}
            onOutputStreamReady={handleOutputStreamB}
            muted={true}
          />
          <div className="mt-2">
            <div className="text-xs text-center mb-1">Output Audio Level</div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                    className="h-full bg-green-500 transition-all duration-100" 
                    style={{ width: `${Math.min(100, audioLevelB * 2)}%` }}
                />
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        {!isCouncilActive ? (
            <button
            onClick={initializeAudio}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold"
            >
            Initialize Audio
            </button>
        ) : (
            <div className="text-green-600 font-bold flex items-center gap-2">
                <span>Audio Active</span>
                <button
                onClick={stopCouncil}
                className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm"
                >
                Stop
                </button>
            </div>
        )}
      </div>

      <div className="bg-slate-100 p-4 rounded-lg max-h-60 overflow-y-auto">
        <h3 className="font-bold mb-2">System Log</h3>
        {logs.map((l, i) => (
          <div key={i} className="text-sm font-mono">{l}</div>
        ))}
      </div>
      
      <div className="text-center text-sm text-muted-foreground">
        <p>Instructions:</p>
        <ol className="list-decimal list-inside">
            <li>Click "Initialize Audio" to setup the mixing.</li>
            <li>Click "Start Chat" on BOTH agents.</li>
            <li>Speak! Both you and the agents should hear each other.</li>
        </ol>
      </div>
    </div>
  );
}
