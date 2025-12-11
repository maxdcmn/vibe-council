import { getConversationalAiSignedUrl } from "@/server/clients/elevenlabs";

export const runtime = "nodejs";

export async function GET() {
  try {
    // Generate a signed URL for the conversational AI WebSocket connection
    const signedUrl = await getConversationalAiSignedUrl();

    return Response.json({ signedUrl });
  } catch (error) {
    console.error("Failed to get signed URL:", error);
    return Response.json(
      { error: "Failed to initialize conversation" },
      { status: 500 },
    );
  }
}
