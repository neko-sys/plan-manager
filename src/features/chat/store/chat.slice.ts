import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  ChatConversation,
  ChatMessage,
  ChatSettings,
  OllamaStreamResponse,
} from "@/domain/chat";
import {
  createConversationId,
  createMessageId,
  DEFAULT_CHAT_SETTINGS,
  generateTitle,
  nowIso,
} from "@/domain/chat";
import { ollamaClient } from "@/services/ollama/ollamaClient";

type ChatState = {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  settings: ChatSettings;
  isLoading: boolean;
  abortController: AbortController | null;

  createConversation: (model: string) => string;
  deleteConversation: (id: string) => void;
  setActiveConversation: (id: string | null) => void;
  updateConversationTitle: (id: string, title: string) => void;

  addMessage: (
    conversationId: string,
    role: "user" | "assistant" | "system",
    content: string,
  ) => ChatMessage;
  updateMessage: (
    conversationId: string,
    messageId: string,
    content: string,
    isStreaming?: boolean,
  ) => void;
  deleteMessage: (conversationId: string, messageId: string) => void;
  clearMessages: (conversationId: string) => void;

  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;

  updateSettings: (settings: Partial<ChatSettings>) => void;

  getActiveConversation: () => ChatConversation | null;
};

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      conversations: [],
      activeConversationId: null,
      settings: DEFAULT_CHAT_SETTINGS,
      isLoading: false,
      abortController: null,

      createConversation: (model: string) => {
        const id = createConversationId();
        const conversation: ChatConversation = {
          id,
          title: "新对话",
          messages: [],
          model,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        };
        set((state) => ({
          conversations: [conversation, ...state.conversations],
          activeConversationId: id,
        }));
        return id;
      },

      deleteConversation: (id: string) => {
        set((state) => {
          const newConversations = state.conversations.filter((c) => c.id !== id);
          const newActiveId =
            state.activeConversationId === id
              ? (newConversations[0]?.id ?? null)
              : state.activeConversationId;
          return {
            conversations: newConversations,
            activeConversationId: newActiveId,
          };
        });
      },

      setActiveConversation: (id: string | null) => {
        set({ activeConversationId: id });
      },

      updateConversationTitle: (id: string, title: string) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === id ? { ...c, title, updatedAt: nowIso() } : c,
          ),
        }));
      },

      addMessage: (
        conversationId: string,
        role: "user" | "assistant" | "system",
        content: string,
      ) => {
        const message: ChatMessage = {
          id: createMessageId(),
          role,
          content,
          timestamp: nowIso(),
        };
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: [...c.messages, message],
                  updatedAt: nowIso(),
                  title:
                    c.messages.length === 0 && role === "user" ? generateTitle(content) : c.title,
                }
              : c,
          ),
        }));
        return message;
      },

      updateMessage: (
        conversationId: string,
        messageId: string,
        content: string,
        isStreaming?: boolean,
      ) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.map((m) =>
                    m.id === messageId ? { ...m, content, isStreaming } : m,
                  ),
                  updatedAt: nowIso(),
                }
              : c,
          ),
        }));
      },

      deleteMessage: (conversationId: string, messageId: string) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId
              ? {
                  ...c,
                  messages: c.messages.filter((m) => m.id !== messageId),
                  updatedAt: nowIso(),
                }
              : c,
          ),
        }));
      },

      clearMessages: (conversationId: string) => {
        set((state) => ({
          conversations: state.conversations.map((c) =>
            c.id === conversationId ? { ...c, messages: [], updatedAt: nowIso() } : c,
          ),
        }));
      },

      sendMessage: async (content: string) => {
        const state = get();
        let conversationId = state.activeConversationId;
        const model =
          state.conversations.find((c) => c.id === conversationId)?.model ??
          state.settings.defaultModel;

        if (!conversationId) {
          conversationId = state.createConversation(model);
        }

        state.addMessage(conversationId, "user", content);
        set({ isLoading: true });

        const controller = new AbortController();
        set({ abortController: controller });

        const assistantMessage = state.addMessage(conversationId, "assistant", "");
        state.updateMessage(conversationId, assistantMessage.id, "", true);

        const conversation = get().conversations.find((c) => c.id === conversationId);
        const messages = conversation?.messages.filter((m) => m.role !== "system") ?? [];

        const contextPrompt = messages
          .slice(0, -1)
          .map((m) => `${m.role === "user" ? "用户" : "助手"}: ${m.content}`)
          .join("\n\n");

        const fullPrompt = contextPrompt
          ? `${contextPrompt}\n\n用户: ${content}\n\n助手:`
          : content;

        try {
          const request = {
            model,
            prompt: fullPrompt,
            system: state.settings.systemPrompt,
            stream: state.settings.streamEnabled,
            options: {
              temperature: state.settings.temperature,
              num_predict: state.settings.maxTokens,
            },
          };

          if (state.settings.streamEnabled) {
            let accumulatedContent = "";
            await ollamaClient.streamGenerate(
              request,
              (data: OllamaStreamResponse) => {
                accumulatedContent += data.response;
                state.updateMessage(
                  conversationId!,
                  assistantMessage.id,
                  accumulatedContent,
                  !data.done,
                );
              },
              controller.signal,
            );
            state.updateMessage(conversationId!, assistantMessage.id, accumulatedContent, false);
          } else {
            const response = await ollamaClient.generate(request, controller.signal);
            state.updateMessage(conversationId!, assistantMessage.id, response, false);
          }
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            state.updateMessage(conversationId!, assistantMessage.id, "已停止生成", false);
          } else {
            const errorMessage = error instanceof Error ? error.message : "发生未知错误";
            state.updateMessage(
              conversationId!,
              assistantMessage.id,
              `错误: ${errorMessage}`,
              false,
            );
          }
        } finally {
          set({ isLoading: false, abortController: null });
        }
      },

      stopGeneration: () => {
        const { abortController } = get();
        if (abortController) {
          abortController.abort();
        }
      },

      updateSettings: (newSettings: Partial<ChatSettings>) => {
        set((state) => ({
          settings: { ...state.settings, ...newSettings },
        }));
      },

      getActiveConversation: () => {
        const { conversations, activeConversationId } = get();
        return conversations.find((c) => c.id === activeConversationId) ?? null;
      },
    }),
    {
      name: "plan-manager-chat-v1",
      partialize: (state) => ({
        conversations: state.conversations,
        settings: state.settings,
      }),
    },
  ),
);

export const selectConversations = (state: ChatState) => state.conversations;
export const selectActiveConversationId = (state: ChatState) => state.activeConversationId;
export const selectSettings = (state: ChatState) => state.settings;
export const selectIsLoading = (state: ChatState) => state.isLoading;
