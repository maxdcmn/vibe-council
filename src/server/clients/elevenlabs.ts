import { env } from "@/env";

const ELEVEN_BASE_URL = "https://api.elevenlabs.io/v1";

// Get signed URL for conversational AI WebSocket connection
export async function getConversationalAiSignedUrl(): Promise<string> {
  const response = await fetch(
    `${ELEVEN_BASE_URL}/convai/conversation/get_signed_url?agent_id=${env.elevenLabsAgentId}`,
    {
      method: "GET",
      headers: {
        "xi-api-key": env.elevenLabsApiKey,
      },
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Failed to get signed URL (${response.status}): ${errorText}`,
    );
  }

  const data = await response.json();
  return data.signed_url;
}

