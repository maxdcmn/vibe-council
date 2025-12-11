export interface AnamPersonaConfig {
  name: string;
  personaId: string;
  llmId: string;
  systemPrompt: string;
}

export const ANAM_PERSONAS: Record<string, AnamPersonaConfig> = {
  cara: {
    name: 'Palpatine',
    personaId: '229b7c75-f394-4637-a90f-7fa874d14342',
    llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
    systemPrompt:
      'You are Cara, a helpful and friendly AI assistant. Keep responses conversational and concise.',
  },
  // Add more personas here as needed
  // Example:
  // anotherPersona: {
  //   name: 'Another Persona',
  //   personaId: '...',
  //   llmId: '...',
  //   systemPrompt: '...',
  // },
};

export const DEFAULT_PERSONA_ID = 'cara';

export function getPersonaConfig(personaId?: string): AnamPersonaConfig {
  if (!personaId) {
    return ANAM_PERSONAS[DEFAULT_PERSONA_ID];
  }
  return ANAM_PERSONAS[personaId] || ANAM_PERSONAS[DEFAULT_PERSONA_ID];
}
