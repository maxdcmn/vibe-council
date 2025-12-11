'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import AnamPersona from './AnamPersona';

interface Agent {
  id: string;
  name: string;
  basePrompt: string; // Store base prompt for updates
  systemPrompt: string;
  inputStream?: MediaStream;
  audioLevel: number;
  isSpeaking: boolean;
  client?: any; // Store the Anam client
  startSession?: () => Promise<void>; // Store the start session function
}

const SYSTEM_PROMPT_TEMPLATE = (agentName: string, userName: string, topic: string, participants: string) => `
You are ${agentName}.
You are in a group conversation (The Council) with a human user named ${userName} and other AI agents.
Current Participants: ${participants}.
Your Goal: Discuss the topic "${topic || 'General Chat'}".

STRICT PROTOCOL:
1. ONLY SPEAK WHEN SPOKEN TO: Do not speak unless you are explicitly addressed by name or if the previous speaker asked a question relevant to your perspective.
2. PASS THE MIC: You MUST end your turn by asking a specific question to another agent or the user. Use their name.
3. BE CONCISE: Keep your responses short (under 2 sentences).
4. NO NAME PREFIX: DO NOT start your response with your name (e.g., "Optimist: ..."). Just speak.
5. STAY IN CHARACTER.
6. MANDATORY: If you receive a message starting with [SYSTEM UPDATE], you must process it silently. DO NOT output any text or speech in response.
`;

const PERSONAS = [
  { name: 'The Optimist', basePrompt: 'You are an eternal optimist. You see the bright side of everything.' },
  { name: 'The Pessimist', basePrompt: 'You are a grumpy pessimist. You find flaws in everything.' },
  { name: 'The Realist', basePrompt: 'You are a pragmatist. You focus on facts and practical solutions.' },
  { name: 'The Joker', basePrompt: 'You are a comedian. You make jokes about everything.' },
  { name: 'The Philosopher', basePrompt: 'You are a deep thinker. You ask existential questions.' },
];

