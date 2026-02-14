import { Settings2, Volume2 } from "lucide-react";
import { motion } from "motion/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { usePomodoroStore } from "@/store/pomodoroStore";

type PomodoroSettingsProps = {
  labels: {
    title: string;
    workDuration: string;
    shortBreakDuration: string;
    longBreakDuration: string;
    sessionsBeforeLongBreak: string;
    autoStartBreaks: string;
    autoStartWork: string;
    soundEnabled: string;
    notificationEnabled: string;
    vibrationEnabled: string;
    volume: string;
  };
};

const DURATION_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60];
const BREAK_OPTIONS = [1, 3, 5, 10, 15, 20, 25, 30];
const SESSION_OPTIONS = [2, 3, 4, 5, 6, 7, 8];

export function PomodoroSettings({ labels }: PomodoroSettingsProps) {
  const settings = usePomodoroStore((s) => s.settings);
  const setSettings = usePomodoroStore((s) => s.setSettings);

  return (
    <Card className="border-muted/20 bg-card/50 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-4 w-4" />
          {labels.title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{labels.workDuration}</Label>
            <Select
              value={settings.workDuration.toString()}
              onValueChange={(v) => setSettings({ workDuration: parseInt(v) })}
            >
              <SelectTrigger className="h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((min) => (
                  <SelectItem key={min} value={min.toString()}>
                    {min} 分钟
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{labels.shortBreakDuration}</Label>
            <Select
              value={settings.shortBreakDuration.toString()}
              onValueChange={(v) => setSettings({ shortBreakDuration: parseInt(v) })}
            >
              <SelectTrigger className="h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAK_OPTIONS.map((min) => (
                  <SelectItem key={min} value={min.toString()}>
                    {min} 分钟
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">{labels.longBreakDuration}</Label>
            <Select
              value={settings.longBreakDuration.toString()}
              onValueChange={(v) => setSettings({ longBreakDuration: parseInt(v) })}
            >
              <SelectTrigger className="h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {BREAK_OPTIONS.filter((m) => m >= 5).map((min) => (
                  <SelectItem key={min} value={min.toString()}>
                    {min} 分钟
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">
              {labels.sessionsBeforeLongBreak}
            </Label>
            <Select
              value={settings.sessionsBeforeLongBreak.toString()}
              onValueChange={(v) => setSettings({ sessionsBeforeLongBreak: parseInt(v) })}
            >
              <SelectTrigger className="h-8 rounded-lg">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SESSION_OPTIONS.map((count) => (
                  <SelectItem key={count} value={count.toString()}>
                    {count} 个番茄
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{labels.autoStartBreaks}</Label>
            <Switch
              checked={settings.autoStartBreaks}
              onCheckedChange={(checked) => setSettings({ autoStartBreaks: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">{labels.autoStartWork}</Label>
            <Switch
              checked={settings.autoStartWork}
              onCheckedChange={(checked) => setSettings({ autoStartWork: checked })}
            />
          </div>
        </div>

        <div className="space-y-3 border-t border-muted/20 pt-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm">{labels.soundEnabled}</Label>
            <Switch
              checked={settings.soundEnabled}
              onCheckedChange={(checked) => setSettings({ soundEnabled: checked })}
            />
          </div>

          {settings.soundEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-2"
            >
              <div className="flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-muted-foreground" />
                <Label className="text-xs text-muted-foreground">{labels.volume}</Label>
              </div>
              <Slider
                value={[settings.volume * 100]}
                onValueChange={([v]) => setSettings({ volume: v / 100 })}
                max={100}
                step={5}
                className="w-full"
              />
            </motion.div>
          )}

          <div className="flex items-center justify-between">
            <Label className="text-sm">{labels.notificationEnabled}</Label>
            <Switch
              checked={settings.notificationEnabled}
              onCheckedChange={(checked) => setSettings({ notificationEnabled: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-sm">{labels.vibrationEnabled}</Label>
            <Switch
              checked={settings.vibrationEnabled}
              onCheckedChange={(checked) => setSettings({ vibrationEnabled: checked })}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
