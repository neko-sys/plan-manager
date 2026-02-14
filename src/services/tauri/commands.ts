import { invoke } from "@tauri-apps/api/core";

export const listOllamaModels = async (): Promise<string[]> => {
  return invoke<string[]>("list_ollama_models");
};

export const tauriCommands = {
  listOllamaModels,
};

export type TauriCommandService = typeof tauriCommands;
