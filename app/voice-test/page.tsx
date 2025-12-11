"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { VoiceAgent } from "./components/VoiceAgent";

export const dynamic = "force-dynamic";

interface Agent {
  id: string;
  name: string;
}

export default function VoiceTestPage() {
  const [agents, setAgents] = useState<Agent[]>([
    { id: "1", name: "Agent Alpha" },
  ]);
  const [nextAgentNumber, setNextAgentNumber] = useState(2);

  const addAgent = () => {
    const greekLetters = [
      "Alpha",
      "Beta",
      "Gamma",
      "Delta",
      "Epsilon",
      "Zeta",
      "Eta",
      "Theta",
    ];
    const agentName =
      agents.length < greekLetters.length
        ? `Agent ${greekLetters[agents.length]}`
        : `Agent ${nextAgentNumber}`;

    setAgents([...agents, { id: Date.now().toString(), name: agentName }]);
    setNextAgentNumber(nextAgentNumber + 1);
  };

  const removeAgent = (id: string) => {
    setAgents(agents.filter((agent) => agent.id !== id));
  };

  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-6 py-12 text-zinc-900 dark:text-zinc-50">
      {/* Header */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Voice Council · Multi-Agent System
          </p>
          <h1 className="text-3xl font-semibold">
            ElevenLabs Conversational AI
          </h1>
          <p className="text-sm text-zinc-500">
            Connect multiple voice agents simultaneously for collaborative
            conversations
          </p>
        </div>
        <button
          onClick={addAgent}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          Add Agent
        </button>
      </header>
      {/* Agents Grid */}
      {agents.length === 0 ? (
        <div className="flex min-h-[400px] items-center justify-center rounded-2xl border-2 border-dashed border-zinc-300 dark:border-zinc-700">
          <div className="text-center">
            <p className="mb-4 text-lg font-medium text-zinc-600 dark:text-zinc-400">
              No agents yet
            </p>
            <button
              onClick={addAgent}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-blue-700"
            >
              <Plus className="h-4 w-4" />
              Add Your First Agent
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <VoiceAgent
              key={agent.id}
              agentId={agent.id}
              agentName={agent.name}
              onRemove={() => removeAgent(agent.id)}
              canRemove={agents.length > 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
