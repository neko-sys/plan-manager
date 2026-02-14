import type { OllamaGenerateRequest, OllamaStreamResponse } from "@/entities/chat";
import { listOllamaModels } from "@/services/tauri/commands";

const OLLAMA_GENERATE_URL = "http://127.0.0.1:11434/api/generate";

export class OllamaClientError extends Error {
  constructor(message: string, public readonly causeCode?: string) {
    super(message);
    this.name = "OllamaClientError";
  }
}

export type StreamChunkHandler = (chunk: OllamaStreamResponse) => void;

export const ollamaClient = {
  async listModels(): Promise<string[]> {
    try {
      const models = await listOllamaModels();
      return [...new Set(models)].sort();
    } catch (error) {
      throw new OllamaClientError(error instanceof Error ? error.message : "Failed to list models", "LIST_MODELS_FAILED");
    }
  },

  async generate(request: OllamaGenerateRequest, signal?: AbortSignal): Promise<string> {
    const response = await fetch(OLLAMA_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, stream: false }),
      signal,
    });

    if (!response.ok) {
      throw new OllamaClientError(`HTTP ${response.status}`, "HTTP_ERROR");
    }

    const payload = (await response.json()) as { response?: string };
    return payload.response ?? "";
  },

  async streamGenerate(request: OllamaGenerateRequest, onChunk: StreamChunkHandler, signal?: AbortSignal): Promise<string> {
    const response = await fetch(OLLAMA_GENERATE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...request, stream: true }),
      signal,
    });

    if (!response.ok) {
      throw new OllamaClientError(`HTTP ${response.status}`, "HTTP_ERROR");
    }

    if (!response.body) {
      throw new OllamaClientError("Missing response body", "NO_STREAM_BODY");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let finalText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split("\n").filter((line) => line.trim());

      for (const line of lines) {
        try {
          const data = JSON.parse(line) as OllamaStreamResponse;
          finalText += data.response;
          onChunk(data);
        } catch {
          // Ignore malformed stream fragments.
        }
      }
    }

    return finalText;
  },
};

export type ChatService = typeof ollamaClient;
