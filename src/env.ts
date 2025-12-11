import { z } from "zod";

const envSchema = z.object({
  ELEVENLABS_API_KEY: z.string().min(1, "ELEVENLABS_API_KEY is required"),
  ELEVENLABS_AGENT_ID: z.string().min(1, "ELEVENLABS_AGENT_ID is required for conversational AI"),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error(
    "Invalid environment variables",
    parsed.error.flatten().fieldErrors,
  );
  throw new Error("Invalid environment variables");
}

export const env = {
  elevenLabsApiKey: parsed.data.ELEVENLABS_API_KEY,
  elevenLabsAgentId: parsed.data.ELEVENLABS_AGENT_ID,
};

export type Env = typeof env;

