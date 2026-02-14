import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type ChatModelSelectorProps = {
  models: string[];
  selectedModel: string;
  onModelChange: (model: string) => void;
  onRefresh: () => void;
  isLoading: boolean;
  error?: string;
};

export function ChatModelSelector({
  models,
  selectedModel,
  onModelChange,
  onRefresh,
  isLoading,
  error,
}: ChatModelSelectorProps) {
  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={onRefresh}
        disabled={isLoading}
        className="h-8 w-8"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
      </Button>

      {models.length > 0 ? (
        <Select value={selectedModel} onValueChange={onModelChange}>
          <SelectTrigger className="h-8 w-[180px]">
            <SelectValue placeholder="选择模型" />
          </SelectTrigger>
          <SelectContent>
            {models.map((model) => (
              <SelectItem key={model} value={model}>
                {model}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <Input
          value={selectedModel}
          onChange={(e) => onModelChange(e.target.value)}
          placeholder="输入模型名称"
          className="h-8 w-[180px]"
        />
      )}

      {error && <span className="text-xs text-destructive">{error}</span>}
    </div>
  );
}