export default function Council() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [topic, setTopic] = useState('The Future of AI');
  const [userName, setUserName] = useState('User');

  // Audio Graph Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const userSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const agentsRef = useRef<Agent[]>([]); // Ref to track agents for audio loop access
  
  // Map agent ID to their audio nodes
  const agentInputDestinations = useRef<Map<string, MediaStreamAudioDestinationNode>>(new Map());
  const agentOutputSources = useRef<Map<string, MediaStreamAudioSourceNode>>(new Map());
  const agentGainNodes = useRef<Map<string, GainNode>>(new Map());

  // Moderator State
  const activeSpeakerRef = useRef<string | null>(null);
  const lastActiveTimeRef = useRef<number>(0);
  const SPEAKING_THRESHOLD = 10; 
  const SILENCE_TIMEOUT = 1000; 

  const log = (msg: string) => {
    setLogs((prev) => [...prev, `${new Date().toLocaleTimeString()}: ${msg}`]);
  };

  // Initialize Audio Context and User Mic
  const initializeAudio = async () => {
    try {
      if (audioContextRef.current) return;

      log('Initializing Audio Context...');
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      audioContextRef.current = audioCtx;

      const userStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const userSource = audioCtx.createMediaStreamSource(userStream);
      userSourceRef.current = userSource;

      setIsAudioInitialized(true);
      log('Audio initialized. Ready to add agents.');
      
      // Add first agent automatically
      addAgent();

      // Start Moderator Loop
      startModeratorLoop();

    } catch (error) {
      console.error('Failed to setup audio:', error);
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startModeratorLoop = () => {
    const loop = () => {
        const now = Date.now();
        
        // Check if we should release the floor
        if (activeSpeakerRef.current && (now - lastActiveTimeRef.current > SILENCE_TIMEOUT)) {
            activeSpeakerRef.current = null;
            setActiveSpeakerId(null);
            
            // Unmute everyone
            agentGainNodes.current.forEach(gain => {
                gain.gain.setTargetAtTime(1.0, audioContextRef.current!.currentTime, 0.1);
            });
        }

        requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const addAgent = () => {
    if (!audioContextRef.current || !userSourceRef.current) {
      log('Please initialize audio first.');
      return;
    }

    const id = Math.random().toString(36).substring(7);
    const persona = PERSONAS[agents.length % PERSONAS.length];
    
    log(`Adding agent: ${persona.name}`);

    // 1. Create Input Destination for this agent (The "Ear")
    const inputDest = audioContextRef.current.createMediaStreamDestination();
    agentInputDestinations.current.set(id, inputDest);

    // 2. Connect User Mic -> Agent Ear
    userSourceRef.current.connect(inputDest);

    // 3. Connect ALL existing agents' outputs -> New Agent Ear
    agentGainNodes.current.forEach((gainNode) => {
      gainNode.connect(inputDest);
    });

    // 4. Update State
    setAgents((prev) => {
        const newAgents = [
            ...prev,
            {
                id,
                name: persona.name,
                basePrompt: persona.basePrompt,
                systemPrompt: persona.basePrompt + SYSTEM_PROMPT_TEMPLATE(persona.name, userName, topic, `${userName}, ${prev.map(a => a.name).join(', ')}, ${persona.name}`),
                inputStream: inputDest.stream,
                audioLevel: 0,
                isSpeaking: false,
            },
        ];
        agentsRef.current = newAgents;
        
        // Announce new participant list (Silent Update)
        setTimeout(() => announceParticipants(newAgents), 500);
        
        return newAgents;
    });
  };

  const removeAgent = (id: string) => {
    log(`Removing agent ${id}`);
    
    agentInputDestinations.current.delete(id);

    const outputSource = agentOutputSources.current.get(id);
    outputSource?.disconnect();
    agentOutputSources.current.delete(id);

    const gainNode = agentGainNodes.current.get(id);
    gainNode?.disconnect();
    agentGainNodes.current.delete(id);

    setAgents((prev) => {
        const newAgents = prev.filter((a) => a.id !== id);
        agentsRef.current = newAgents;

        // Announce new participant list (Silent Update)
        setTimeout(() => announceParticipants(newAgents), 500);

        return newAgents;
    });
  };



  const announceParticipants = (currentAgents: Agent[]) => {
    const names = [userName, ...currentAgents.map(a => a.name)].join(', ');
    log(`Participants: ${names}`);
    
    // 1. Update State (Source of Truth for future sessions/reconnects)
    setAgents(prev => prev.map(agent => ({
        ...agent,
        systemPrompt: agent.basePrompt + SYSTEM_PROMPT_TEMPLATE(agent.name, userName, topic, names)
    })));

    // 2. Broadcast (Context Injection for active sessions)
    //broadcastContext(`Participant Update. Current Council: ${names}`);
  };

  const handleClientReady = (id: string, client: any) => {
    setAgents(prev => {
        const newAgents = prev.map(a => a.id === id ? { ...a, client } : a);
        agentsRef.current = newAgents;
        return newAgents;
    });
  };

  const handleStartSessionReady = (id: string, startFn: () => Promise<void>) => {
    setAgents(prev => {
        const newAgents = prev.map(a => a.id === id ? { ...a, startSession: startFn } : a);
        agentsRef.current = newAgents;
        return newAgents;
    });
  };

  const handleOutputStream = useCallback((agentId: string, stream: MediaStream) => {
    if (!audioContextRef.current) return;
    
    if (agentOutputSources.current.has(agentId)) return;

    log(`Received audio output from agent ${agentId}`);
    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    agentOutputSources.current.set(agentId, source);

    // Create Gain Node for this agent (The "Mouth Control")
    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;
    agentGainNodes.current.set(agentId, gainNode);

    // Connect Source -> Gain
    source.connect(gainNode);

    // 1. Connect Gain -> User Speakers
    gainNode.connect(ctx.destination);

    // 2. Connect Gain -> ALL OTHER Agents' Ears
    agentInputDestinations.current.forEach((dest, otherId) => {
      if (otherId !== agentId) {
        gainNode.connect(dest);
      }
    });

    // 3. Setup Analyzer
    setupAnalyzer(source, agentId);
  }, []);

  const broadcastContext = (message: string, excludeId?: string) => {
    agentsRef.current.forEach(agent => {
        if (agent.id !== excludeId && agent.client) {
            try {
                // Send a "system" message to the agent
                // We use talk() but prefix it to indicate it's a system event
                //agent.client.talk(`[SYSTEM UPDATE: ${message}. DO NOT RESPOND TO THIS MESSAGE.]`);
            } catch (e) {
                console.error(`Failed to broadcast to ${agent.name}`, e);
            }
        }
    });
  };

  const focusAgent = (agentId: string) => {
    // Manually set this agent as the active speaker
    activeSpeakerRef.current = agentId;
    setActiveSpeakerId(agentId);
    lastActiveTimeRef.current = Date.now();
    
    const speaker = agentsRef.current.find(a => a.id === agentId);
    if (speaker) {
      log(`Manually focused: ${speaker.name}`);
      //broadcastContext(`${speaker.name} has been given the floor. Listen to them.`, agentId);
    }
    
    // Mute all other agents
    agentGainNodes.current.forEach((gain, id) => {
      if (id !== agentId) {
        gain.gain.setTargetAtTime(0.0, audioContextRef.current!.currentTime, 0.1);
      } else {
        gain.gain.setTargetAtTime(1.0, audioContextRef.current!.currentTime, 0.1);
      }
    });
  };

  const startAllChats = async () => {
    log('Starting all chats...');
    for (let index = 0; index < agentsRef.current.length; index++) {
      const agent = agentsRef.current[index];
      if (agent.startSession) {
        try {
          log(`Starting session for ${agent.name}...`);
          await agent.startSession();
          // Wait a bit before starting the next one
          await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (e) {
          console.error(`Failed to start session for ${agent.name}`, e);
          log(`Error starting ${agent.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
        }
      }
    }
    log('All chats started!');
  };

  const setupAnalyzer = (source: AudioNode, agentId: string) => {
    if (!audioContextRef.current) return;
    const analyser = audioContextRef.current.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    
    const data = new Uint8Array(analyser.frequencyBinCount);
    const update = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((a, b) => a + b, 0);
        const avg = sum / data.length;

        // Moderator Logic
        if (avg > SPEAKING_THRESHOLD) {
            lastActiveTimeRef.current = Date.now();
            
            if (!activeSpeakerRef.current) {
                activeSpeakerRef.current = agentId;
                setActiveSpeakerId(agentId);
                
                // Find speaker name
                const speaker = agentsRef.current.find(a => a.id === agentId);
                if (speaker) {
                    log(`${speaker.name} took the floor!`);
                    //broadcastContext(`${speaker.name} has started speaking. Listen to them.`, agentId);
                }
                
                agentGainNodes.current.forEach((gain, id) => {
                    if (id !== agentId) {
                        gain.gain.setTargetAtTime(0.0, audioContextRef.current!.currentTime, 0.1);
                    }
                });
            }
        }

        setAgents((prev) => 
            prev.map((a) => (a.id === agentId ? { ...a, audioLevel: avg, isSpeaking: activeSpeakerRef.current === agentId } : a))
        );
        requestAnimationFrame(update);
    };
    requestAnimationFrame(update);
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* Controls */}
      <div className="flex flex-col items-center gap-4 sticky top-0 bg-white/80 backdrop-blur-sm p-4 z-10 border-b">
        
        {/* Topic Input */}
        <div className="flex flex-wrap justify-center gap-4 w-full max-w-2xl">
            <div className="flex items-center gap-2">
                <label className="font-bold whitespace-nowrap">Topic:</label>
                <input 
                    type="text" 
                    value={topic} 
                    onChange={(e) => setTopic(e.target.value)}
                    className="border rounded px-2 py-1 w-64"
                    placeholder="Enter a topic..."
                />
            </div>
            <div className="flex items-center gap-2">
                <label className="font-bold whitespace-nowrap">Your Name:</label>
                <input 
                    type="text" 
                    value={userName} 
                    onChange={(e) => setUserName(e.target.value)}
                    className="border rounded px-2 py-1 w-32"
                    placeholder="User"
                />
            </div>
        </div>

        <div className="text-xs text-gray-500 italic text-center max-w-lg">
            Tip: Agents are instructed to only speak when spoken to. Start by saying "Hello [Agent Name]"!
        </div>

        {!isAudioInitialized ? (
          <button
            onClick={initializeAudio}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg font-bold shadow-lg hover:bg-blue-700 transition-colors"
          >
            Initialize Audio & Start
          </button>
        ) : (
          <div className="flex gap-4 items-center">
             <div className="text-green-600 font-bold flex items-center gap-2 mr-4">
                <span className="w-3 h-3 bg-green-500 rounded-full animate-pulse"/>
                Audio Active
            </div>
            <button
              onClick={addAgent}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-colors"
            >
              + Add Agent
            </button>
          </div>
        )}
      </div>

      {/* Agents Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 px-4">
        {agents.map((agent) => (
          <div 
            key={agent.id}
            onClick={() => focusAgent(agent.id)}
            className={`flex flex-col bg-white p-4 rounded-xl shadow-md border relative transition-all duration-300 cursor-pointer hover:shadow-lg ${agent.isSpeaking ? 'ring-4 ring-green-500 scale-105 z-10' : ''}`}
          >
            <button 
                onClick={(e) => {
                  e.stopPropagation();
                  removeAgent(agent.id);
                }}
                className="absolute top-2 right-2 text-gray-400 hover:text-red-500 z-20"
                title="Remove Agent"
            >
                ✕
            </button>
            <h2 className="text-lg font-bold text-center mb-2">{agent.name}</h2>
            <AnamPersona
              personaConfig={{
                name: agent.name,
                systemPrompt: agent.systemPrompt,
              }}
              inputStream={agent.inputStream}
              onOutputStreamReady={(stream) => handleOutputStream(agent.id, stream)}
              onClientReady={(client) => handleClientReady(agent.id, client)}
              onStartSessionReady={(startFn) => handleStartSessionReady(agent.id, startFn)}
              muted={true}
            />
            <div className="mt-3">
              <div className="flex justify-between text-xs text-muted-foreground mb-1">
                <span>Output Level</span>
                <span>{Math.round(agent.audioLevel)}</span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-75 ease-out ${agent.isSpeaking ? 'bg-green-500' : 'bg-gray-400'}`}
                  style={{ width: `${Math.min(100, agent.audioLevel * 2)}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Logs */}
      <div className="bg-slate-100 p-4 rounded-lg max-h-40 overflow-y-auto mx-4 text-xs font-mono border">
        <h3 className="font-bold mb-2 sticky top-0 bg-slate-100">System Log</h3>
        {logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </div>
  );
}
