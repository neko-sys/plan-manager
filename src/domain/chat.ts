import { z } from "zod";

export type ChatRole = "user" | "assistant" | "system";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  timestamp: string;
  isStreaming?: boolean;
};

export type ChatConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
  model: string;
  createdAt: string;
  updatedAt: string;
};

export type ChatSettings = {
  defaultModel: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  streamEnabled: boolean;
};

export type OllamaGenerateRequest = {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    num_predict?: number;
  };
};

export type OllamaGenerateResponse = {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
};

export type OllamaStreamResponse = OllamaGenerateResponse & {
  done_reason?: string;
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  defaultModel: "",
  systemPrompt: "你是一个有帮助的AI助手，请用简洁清晰的语言回答问题。",
  temperature: 0.7,
  maxTokens: 2048,
  streamEnabled: true,
};

export const QUICK_PROMPTS = [
  { key: "summarize", label: "总结", prompt: "请帮我总结以下内容：" },
  { key: "translate", label: "翻译", prompt: "请将以下内容翻译成英文：" },
  { key: "code", label: "代码", prompt: "请帮我写代码实现：" },
  { key: "explain", label: "解释", prompt: "请解释以下概念：" },
  { key: "improve", label: "优化", prompt: "请帮我优化以下内容：" },
];

export const chatSettingsSchema = z.object({
  defaultModel: z.string(),
  systemPrompt: z.string(),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().min(1).max(8192),
  streamEnabled: z.boolean(),
});

export const createMessageId = (): string => `msg-${crypto.randomUUID()}`;
export const createConversationId = (): string => `conv-${crypto.randomUUID()}`;
export const nowIso = (): string => new Date().toISOString();

export const generateTitle = (content: string): string => {
  const firstLine = content.split("\n")[0];
  if (firstLine.length <= 30) {
    return firstLine;
  }
  return `${firstLine.slice(0, 30)}...`;
};

export const formatChatTime = (isoString: string): string => {
  const date = new Date(isoString);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  
  if (isToday) {
    return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString("zh-CN", { month: "short", day: "numeric" });
};
