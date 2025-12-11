// Council service for managing multi-agent conversations
// Currently using ElevenLabs Conversational AI for real-time speech-to-speech

export type CouncilConfig = {
  agentId: string;
  maxAgents?: number;
};

// Placeholder for future multi-agent council functionality
export function createCouncilSession(config: CouncilConfig) {
  return {
    id: crypto.randomUUID(),
    agentId: config.agentId,
    maxAgents: config.maxAgents ?? 1,
    createdAt: Date.now(),
  };
}

