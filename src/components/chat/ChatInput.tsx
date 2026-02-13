import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { Send, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { QUICK_PROMPTS } from "@/domain/chat";
import { cn } from "@/lib/utils";

type ChatInputProps = {
  onSend: (content: string) => void;
  onStop: () => void;
  isLoading: boolean;
  disabled?: boolean;
  placeholder?: string;
};

export function ChatInput({ onSend, onStop, isLoading, disabled, placeholder }: ChatInputProps) {
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading || disabled) return;
    onSend(trimmed);
    setInput("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleQuickPrompt = (prompt: string) => {
    setInput((prev) => prompt + (prev ? `\n${prev}` : ""));
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t bg-background/95 p-4">
      <div className="mx-auto max-w-3xl space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {QUICK_PROMPTS.map((qp) => (
            <button
              key={qp.key}
              onClick={() => handleQuickPrompt(qp.prompt)}
              className="rounded-full border border-muted-foreground/20 bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {qp.label}
            </button>
          ))}
        </div>

        <div className="flex items-end gap-2">
          <div className="relative flex-1">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={placeholder || "输入消息... (Shift+Enter 换行)"}
              disabled={disabled}
              className="min-h-[44px] max-h-[200px] resize-none pr-12"
              rows={1}
            />
          </div>
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="destructive"
                onClick={onStop}
                className="h-11 w-11 shrink-0"
              >
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="button"
                size="icon"
                onClick={handleSubmit}
                disabled={!input.trim() || disabled}
                className={cn(
                  "h-11 w-11 shrink-0 transition-all",
                  input.trim() && !disabled
                    ? "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600"
                    : ""
                )}
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </motion.div>
        </div>
      </div>
    </div>
  );
}
