import { MessageSquare, Plus, Settings, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { packs } from "@/domain/i18n";
import { cn } from "@/lib/utils";
import { ollamaClient } from "@/services/ollama/ollamaClient";
import { useChatStore } from "@/store/chatStore";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { ChatInput } from "./ChatInput";
import { ChatMessageList } from "./ChatMessageList";
import { ChatModelSelector } from "./ChatModelSelector";

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

export function ChatPage() {
  const locale = useWorkspaceStore((s) => s.locale);
  const t = packs[locale].chat;

  const conversations = useChatStore((s) => s.conversations);
  const activeConversationId = useChatStore((s) => s.activeConversationId);
  const settings = useChatStore((s) => s.settings);
  const isLoading = useChatStore((s) => s.isLoading);
  const createConversation = useChatStore((s) => s.createConversation);
  const deleteConversation = useChatStore((s) => s.deleteConversation);
  const setActiveConversation = useChatStore((s) => s.setActiveConversation);
  const sendMessage = useChatStore((s) => s.sendMessage);
  const stopGeneration = useChatStore((s) => s.stopGeneration);
  const updateSettings = useChatStore((s) => s.updateSettings);
  const getActiveConversation = useChatStore((s) => s.getActiveConversation);

  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [modelsError, setModelsError] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const activeConversation = getActiveConversation();
  const currentModel = activeConversation?.model ?? settings.defaultModel;

  useEffect(() => {
    loadModels();
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError("");
    try {
      const models = await ollamaClient.listModels();
      setOllamaModels(models);
      if (models.length > 0 && !settings.defaultModel) {
        updateSettings({ defaultModel: models[0] });
      }
    } catch {
      setModelsError(t.ollamaUnavailable);
    } finally {
      setModelsLoading(false);
    }
  }, [settings.defaultModel, updateSettings, t.ollamaUnavailable]);

  const handleModelChange = useCallback(
    (model: string) => {
      updateSettings({ defaultModel: model });
    },
    [updateSettings],
  );

  const handleNewConversation = useCallback(() => {
    createConversation(currentModel || ollamaModels[0] || "");
  }, [createConversation, currentModel, ollamaModels]);

  const handleSend = useCallback(
    (content: string) => {
      sendMessage(content);
    },
    [sendMessage],
  );

  return (
    <motion.div
      key="chat"
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
      className="flex h-full overflow-hidden"
    >
      <motion.div
        initial={false}
        animate={{ width: sidebarOpen ? 240 : 0 }}
        className="shrink-0 overflow-hidden border-r bg-muted/30"
      >
        <div className="flex h-full w-60 flex-col">
          <div className="flex items-center justify-between border-b p-3">
            <span className="text-sm font-medium">{t.conversations}</span>
            <Button variant="ghost" size="icon-xs" onClick={handleNewConversation}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="space-y-1 p-2">
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={cn(
                    "group flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                    conv.id === activeConversationId
                      ? "bg-primary/10 text-primary"
                      : "hover:bg-muted",
                  )}
                >
                  <MessageSquare className="h-4 w-4 shrink-0" />
                  <span className="flex-1 truncate">{conv.title}</span>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="h-6 w-6 opacity-0 group-hover:opacity-100"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </button>
              ))}
              {conversations.length === 0 && (
                <p className="p-3 text-center text-xs text-muted-foreground">{t.noConversations}</p>
              )}
            </div>
          </ScrollArea>
        </div>
      </motion.div>

      <div className="flex flex-1 flex-col">
        <div className="flex items-center justify-between border-b px-4 py-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon-xs" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <MessageSquare className="h-4 w-4" />
            </Button>
            <ChatModelSelector
              models={ollamaModels}
              selectedModel={currentModel}
              onModelChange={handleModelChange}
              onRefresh={loadModels}
              isLoading={modelsLoading}
              error={modelsError}
            />
          </div>
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon-xs">
                <Settings className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t.settings}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>{t.systemPrompt}</Label>
                  <Textarea
                    value={settings.systemPrompt}
                    onChange={(e) => updateSettings({ systemPrompt: e.target.value })}
                    rows={4}
                  />
                </div>
                <div className="space-y-2">
                  <Label>
                    {t.temperature}: {settings.temperature}
                  </Label>
                  <Slider
                    value={[settings.temperature]}
                    onValueChange={([v]) => updateSettings({ temperature: v })}
                    min={0}
                    max={2}
                    step={0.1}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.maxTokens}</Label>
                  <Input
                    type="number"
                    value={settings.maxTokens}
                    onChange={(e) =>
                      updateSettings({ maxTokens: parseInt(e.target.value) || 2048 })
                    }
                    min={1}
                    max={8192}
                  />
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <ChatMessageList messages={activeConversation?.messages ?? []} isStreaming={isLoading} />

        <ChatInput
          onSend={handleSend}
          onStop={stopGeneration}
          isLoading={isLoading}
          placeholder={t.inputPlaceholder}
        />
      </div>
    </motion.div>
  );
}
