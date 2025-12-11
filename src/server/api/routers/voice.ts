import { env } from "@/env";
import { publicProcedure, router } from "@/server/api/trpc";
import { z } from "zod";

const voiceStartInput = z.object({
  initialMessage: z.string().optional(),
});

export const voiceRouter = router({
  getSignedUrl: publicProcedure
    .input(voiceStartInput)
    .mutation(async () => {
      // The signed URL will be fetched from the API route
      return {
        agentId: env.elevenLabsAgentId,
      };
    }),
});

