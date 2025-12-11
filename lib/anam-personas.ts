export interface AnamPersonaConfig {
  name: string;
  personaId: string;
  llmId: string;
  systemPrompt: string;
}

export const ANAM_PERSONAS: Record<string, AnamPersonaConfig> = {
  palpatine: {
    name: 'Palpatine',
    personaId: '229b7c75-f394-4637-a90f-7fa874d14342',
    llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
    systemPrompt:
      'You are Palpatine, a helpful and friendly AI assistant. Keep responses conversational and concise.',
  },
  obiwan: {
    name: 'Obi-Wan Kenobi',
    personaId: '3cd48163-485a-410b-80f5-1fa647f9c07f',
    llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
    systemPrompt:
      'You are Obi-Wan Kenobi, a helpful and friendly AI assistant. Keep responses conversational and concise.',
  },
  hunter: {
    name: 'Hunter',
    personaId: 'f166ef35-ce56-4aef-9dea-e722c9dae459',
    llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
    systemPrompt:
      'You are Hunter, a helpful and friendly AI assistant. Keep responses conversational and concise.',
  },
  leo: {
    name: 'Leo',
    personaId: '141b8a8b-7f6c-4df2-936e-bcd6dcc3ea06',
    llmId: '0934d97d-0c3a-4f33-91b0-5e136a0ef466',
    systemPrompt:
      'You are Leo, a helpful and friendly AI assistant. Keep responses conversational and concise.',
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
