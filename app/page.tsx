"use client";

import { useState } from "react";
import { ArrowRight } from "lucide-react";

import CircleScene from "@/components/three/circle-scene";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";

const figureNames = [
  { name: "Red", color: "#ff4444" },
  { name: "Blue", color: "#4488ff" },
  { name: "Green", color: "#44ff88" },
  { name: "Yellow", color: "#ffcc00" },
  { name: "Magenta", color: "#ff44ff" },
];

const scenarios = [
  { value: "life", label: "Life decisions" },
  { value: "career", label: "Career advice" },
  { value: "interview", label: "Job interview practice" },
  { value: "relationship", label: "Relationship talk" },
  { value: "debate", label: "Friendly debate" },
  { value: "custom", label: "Custom scenario" },
];

export default function Index() {
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  const [arrowIndex, setArrowIndex] = useState<number | null>(null);
  const [showOverlay, setShowOverlay] = useState(true);
  const [isExiting, setIsExiting] = useState(false);
  const [selectedScenario, setSelectedScenario] = useState<string>("");
  const [customScenario, setCustomScenario] = useState("");

  const handleGetStarted = () => {
    setIsExiting(true);
    setTimeout(() => setShowOverlay(false), 300);
  };

  const handleFocusChange = (value: string) => {
    if (value === "none") {
      setFocusIndex(null);
    } else {
      setFocusIndex(parseInt(value, 10));
    }
  };

  const handleArrowChange = (value: string) => {
    if (value === "none") {
      setArrowIndex(null);
    } else {
      setArrowIndex(parseInt(value, 10));
    }
  };

  const scenarioIsReady =
    selectedScenario &&
    (selectedScenario !== "custom" || customScenario.trim().length > 0);

  return (
    <main className="scene-container relative h-screen w-screen overflow-hidden bg-black text-foreground">
      <CircleScene focusIndex={focusIndex} arrowIndex={arrowIndex} />

      {showOverlay && (
        <div
          className={`absolute inset-0 z-20 flex items-center justify-center backdrop-blur-3xl transition-all duration-300 ${
            isExiting ? "opacity-0 backdrop-blur-none" : "opacity-100"
          }`}
        >
          <div
            className={`max-w-lg px-8 text-center transition-all duration-300 ${
              isExiting ? "scale-95 opacity-0" : "scale-100 opacity-100"
            }`}
          >
            <h1 className="mb-3 font-sans text-5xl font-thin tracking-tight text-foreground">
              Vibe Council
            </h1>

            <p className="mb-10 font-sans text-base leading-relaxed text-muted-foreground">
              Pick a scenario and let your council weigh in.
            </p>

            <div className="mb-4 flex gap-2">
              <Select
                value={selectedScenario}
                onValueChange={setSelectedScenario}
              >
                <SelectTrigger className="flex-1 h-4 px-4 text-base">
                  <SelectValue placeholder="Choose a scenario..." />
                </SelectTrigger>
                <SelectContent>
                  {scenarios.map((scenario) => (
                    <SelectItem key={scenario.value} value={scenario.value}>
                      {scenario.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                onClick={handleGetStarted}
                disabled={!scenarioIsReady}
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-black p-0 text-white transition-colors hover:bg-black/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ArrowRight className="h-5 w-5" />
              </Button>
            </div>

            {selectedScenario === "custom" && (
              <Input
                placeholder="Describe your scenario..."
                value={customScenario}
                onChange={(e) => setCustomScenario(e.target.value)}
                className="h-11 w-full border-border/30 bg-background/80 px-4 text-base backdrop-blur-sm"
              />
            )}
          </div>
        </div>
      )}

      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Select
          value={focusIndex !== null ? focusIndex.toString() : "none"}
          onValueChange={handleFocusChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Focus" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Overview</SelectItem>
            {figureNames.map((figure, index) => (
              <SelectItem key={figure.name} value={index.toString()}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: figure.color }}
                  />
                  {figure.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={arrowIndex !== null ? arrowIndex.toString() : "none"}
          onValueChange={handleArrowChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Arrow" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No Arrow</SelectItem>
            {figureNames.map((figure, index) => (
              <SelectItem key={figure.name} value={index.toString()}>
                <div className="flex items-center gap-2">
                  <div
                    className="h-3 w-3 rounded-full"
                    style={{ backgroundColor: figure.color }}
                  />
                  {figure.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </main>
  );
}
