export const MODELS = {
  orchestrator: "google/gemini-3.5-flash-lite",
  scanner: "google/gemini-3.5-flash-lite",
  planner: "google/gemini-3.5-flash-lite",
  remediator: "google/gemini-3.7-flash",
} as const;

export type AgentRole = keyof typeof MODELS;
