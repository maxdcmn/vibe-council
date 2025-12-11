"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ArrowRight, Plus, X } from "lucide-react";

import CircleScene from "@/components/three/circle-scene";
import AnamPersona from "@/components/AnamPersona";
import { Button } from "@/components/ui/button";
import { ANAM_PERSONAS } from "@/lib/anam-personas";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

interface Agent {
  id: string;
  name: string;
  systemPrompt: string;
  inputStream?: MediaStream;
  audioLevel: number;
  isSpeaking: boolean;
  client?: any;
  startSession?: () => Promise<void>;
  color: string;
  personaKey?: string;
}

const SYSTEM_PROMPT_TEMPLATE = (agentName: string, userName: string, topic: string) => `
You are ${agentName}.
You are in a group conversation (The Council) with a human user named ${userName} and other AI agents.
Your Goal: Discuss the topic "${topic || 'General Chat'}".

PROTOCOL:
1. LISTEN: Do not interrupt. Wait for the current speaker to finish.
2. ADDRESS: When you speak, address others by name (e.g., "That's a good point, ${userName}..." or "I disagree, Optimist...").
3. PASS THE MIC: End your turn by asking a question or inviting someone else to speak.
4. BE CONCISE: Keep your responses short (under 2 sentences) to allow flow.
5. STAY IN CHARACTER.
`;

// Generate colors for personas (using a color palette)
const PERSONA_COLORS = [
  "#ff4444", "#4488ff", "#44ff88", "#ffcc00", "#ff44ff", "#ff8844"
];

// Convert ANAM_PERSONAS to the format expected by the UI
const PERSONAS = Object.entries(ANAM_PERSONAS).map(([id, config], index) => ({
  id,
  name: config.name,
  basePrompt: config.systemPrompt,
  color: PERSONA_COLORS[index % PERSONA_COLORS.length],
  personaId: config.personaId,
  llmId: config.llmId,
}));

const scenarios = [
  { value: "life", label: "Life decisions" },
  { value: "career", label: "Career advice" },
  { value: "interview", label: "Job interview practice" },
  { value: "relationship", label: "Relationship talk" },
  { value: "debate", label: "Friendly debate" },
  { value: "custom", label: "Custom scenario" },
];

const getScenarioTopic = (scenario: string, customText: string) => {
  const scenarioMap: Record<string, string> = {
    life: "Life Decisions and Personal Growth",
    career: "Career Development and Professional Advice",
    interview: "Job Interview Preparation",
    relationship: "Relationship Dynamics and Communication",
    debate: "Friendly Debate and Discussion",
  };
  return scenario === "custom" ? customText : scenarioMap[scenario] || "General Discussion";
};

