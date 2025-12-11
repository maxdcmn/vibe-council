import { voiceRouter } from "@/server/api/routers/voice";
import { router } from "@/server/api/trpc";

export const appRouter = router({
  voice: voiceRouter,
});

export type AppRouter = typeof appRouter;

