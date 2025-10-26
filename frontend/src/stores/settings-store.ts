import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface Settings {
  apiUrl: string;
  apiKey: string;
  mcpUrl: string;
  embeddingProvider: "synthetic" | "openai" | "gemini" | "ollama";
  embeddingModel: string;
  decayLambda: number;
  theme: "light" | "dark" | "system";
  autoRefresh: boolean;
  refreshInterval: number;
}

interface SettingsState extends Settings {
  updateSettings: (updates: Partial<Settings>) => void;
  resetSettings: () => void;
}

const defaultSettings: Settings = {
  apiUrl: "http://localhost:8080",
  apiKey: "",
  mcpUrl: "ws://localhost:8080/mcp",
  embeddingProvider: "synthetic",
  embeddingModel: "",
  decayLambda: 0.02,
  theme: "system",
  autoRefresh: false,
  refreshInterval: 30000,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      updateSettings: (updates) =>
        set((state) => ({
          ...state,
          ...updates,
        })),

      resetSettings: () => set({ ...defaultSettings }),
    }),
    {
      name: "openmemory-settings",
    },
  ),
);
