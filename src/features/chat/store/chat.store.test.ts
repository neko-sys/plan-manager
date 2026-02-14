import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("@/services/ollama/ollamaClient", () => ({
  ollamaClient: {
    generate: vi.fn().mockResolvedValue("assistant response"),
    streamGenerate: vi.fn(),
    listModels: vi.fn(),
  },
}));

import { useChatStore } from "@/store/chatStore";

describe("chat store", () => {
  beforeEach(() => {
    localStorage.clear();
    useChatStore.setState(useChatStore.getInitialState(), true);
  });

  test("sendMessage appends assistant reply", async () => {
    useChatStore.setState((state) => ({
      settings: { ...state.settings, streamEnabled: false, defaultModel: "llama3.1:8b" },
    }));

    await useChatStore.getState().sendMessage("hello");

    const active = useChatStore.getState().getActiveConversation();
    expect(active).not.toBeNull();
    expect(active?.messages.at(-1)?.role).toBe("assistant");
    expect(active?.messages.at(-1)?.content).toContain("assistant response");
    expect(useChatStore.getState().isLoading).toBe(false);
  });
});
