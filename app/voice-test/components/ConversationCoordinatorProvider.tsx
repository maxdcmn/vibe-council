"use client";

import { ReactNode } from "react";
import {
  ConversationCoordinatorContext,
  useConversationCoordinatorProvider,
} from "../hooks/useConversationCoordinator";

interface ConversationCoordinatorProviderProps {
  children: ReactNode;
}

export function ConversationCoordinatorProvider({
  children,
}: ConversationCoordinatorProviderProps) {
  const coordinator = useConversationCoordinatorProvider();

  return (
    <ConversationCoordinatorContext.Provider value={coordinator}>
      {children}
    </ConversationCoordinatorContext.Provider>
  );
}
