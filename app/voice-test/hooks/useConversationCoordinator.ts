import { createContext, useContext, useCallback, useRef, useState } from "react";

export interface AgentMessage {
  agentId: string;
  agentName: string;
  text: string;
  timestamp: number;
}

export interface AudioBroadcast {
  sourceAgentId: string;
  audioData: string; // base64 PCM audio
  timestamp: number;
}

export interface AgentAudioOutput {
  agentId: string;
  audioData: ArrayBuffer; // Raw audio data from agent's response
  timestamp: number;
}

export interface ConversationHistory {
  messages: AgentMessage[];
  addMessage: (message: AgentMessage) => void;
  getContext: () => string;
}

interface TurnState {
  currentSpeaker: string | null;
  isTransitioning: boolean;
  waitingQueue: string[]; // Queue of agents waiting to speak
}

interface ConversationCoordinatorContextValue {
  // Turn management (simplified - just for UI tracking)
  setCurrentSpeaker: (agentId: string | null) => void;
  getCurrentSpeaker: () => string | null;
  
  // Output limiter - only one agent can play audio to user at a time
  requestOutputPermission: (agentId: string, onPermissionGranted?: () => void) => boolean;
  releaseOutputPermission: (agentId: string) => void;
  hasOutputPermission: (agentId: string) => boolean;
  
  // Audio routing - pipe agent outputs to all agent inputs
  broadcastAgentOutput: (sourceAgentId: string, audioData: ArrayBuffer) => void;
  subscribeToAgentOutputs: (agentId: string, callback: (audio: AgentAudioOutput) => void) => () => void;
  
  // Conversation history
  addMessage: (message: AgentMessage) => void;
  getConversationContext: () => string;
  messages: AgentMessage[];
  
  // Agent registration
  registerAgent: (agentId: string, agentName: string) => void;
  unregisterAgent: (agentId: string) => void;
  getRegisteredAgents: () => Array<{ id: string; name: string }>;
}

const ConversationCoordinatorContext = createContext<
  ConversationCoordinatorContextValue | undefined
>(undefined);

export function useConversationCoordinator() {
  const context = useContext(ConversationCoordinatorContext);
  if (!context) {
    throw new Error(
      "useConversationCoordinator must be used within ConversationCoordinatorProvider"
    );
  }
  return context;
}

