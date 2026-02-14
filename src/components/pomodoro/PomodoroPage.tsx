import { Download, FileJson, FileSpreadsheet } from "lucide-react";
import { motion } from "motion/react";
import { useCallback, useEffect, useRef } from "react";
import { exportToCsv, exportToJson } from "@/application/export";
import { PhaseSelector } from "@/components/pomodoro/PhaseSelector";
import { PomodoroSettings } from "@/components/pomodoro/PomodoroSettings";
import { PomodoroStats } from "@/components/pomodoro/PomodoroStats";
import { TaskPicker } from "@/components/pomodoro/TaskPicker";
import { TimerControls } from "@/components/pomodoro/TimerControls";
import { TimerRing } from "@/components/pomodoro/TimerRing";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { packs } from "@/domain/i18n";
import { notifyPhaseComplete } from "@/services/notifications/notificationService";
import { usePomodoroStore } from "@/store/pomodoroStore";
import { useWorkspaceStore } from "@/store/workspaceStore";

const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" as const },
};

export function PomodoroPage() {
  const locale = useWorkspaceStore((s) => s.locale);
  const t = packs[locale].pomodoro;

  const timer = usePomodoroStore((s) => s.timer);
  const settings = usePomodoroStore((s) => s.settings);
  const sessions = usePomodoroStore((s) => s.sessions);
  const startTimer = usePomodoroStore((s) => s.startTimer);
  const pauseTimer = usePomodoroStore((s) => s.pauseTimer);
  const resumeTimer = usePomodoroStore((s) => s.resumeTimer);
  const resetTimer = usePomodoroStore((s) => s.resetTimer);
  const skipPhase = usePomodoroStore((s) => s.skipPhase);
  const tick = usePomodoroStore((s) => s.tick);
  const switchPhase = usePomodoroStore((s) => s.switchPhase);
  const completeSession = usePomodoroStore((s) => s.completeSession);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevRemainingRef = useRef(timer.remainingSeconds);

  useEffect(() => {
    if (timer.isRunning) {
      intervalRef.current = setInterval(() => {
        tick();
      }, 1000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [timer.isRunning, tick]);

  useEffect(() => {
    if (timer.remainingSeconds === 0 && prevRemainingRef.current > 0 && timer.isRunning === false) {
      notifyPhaseComplete(timer.phase, settings);
      completeSession();
    }
    prevRemainingRef.current = timer.remainingSeconds;
  }, [timer.remainingSeconds, timer.isRunning, timer.phase, settings, completeSession]);

  useEffect(() => {
    document.title = timer.isRunning
      ? `${formatTimeDisplay(timer.remainingSeconds)} - ${t.phases[timer.phase]} | ${packs[locale].appTitle}`
      : `${t.title} | ${packs[locale].appTitle}`;
  }, [timer.remainingSeconds, timer.isRunning, timer.phase, locale, t]);

  const handleExportJson = useCallback(() => {
    exportToJson(sessions);
  }, [sessions]);

  const handleExportCsv = useCallback(() => {
    exportToCsv(sessions);
  }, [sessions]);

  return (
    <motion.div
      key="pomodoro"
      initial={pageTransition.initial}
      animate={pageTransition.animate}
      exit={pageTransition.exit}
      transition={pageTransition.transition}
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 lg:p-8">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <h1 className="text-2xl font-semibold tracking-tight">{t.title}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t.subtitle}</p>
          </motion.div>

          <PhaseSelector
            currentPhase={timer.phase}
            onPhaseChange={switchPhase}
            disabled={timer.isRunning}
          />

          <div className="relative mt-4">
            <TimerRing
              remainingSeconds={timer.remainingSeconds}
              totalSeconds={timer.totalSeconds}
              phase={timer.phase}
              isRunning={timer.isRunning}
              phaseLabels={t.phases}
            />
          </div>

          <TimerControls
            isRunning={timer.isRunning}
            isPaused={timer.isPaused}
            onStart={startTimer}
            onPause={pauseTimer}
            onResume={resumeTimer}
            onReset={resetTimer}
            onSkip={skipPhase}
          />

          <TaskPicker labels={t.task} />

          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {locale === "zh-CN" ? "本周期完成" : "Completed in cycle"}:{" "}
              <span className="font-medium text-foreground">
                {timer.completedSessionsInCycle}/{settings.sessionsBeforeLongBreak}
              </span>
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-muted/20 p-4 lg:w-80 lg:border-l lg:border-t-0 lg:p-6">
          <PomodoroStats labels={t.stats} />

          <PomodoroSettings labels={t.settings} />

          <div className="mt-auto flex flex-col gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />
                  {t.export.title}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={handleExportJson} className="gap-2">
                  <FileJson className="h-4 w-4" />
                  {t.export.json}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleExportCsv} className="gap-2">
                  <FileSpreadsheet className="h-4 w-4" />
                  {t.export.csv}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function formatTimeDisplay(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}
