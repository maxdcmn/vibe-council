import { initTRPC } from "@trpc/server";
import superjson from "superjson";

type Context = Record<string, never>;

export const createTRPCContext = async (): Promise<Context> => ({});

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

