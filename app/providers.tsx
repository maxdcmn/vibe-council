"use client";

import { TRPCProvider } from "@/trpc/provider";
import { Toaster } from "sonner";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <TRPCProvider>
      {children}
      <Toaster richColors />
    </TRPCProvider>
  );
}

