# Voice Agent Setup Guide

This project uses **ElevenLabs Conversational AI** for native speech-to-speech voice conversations. No TTS involved - just pure real-time conversational AI.

## Prerequisites

1. **ElevenLabs Account**: Sign up at [elevenlabs.io](https://elevenlabs.io)
2. **API Key**: Get your API key from [Settings > API Keys](https://elevenlabs.io/app/settings/api-keys)
3. **Conversational AI Agent**: Create an agent at [Conversational AI](https://elevenlabs.io/app/conversational-ai)

## Setup Steps

### 1. Create Your Conversational AI Agent

1. Go to [ElevenLabs Conversational AI](https://elevenlabs.io/app/conversational-ai)
2. Click "Create Agent"
3. Configure your agent:
   - **Name**: Give it a name (e.g., "Council Agent")
   - **Voice**: Choose a voice from the library
   - **System Prompt**: Define the agent's personality and behavior
   - **First Message**: What the agent says when the conversation starts
   - **Language**: Select the language(s) your agent will speak
4. Save your agent and copy the **Agent ID**

### 2. Configure Environment Variables

Create a `.env.local` file in the project root:

```bash
ELEVENLABS_API_KEY=your_api_key_here
ELEVENLABS_AGENT_ID=your_agent_id_here
```

### 3. Run the Development Server

```bash
pnpm dev
```

### 4. Test the Voice Agent

1. Navigate to [http://localhost:3000/voice-test](http://localhost:3000/voice-test)
2. Click "Start Conversation"
3. Allow microphone access when prompted
4. Start speaking! The agent will respond in real-time

## How It Works

### Architecture

```
Browser (WebSocket) <-> Next.js API Route <-> ElevenLabs Conversational AI
```

1. **Client requests signed URL**: The browser requests a WebSocket signed URL from `/api/voice/conversation`
2. **Server generates signed URL**: The API route uses the ElevenLabs SDK to generate a temporary signed URL
3. **WebSocket connection**: The browser establishes a WebSocket connection directly to ElevenLabs
4. **Real-time audio streaming**: 
   - User's microphone audio is captured and sent to ElevenLabs
   - Agent's audio responses are received and played back
   - All processing happens in real-time with ultra-low latency

### Key Features

- ✅ **Native Speech-to-Speech**: No separate STT/TTS steps
- ✅ **Ultra-Low Latency**: Real-time conversation with minimal delay
- ✅ **Interruption Support**: Users can interrupt the agent mid-sentence
- ✅ **High-Quality Audio**: 16kHz PCM audio for clear conversations
- ✅ **WebSocket-Based**: Efficient bidirectional communication

## Customization

### Agent Personality

Edit your agent's system prompt in the ElevenLabs dashboard to change:
- Personality and tone
- Knowledge domain
- Response style
- Conversation flow

### Voice Selection

Choose from ElevenLabs' extensive voice library:
- Professional voices
- Character voices
- Multilingual voices
- Custom cloned voices (with proper consent)

## Troubleshooting

### "Failed to get signed URL"
- Check that your `ELEVENLABS_API_KEY` is correct
- Verify your API key has access to Conversational AI

### "Failed to initialize conversation"
- Ensure your `ELEVENLABS_AGENT_ID` is correct
- Verify the agent exists and is active in your ElevenLabs account

### Microphone not working
- Check browser permissions for microphone access
- Try HTTPS (required for microphone access in production)
- Test with a different browser

### Audio playback issues
- Check browser console for errors
- Ensure your browser supports Web Audio API
- Try refreshing the page

## Production Deployment

### HTTPS Required
Microphone access requires HTTPS in production. Deploy to:
- Vercel (automatic HTTPS)
- Netlify (automatic HTTPS)
- Any hosting with SSL certificate

### Environment Variables
Set the same environment variables in your hosting platform:
- `ELEVENLABS_API_KEY`
- `ELEVENLABS_AGENT_ID`

## API Reference

### GET `/api/voice/conversation`

Returns a signed WebSocket URL for connecting to ElevenLabs Conversational AI.

**Response:**
```json
{
  "signedUrl": "wss://api.elevenlabs.io/v1/convai/conversation?agent_id=xxx&signed_url_token=yyy"
}
```

The signed URL includes a temporary token that expires after a short period (typically 5 minutes).

## WebSocket Protocol

### Sending Audio (Client → ElevenLabs)

```json
{
  "user_audio_chunk": "base64_encoded_pcm16_audio"
}
```

### Receiving Audio (ElevenLabs → Client)

```json
{
  "audio": "base64_encoded_audio",
  "alignment": {
    "char_start_times_ms": [0, 100, 200],
    "chars_durations_ms": [100, 100, 100],
    "chars": ["H", "e", "l"]
  }
}
```

### Conversation Events

```json
{
  "type": "conversation_initiation_metadata",
  "conversation_initiation_metadata_event": {
    "conversation_id": "uuid"
  }
}
```

## Resources

- [ElevenLabs Conversational AI Docs](https://elevenlabs.io/docs/conversational-ai/overview)
- [ElevenLabs API Reference](https://elevenlabs.io/docs/api-reference/conversational-ai)
- [WebSocket Protocol Details](https://elevenlabs.io/docs/conversational-ai/websocket-protocol)

## Multi-Agent System

The voice test page now supports **multiple voice agents connected simultaneously**! 

### Features
- ✅ Add/remove agents dynamically
- ✅ Independent WebSocket connections per agent
- ✅ All agents listen to the same microphone input
- ✅ Agents respond independently and simultaneously
- ✅ Individual mute controls per agent
- ✅ Clean, modular architecture with custom hooks

See `app/voice-test/README.md` for detailed documentation.

## Next Steps

- [x] Implement multi-agent council (multiple agents in one conversation)
- [ ] Add conversation history/transcript
- [ ] Add voice activity detection (VAD) for better turn-taking
- [ ] Store conversation analytics
- [ ] Add custom wake words
- [ ] Different agent personalities per instance