export function useConversationCoordinatorProvider() {
  const [currentSpeaker, setCurrentSpeakerState] = useState<string | null>(null);
  const [currentOutputAgent, setCurrentOutputAgent] = useState<string | null>(null);
  const currentOutputAgentRef = useRef<string | null>(null); // Synchronous access to current speaker
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const registeredAgents = useRef<Map<string, string>>(new Map());
  const audioOutputSubscribers = useRef<Map<string, (audio: AgentAudioOutput) => void>>(new Map());
  const waitingAgents = useRef<string[]>([]); // Queue of agents waiting for output permission
  const permissionCallbacks = useRef<Map<string, () => void>>(new Map()); // Callbacks to notify when permission is available
  const lastSpeakerEndTime = useRef<number>(0); // Track when the last speaker finished
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Timeout for transition delay
  
  const TRANSITION_DELAY_MS = 800; // 800ms pause between speakers for clarity

  // Register/unregister agents
  const registerAgent = useCallback((agentId: string, agentName: string) => {
    console.log(`📋 [Coordinator] Registering agent: ${agentName} (${agentId})`);
    registeredAgents.current.set(agentId, agentName);
  }, []);

  const unregisterAgent = useCallback((agentId: string) => {
    const agentName = registeredAgents.current.get(agentId);
    console.log(`📋 [Coordinator] Unregistering agent: ${agentName} (${agentId})`);
    registeredAgents.current.delete(agentId);
    audioOutputSubscribers.current.delete(agentId);
    
    // Remove from waiting queue
    waitingAgents.current = waitingAgents.current.filter(id => id !== agentId);
    permissionCallbacks.current.delete(agentId);
    
    // If this agent was speaking, clear speaker
    if (currentSpeaker === agentId) {
      setCurrentSpeakerState(null);
    }
    
    // If this agent had output permission, release it inline (will trigger next in queue)
    if (currentOutputAgentRef.current === agentId) {
      console.log(`🔊 [Coordinator] Output permission released by ${agentName} (unregister)`);
      currentOutputAgentRef.current = null;
      setCurrentOutputAgent(null);
      lastSpeakerEndTime.current = Date.now();
      
      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      // Add a delay before granting permission to next agent
      if (waitingAgents.current.length > 0) {
        const nextAgentId = waitingAgents.current[0];
        const nextAgentName = registeredAgents.current.get(nextAgentId) || nextAgentId;
        console.log(`⏸️ [Coordinator] Pausing ${TRANSITION_DELAY_MS}ms before next speaker: ${nextAgentName}`);
        
        transitionTimeoutRef.current = setTimeout(() => {
          const callback = permissionCallbacks.current.get(nextAgentId);
          if (callback && waitingAgents.current.includes(nextAgentId)) {
            console.log(`🔊 [Coordinator] Granting permission to next agent: ${nextAgentName}`);
            currentOutputAgentRef.current = nextAgentId;
            setCurrentOutputAgent(nextAgentId);
            waitingAgents.current.shift();
            permissionCallbacks.current.delete(nextAgentId);
            callback();
          }
          transitionTimeoutRef.current = null;
        }, TRANSITION_DELAY_MS);
      }
    }
  }, [currentSpeaker]);

  const getRegisteredAgents = useCallback(() => {
    return Array.from(registeredAgents.current.entries()).map(([id, name]) => ({
      id,
      name,
    }));
  }, []);

  // Simplified turn management - just for UI tracking
  const setCurrentSpeaker = useCallback((agentId: string | null) => {
    setCurrentSpeakerState(agentId);
  }, []);

  const getCurrentSpeaker = useCallback(() => {
    return currentSpeaker;
  }, [currentSpeaker]);

  // Output limiter - only one agent can play audio to the user at a time
  const requestOutputPermission = useCallback((agentId: string, onPermissionGranted?: () => void) => {
    const agentName = registeredAgents.current.get(agentId) || agentId;
    const currentSpeakerId = currentOutputAgentRef.current;
    
    console.log(`🎯 [Coordinator] ${agentName} requesting permission. Current speaker: ${currentSpeakerId ? registeredAgents.current.get(currentSpeakerId) : 'none'}`);
    
    // Use ref for synchronous check - prevents race conditions
    if (currentSpeakerId === null || currentSpeakerId === agentId) {
      console.log(`✅ [Coordinator] Output permission GRANTED to ${agentName}`);
      currentOutputAgentRef.current = agentId;
      setCurrentOutputAgent(agentId);
      
      // Remove from waiting queue if present
      waitingAgents.current = waitingAgents.current.filter(id => id !== agentId);
      permissionCallbacks.current.delete(agentId);
      
      return true;
    }
    
    // Add to waiting queue if callback provided
    if (onPermissionGranted && !waitingAgents.current.includes(agentId)) {
      console.log(`⏳ [Coordinator] ${agentName} added to waiting queue (position ${waitingAgents.current.length + 1})`);
      waitingAgents.current.push(agentId);
      permissionCallbacks.current.set(agentId, onPermissionGranted);
    }
    
    const currentAgentName = registeredAgents.current.get(currentSpeakerId) || currentSpeakerId;
    console.log(`❌ [Coordinator] Output permission DENIED to ${agentName} - ${currentAgentName} is currently speaking`);
    return false;
  }, []);

  const releaseOutputPermission = useCallback((agentId: string) => {
    const agentName = registeredAgents.current.get(agentId) || agentId;
    
    if (currentOutputAgentRef.current === agentId) {
      console.log(`🔊 [Coordinator] Output permission released by ${agentName}`);
      currentOutputAgentRef.current = null;
      setCurrentOutputAgent(null);
      lastSpeakerEndTime.current = Date.now();
      
      // Clear any existing transition timeout
      if (transitionTimeoutRef.current) {
        clearTimeout(transitionTimeoutRef.current);
      }
      
      // Add a delay before granting permission to next agent
      // This creates a natural pause between speakers
      if (waitingAgents.current.length > 0) {
        const nextAgentId = waitingAgents.current[0];
        const nextAgentName = registeredAgents.current.get(nextAgentId) || nextAgentId;
        console.log(`⏸️ [Coordinator] Pausing ${TRANSITION_DELAY_MS}ms before next speaker: ${nextAgentName}`);
        
        transitionTimeoutRef.current = setTimeout(() => {
          const callback = permissionCallbacks.current.get(nextAgentId);
          if (callback && waitingAgents.current.includes(nextAgentId)) {
            console.log(`🔊 [Coordinator] Granting permission to next agent: ${nextAgentName}`);
            currentOutputAgentRef.current = nextAgentId;
            setCurrentOutputAgent(nextAgentId);
            waitingAgents.current.shift();
            permissionCallbacks.current.delete(nextAgentId);
            callback();
          }
          transitionTimeoutRef.current = null;
        }, TRANSITION_DELAY_MS);
      }
    }
  }, []);

  const hasOutputPermission = useCallback((agentId: string) => {
    return currentOutputAgentRef.current === agentId;
  }, []);

  // Audio routing - broadcast agent outputs to all other agents
  const broadcastAgentOutput = useCallback((sourceAgentId: string, audioData: ArrayBuffer) => {
    const output: AgentAudioOutput = {
      agentId: sourceAgentId,
      audioData,
      timestamp: Date.now(),
    };

    const sourceName = registeredAgents.current.get(sourceAgentId) || sourceAgentId;
    console.log(`📢 [Coordinator] Broadcasting audio from ${sourceName} to all agents`);

    // Send to ALL subscribers (including the source agent)
    // Each agent will route this to their microphone input
    audioOutputSubscribers.current.forEach((callback, subscriberId) => {
      callback(output);
    });
  }, []);

  const subscribeToAgentOutputs = useCallback(
    (agentId: string, callback: (audio: AgentAudioOutput) => void) => {
      audioOutputSubscribers.current.set(agentId, callback);
      
      // Return unsubscribe function
      return () => {
        audioOutputSubscribers.current.delete(agentId);
      };
    },
    []
  );

  // Conversation history management
  const addMessage = useCallback((message: AgentMessage) => {
    console.log(`💬 [Coordinator] Message from ${message.agentName}: ${message.text.substring(0, 50)}...`);
    setMessages((prev) => [...prev, message]);
  }, []);

  const getConversationContext = useCallback(() => {
    if (messages.length === 0) {
      return "This is the start of the conversation.";
    }

    // Get the last 10 messages for context
    const recentMessages = messages.slice(-10);
    const context = recentMessages
      .map((msg) => `${msg.agentName}: ${msg.text}`)
      .join("\n");

    return `Previous conversation:\n${context}`;
  }, [messages]);

  return {
    setCurrentSpeaker,
    getCurrentSpeaker,
    requestOutputPermission,
    releaseOutputPermission,
    hasOutputPermission,
    broadcastAgentOutput,
    subscribeToAgentOutputs,
    addMessage,
    getConversationContext,
    messages,
    registerAgent,
    unregisterAgent,
    getRegisteredAgents,
  };
}

export { ConversationCoordinatorContext };
