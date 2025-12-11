import { appRouter } from "@/server/api/root";
import { createTRPCContext } from "@/server/api/trpc";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";

const handler = async (
  req: Request,
  { params }: { params: Promise<{ trpc: string }> }
) => {
  await params; // Unwrap params Promise to satisfy Next.js 15 requirements
  return fetchRequestHandler({
    endpoint: "/api/trpc",
    req,
    router: appRouter,
    createContext: () => createTRPCContext(),
    onError({ error, path }) {
      console.error(`tRPC failed on ${path ?? "<unknown>"}`, error);
    },
  });
};

export { handler as GET, handler as POST };