export default function Index() {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [arrowIndex, setArrowIndex] = useState<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [customScenario, setCustomScenario] = useState("");
  const [selectedPersonas, setSelectedPersonas] = useState<string[]>([]);
  
  // Council State
  const [agents, setAgents] = useState<Agent[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [isAudioInitialized, setIsAudioInitialized] = useState(false);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [topic, setTopic] = useState('');
  const [connectedSessions, setConnectedSessions] = useState<Set<string>>(new Set());

  // Audio Graph Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const userSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const agentsRef = useRef<Agent[]>([]);
  
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

  // Sync focusIndex with activeSpeakerId
  useEffect(() => {
    if (activeSpeakerId) {
      const agentIndex = agentsRef.current.findIndex(a => a.id === activeSpeakerId);
      if (agentIndex !== -1) {
        setFocusIndex(agentIndex);
        setArrowIndex(agentIndex);
      }
    }
  }, [activeSpeakerId]);

  const togglePersona = (personaId: string) => {
    setSelectedPersonas(prev => {
      if (prev.includes(personaId)) {
        return prev.filter(id => id !== personaId);
      } else if (prev.length < 6) {
        return [...prev, personaId];
      }
      return prev;
    });
  };

  const handleGetStarted = async () => {
    if (selectedPersonas.length === 0) return;
    
    const finalTopic = getScenarioTopic(selectedScenario, customScenario);
    setTopic(finalTopic);
    setIsExiting(true);
    setTimeout(async () => {
      setShowOverlay(false);
      // Initialize audio after overlay closes
      await initializeAudio();
    }, 300);
  };

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
      log('Audio initialized. Adding selected agents...');
      
      // Add selected personas
      for (let i = 0; i < selectedPersonas.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500));
        addAgent(i);
      }

      startModeratorLoop();

    } catch (error) {
      console.error('Failed to setup audio:', error);
      log(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const startModeratorLoop = () => {
    const loop = () => {
      const now = Date.now();
      
      if (activeSpeakerRef.current && (now - lastActiveTimeRef.current > SILENCE_TIMEOUT)) {
        activeSpeakerRef.current = null;
        setActiveSpeakerId(null);
        
        agentGainNodes.current.forEach(gain => {
          gain.gain.setTargetAtTime(1.0, audioContextRef.current!.currentTime, 0.1);
        });
      }

      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  };

  const addAgent = (personaIndex?: number) => {
    if (!audioContextRef.current || !userSourceRef.current) {
      log('Please initialize audio first.');
      return;
    }

    const id = Math.random().toString(36).substring(7);
    const personaId = personaIndex !== undefined 
      ? selectedPersonas[personaIndex]
      : selectedPersonas[agents.length % selectedPersonas.length];
    const persona = PERSONAS.find(p => p.id === personaId) || PERSONAS[0];
    
    log(`Adding agent: ${persona.name}`);

    const inputDest = audioContextRef.current.createMediaStreamDestination();
    agentInputDestinations.current.set(id, inputDest);

    userSourceRef.current.connect(inputDest);

    agentGainNodes.current.forEach((gainNode) => {
      gainNode.connect(inputDest);
    });

    setAgents((prev) => {
      const newAgents = [
        ...prev,
        {
          id,
          name: persona.name,
          systemPrompt: persona.basePrompt + SYSTEM_PROMPT_TEMPLATE(persona.name, userName, topic),
          inputStream: inputDest.stream,
          audioLevel: 0,
          isSpeaking: false,
          color: persona.color,
          personaKey: persona.id,
        },
      ];
      agentsRef.current = newAgents;
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
      return newAgents;
    });
  };

  const handleClientReady = (id: string, client: any) => {
    setAgents(prev => {
      const newAgents = prev.map(a => a.id === id ? { ...a, client } : a);
      agentsRef.current = newAgents;
      return newAgents;
    });
  };

  const sessionsStartedRef = useRef(new Set<string>());

  const handleStartSessionReady = useCallback((id: string, startFn: () => Promise<void>) => {
    setAgents(prev => {
      const newAgents = prev.map(a => a.id === id ? { ...a, startSession: startFn } : a);
      agentsRef.current = newAgents;
      return newAgents;
    });
  }, []);

  const startAgentSession = async (agentId: string) => {
    const agent = agentsRef.current.find(a => a.id === agentId);
    if (!agent || !agent.startSession || sessionsStartedRef.current.has(agentId)) {
      return;
    }

    try {
      log(`Starting session for ${agent.name}...`);
      await agent.startSession();
      sessionsStartedRef.current.add(agentId);
      setConnectedSessions(new Set(sessionsStartedRef.current));
      log(`✓ ${agent.name} session started`);
    } catch (e) {
      console.error(`Failed to start session for ${agent.name}:`, e);
      log(`✗ Error starting ${agent.name}: ${e instanceof Error ? e.message : 'Unknown error'}`);
    }
  };

  const startAllAgentSessions = async () => {
    log('Starting all agent sessions...');
    for (const agent of agentsRef.current) {
      if (agent.startSession && !sessionsStartedRef.current.has(agent.id)) {
        await startAgentSession(agent.id);
        // Wait between starting each session
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
    }
    log('All sessions started!');
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

      if (avg > SPEAKING_THRESHOLD) {
        lastActiveTimeRef.current = Date.now();
        
        if (!activeSpeakerRef.current) {
          activeSpeakerRef.current = agentId;
          setActiveSpeakerId(agentId);
          
          const speaker = agentsRef.current.find(a => a.id === agentId);
          if (speaker) {
            log(`${speaker.name} took the floor!`);
            broadcastContext(`${speaker.name} has started speaking. Listen to them.`, agentId);
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

  const broadcastContext = (message: string, excludeId?: string) => {
    agentsRef.current.forEach(agent => {
      if (agent.id !== excludeId && agent.client) {
        try {
          agent.client.talk(`[System Event: ${message}]`);
        } catch (e) {
          console.error(`Failed to broadcast to ${agent.name}`, e);
        }
      }
    });
  };

  const focusAgent = (agentId: string) => {
    activeSpeakerRef.current = agentId;
    setActiveSpeakerId(agentId);
    lastActiveTimeRef.current = Date.now();
    
    const speaker = agentsRef.current.find(a => a.id === agentId);
    if (speaker) {
      log(`Manually focused: ${speaker.name}`);
      broadcastContext(`${speaker.name} has been given the floor. Listen to them.`, agentId);
    }
    
    agentGainNodes.current.forEach((gain, id) => {
      if (id !== agentId) {
        gain.gain.setTargetAtTime(0.0, audioContextRef.current!.currentTime, 0.1);
      } else {
        gain.gain.setTargetAtTime(1.0, audioContextRef.current!.currentTime, 0.1);
      }
    });
  };

  const handleOutputStream = useCallback((agentId: string, stream: MediaStream) => {
    if (!audioContextRef.current) return;
    
    if (agentOutputSources.current.has(agentId)) return;

    log(`Received audio output from agent ${agentId}`);
    const ctx = audioContextRef.current;
    const source = ctx.createMediaStreamSource(stream);
    agentOutputSources.current.set(agentId, source);

    const gainNode = ctx.createGain();
    gainNode.gain.value = 1.0;
    agentGainNodes.current.set(agentId, gainNode);

    source.connect(gainNode);
    gainNode.connect(ctx.destination);

    agentInputDestinations.current.forEach((dest, otherId) => {
      if (otherId !== agentId) {
        gainNode.connect(dest);
      }
    });

    setupAnalyzer(source, agentId);

    // Connect video stream to 3D texture video element
    const videoElement = document.getElementById(`video-3d-${agentId}`) as HTMLVideoElement;
    if (videoElement) {
      console.log(`Setting video stream for agent ${agentId}`, stream);
      videoElement.srcObject = stream;
      videoElement.play().then(() => {
        log(`✓ Video playing for agent ${agentId}`);
        console.log(`Video element ready:`, videoElement.readyState, videoElement.videoWidth, videoElement.videoHeight);
      }).catch(e => {
        console.error('Error playing video:', e);
        log(`✗ Video play error for agent ${agentId}`);
      });
    } else {
      console.error(`Video element not found: video-3d-${agentId}`);
      log(`✗ Video element not found for agent ${agentId}`);
    }
  }, []);

  const handleFocusChange = (value: string) => {
    if (value === "none") {
      setFocusIndex(null);
    } else {
      const index = parseInt(value, 10);
      setFocusIndex(index);
      if (agents[index]) {
        focusAgent(agents[index].id);
      }
    }
  };

  const handleArrowChange = (value: string) => {
    if (value === "none") {
      setArrowIndex(null);
    } else {
      setArrowIndex(parseInt(value, 10));
    }
  };

  const scenarioIsReady =
    selectedScenario &&
    (selectedScenario !== "custom" || customScenario.trim().length > 0) &&
    selectedPersonas.length > 0;


  return (
    <main className="scene-container relative h-screen w-screen overflow-hidden bg-black text-foreground">
      <CircleScene 
        focusIndex={focusIndex} 
        arrowIndex={arrowIndex}
        figureCount={agents.length || 5}
        figureColors={agents.map(a => a.color)}
        videoElementIds={agents.map(a => `video-3d-${a.id}`)}
        figureNames={agents.map(a => a.name)}
      />

      {showOverlay && (
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center backdrop-blur-3xl transition-all duration-300 ${
            isExiting ? "opacity-0 backdrop-blur-none" : "opacity-100"
          }`}
        >
          <div
            className={`max-w-lg px-8 text-center transition-all duration-300 ${
              isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <h1 className="mb-3 font-sans text-5xl font-thin tracking-tight text-foreground">
              Vibe Council
            </h1>

            <p className="mb-6 font-sans text-base leading-relaxed text-muted-foreground">
              Pick a scenario and select your council members.
            </p>

            <div className="mb-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  placeholder="Your name..."
                  className="h-11 flex-1 border-border/30 bg-background/80 px-4 text-base backdrop-blur-sm"
                />
              </div>

              <Select
                value={selectedScenario}
                onValueChange={setSelectedScenario}
              >
                <SelectTrigger className="flex-1 h-11 w-full px-4 text-base">
                  <SelectValue placeholder="Choose a scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.value} value={scenario.value}>
                      {scenario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {selectedScenario === "custom" && (
                <Input
                  placeholder="Describe your scenario..."
                  value={customScenario}
                  onChange={(e) => setCustomScenario(e.target.value)}
                  className="h-11 w-full border-border/30 bg-background/80 px-4 text-base backdrop-blur-sm"
                />
              )}

              {/* Persona Selector */}
              <div className="mt-4">
                <p className="mb-3 text-sm text-muted-foreground">
                  Select council members (max 6):
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {PERSONAS.map((persona) => (
                    <button
                      key={persona.id}
                      onClick={() => togglePersona(persona.id)}
                      disabled={!selectedPersonas.includes(persona.id) && selectedPersonas.length >= 6}
                      className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-all ${
                        selectedPersonas.includes(persona.id)
                          ? 'border-white bg-white/10 text-white'
                          : 'border-border/30 bg-background/50 text-muted-foreground hover:bg-background/80'
                      } disabled:cursor-not-allowed disabled:opacity-40`}
                    >
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: persona.color }}
                      />
                      <span className="flex-1">{persona.name}</span>
                      {selectedPersonas.includes(persona.id) && (
                        <span className="text-xs">✓</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Start Council Meeting Button */}
              <Button
                onClick={handleGetStarted}
                disabled={!scenarioIsReady}
                className="w-full h-11 mt-4 bg-black text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Start Council Meeting
              </Button>
            </div>
          </div>
        </div>
      )}

      {!showOverlay && isAudioInitialized && (
        <>
          {/* Top Controls */}
          <div className="absolute right-4 top-4 z-10 flex gap-2">
            <Select
              value={focusIndex !== null ? focusIndex.toString() : "none"}
              onValueChange={handleFocusChange}
            >
              <SelectTrigger className="w-[140px] bg-background/80 backdrop-blur-sm">
                <SelectValue placeholder="Focus" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Overview</SelectItem>
                {agents.map((agent, index) => (
                  <SelectItem key={agent.id} value={index.toString()}>
                    <div className="flex items-center gap-2">
                      <div
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: agent.color }}
                      />
                      {agent.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => addAgent()}
              disabled={agents.length >= 6}
              className="bg-background/80 backdrop-blur-sm hover:bg-background/90"
              size="icon"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {/* Video elements for 3D texture - must be visible for WebGL */}
          <div style={{ 
            position: 'fixed', 
            display: 'none',
            bottom: '10px', 
            right: '10px', 
         
            flexDirection: 'column', 
            gap: '4px',
            zIndex: 9999,
            pointerEvents: 'none'
          }}>
            {agents.map((agent) => (
              <video
                key={`video-${agent.id}`}
                id={`video-3d-${agent.id}`}
                autoPlay
                playsInline
                muted
                crossOrigin="anonymous"
                style={{ 
                  width: '80px', 
                  height: '60px',
                  border: '1px solid rgba(255,255,255,0.3)',
                  borderRadius: '4px',
                  opacity: 0.3
                }}
              />
            ))}
          </div>

          {/* Hidden Agents Panel for AnamPersona components */}
              <div className="hidden">
            {agents.map((agent) => (
              <div key={agent.id} id={`agent-container-${agent.id}`}>
                <AnamPersona
                  personaConfig={{
                    name: agent.name,
                    systemPrompt: agent.systemPrompt,
                  }}
                  personaId={agent.personaKey}
                  inputStream={agent.inputStream}
                  onOutputStreamReady={(stream) => handleOutputStream(agent.id, stream)}
                  onClientReady={(client) => handleClientReady(agent.id, client)}
                  onStartSessionReady={(startFn) => handleStartSessionReady(agent.id, startFn)}
                  muted={true}
                />
              </div>
            ))}
          </div>

          {/* Agent Info Panel */}
          <div className="absolute bottom-4 left-4 right-4 z-10">
            <div className="flex flex-col items-center gap-3">
              {/* Start All Button */}
              {!agents.every(a => connectedSessions.has(a.id)) && (
                <Button
                  onClick={startAllAgentSessions}
                  disabled={agents.every(a => connectedSessions.has(a.id))}
                  className="bg-green-600 hover:bg-green-700 text-white disabled:opacity-50"
                >
                  Start All Chats
                </Button>
              )}

              <div className="flex flex-wrap justify-center gap-3">
                {agents.map((agent, index) => (
                  <div
                    key={agent.id}
                    className={`relative flex items-center gap-2 bg-background/80 backdrop-blur-sm rounded-lg px-4 py-2 transition-all duration-300 ${
                      agent.isSpeaking ? 'ring-2 ring-green-500 scale-105' : ''
                    }`}
                  >
                    <button
                      onClick={() => focusAgent(agent.id)}
                      className="flex items-center gap-2 cursor-pointer hover:opacity-80"
                    >
                      <div
                        className={`h-3 w-3 rounded-full ${connectedSessions.has(agent.id) ? 'animate-pulse' : ''}`}
                        style={{ backgroundColor: agent.color }}
                      />
                      <span className="text-sm font-bold">{agent.name}</span>
                      <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden">
                        <div
                          className={`h-full transition-all duration-75 ${
                            agent.isSpeaking ? 'bg-green-500' : 'bg-muted-foreground/50'
                          }`}
                          style={{ width: `${Math.min(100, agent.audioLevel * 2)}%` }}
                        />
                      </div>
                    </button>

                    <Button
                      onClick={() => startAgentSession(agent.id)}
                      disabled={connectedSessions.has(agent.id)}
                      size="sm"
                      className="h-7 px-2 text-xs bg-blue-600 hover:bg-blue-700 disabled:opacity-50 hidden"
                    >
                      {connectedSessions.has(agent.id) ? '✓ Connected' : 'Connect'}
                    </Button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeAgent(agent.id);
                      }}
                      className="ml-1 text-muted-foreground hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* System Log */}
          <div className="absolute bottom-4 left-4 max-w-xs max-h-32 overflow-y-auto bg-background/80 backdrop-blur-sm rounded-lg p-3 text-xs font-mono hidden">
            <h4 className="font-bold mb-1 sticky top-0 bg-background/80">System Log</h4>
            {logs.slice(-10).map((l, i) => (
              <div key={i} className="text-muted-foreground">{l}</div>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
