# Multi-Agent Voice System

A clean, modular implementation of ElevenLabs Conversational AI that supports multiple voice agents connected simultaneously.

## 🎯 Features

- ✅ **Multiple Agents**: Connect multiple voice agents at the same time
- ✅ **Independent Connections**: Each agent has its own WebSocket connection
- ✅ **Clean Architecture**: Separated concerns with custom hooks and components
- ✅ **Real-time Audio**: Native speech-to-speech with ultra-low latency
- ✅ **Interruption Support**: Interrupt agents mid-sentence
- ✅ **Mute Control**: Individual mute control per agent
- ✅ **Type-Safe**: Full TypeScript support

## 📁 Project Structure

```
app/voice-test/
├── page.tsx                    # Main page with multi-agent management
├── components/
│   └── VoiceAgent.tsx         # Individual agent component
└── hooks/
    ├── index.ts               # Hook exports
    ├── useAudioPlayer.ts      # Audio playback management
    ├── useAudioRecorder.ts    # Microphone capture management
    └── useVoiceAgent.ts       # WebSocket & agent state management
```

## 🏗️ Architecture

### Custom Hooks

#### `useAudioPlayer`
Manages audio playback from the agent:
- Decodes base64 PCM16 audio from ElevenLabs
- Queues audio chunks for smooth playback
- Handles Web Audio API context
- Provides playback state and queue management

#### `useAudioRecorder`
Manages microphone capture:
- Captures audio from user's microphone
- Converts to PCM16 format for ElevenLabs
- Provides mute/unmute functionality
- Handles media stream lifecycle

#### `useVoiceAgent`
Orchestrates the complete agent experience:
- Manages WebSocket connection to ElevenLabs
- Coordinates audio player and recorder
- Handles conversation state (idle/listening/speaking)
- Processes incoming messages and events
- Provides connection state management

### Components

#### `VoiceAgent`
A self-contained agent UI component:
- Connection controls (connect/disconnect)
- Mute toggle
- Status indicators
- Debug information
- Remove button (when multiple agents exist)

#### `VoiceTestPage`
Main page that manages multiple agents:
- Add/remove agents dynamically
- Grid layout for multiple agents
- Instructions and technical details
- Agent naming (Alpha, Beta, Gamma, etc.)

## 🚀 Usage

### Single Agent
```tsx
import { VoiceAgent } from "./components/VoiceAgent";

<VoiceAgent 
  agentId="1" 
  agentName="Agent Alpha" 
/>
```

### Multiple Agents
```tsx
const agents = [
  { id: "1", name: "Agent Alpha" },
  { id: "2", name: "Agent Beta" },
  { id: "3", name: "Agent Gamma" },
];

{agents.map((agent) => (
  <VoiceAgent
    key={agent.id}
    agentId={agent.id}
    agentName={agent.name}
    onRemove={() => removeAgent(agent.id)}
    canRemove={agents.length > 1}
  />
))}
```

### Using Hooks Directly
```tsx
import { useVoiceAgent } from "./hooks";

function MyComponent() {
  const {
    connectionState,
    conversationState,
    connect,
    disconnect,
    toggleMute,
  } = useVoiceAgent({ agentName: "My Agent" });

  // Use the agent...
}
```

## 🔧 How It Works

### Audio Flow

1. **Microphone Capture** (`useAudioRecorder`)
   - Captures audio at 16kHz mono
   - Converts Float32 → Int16 (PCM16)
   - Encodes to base64
   - Sends to WebSocket

2. **WebSocket Communication** (`useVoiceAgent`)
   - Establishes connection to ElevenLabs
   - Sends user audio chunks
   - Receives agent audio responses
   - Handles conversation events

3. **Audio Playback** (`useAudioPlayer`)
   - Receives base64 audio from agent
   - Decodes to PCM16
   - Converts Int16 → Float32
   - Queues and plays through Web Audio API

### State Management

Each agent independently manages:
- **Connection State**: disconnected → connecting → connected → error
- **Conversation State**: idle → listening ↔ speaking
- **Audio State**: muted/unmuted, playing/idle

### Multi-Agent Behavior

When multiple agents are connected:
- All agents receive the same microphone input
- Each agent processes independently
- Responses can overlap (all agents speak simultaneously)
- Each agent can be muted individually
- Connections are independent (one can fail without affecting others)

## 🎨 UI/UX Features

- **Status Indicators**: Color-coded connection states
- **Real-time Feedback**: Visual indicators for listening/speaking
- **Debug Info**: Audio context state, queue length, playback status
- **Responsive Grid**: Adapts to screen size (1-3 columns)
- **Dark Mode**: Full dark mode support
- **Accessibility**: Proper ARIA labels and keyboard navigation

## 🔐 Security & Performance

- **Signed URLs**: Temporary WebSocket URLs from server-side API
- **No API Key Exposure**: Keys stay on the server
- **Efficient Audio**: Minimal latency with direct PCM processing
- **Memory Management**: Proper cleanup on unmount
- **Error Handling**: Graceful degradation on failures

## 🐛 Debugging

Each agent shows debug information when connected:
- Audio context state
- Sample rate
- Queue length
- Playback status

Check browser console for detailed logs:
- `[Agent Name] WebSocket connected`
- `[Agent Name] Message type: ...`
- `[Agent Name] Conversation started: ...`

## 🚧 Future Enhancements

- [ ] Persist agent configurations
- [ ] Custom agent personalities/prompts
- [ ] Conversation transcripts
- [ ] Agent-to-agent communication
- [ ] Voice activity detection (VAD)
- [ ] Audio visualization
- [ ] Recording/playback of conversations
- [ ] Different ElevenLabs agents per instance

## 📝 Notes

- HTTPS required for microphone access in production
- Each agent uses the same ElevenLabs agent ID (configurable in future)
- Audio is captured once and sent to all connected agents
- Agents respond independently and simultaneously
