import { z } from "zod";

export type TimerPhase = "work" | "shortBreak" | "longBreak";

export type PomodoroSession = {
  id: string;
  taskId?: string;
  projectId?: string;
  phase: TimerPhase;
  durationMinutes: number;
  startedAt: string;
  completedAt?: string;
  isCompleted: boolean;
};

export type PomodoroSettings = {
  workDuration: number;
  shortBreakDuration: number;
  longBreakDuration: number;
  sessionsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartWork: boolean;
  soundEnabled: boolean;
  notificationEnabled: boolean;
  vibrationEnabled: boolean;
  volume: number;
};

export type PomodoroDailyStats = {
  date: string;
  completedPomodoros: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  sessions: PomodoroSession[];
};

export type PomodoroWeeklyStats = {
  weekStart: string;
  weekEnd: string;
  totalPomodoros: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  dailyStats: PomodoroDailyStats[];
};

export type PomodoroMonthlyStats = {
  month: string;
  totalPomodoros: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  weeklyStats: PomodoroWeeklyStats[];
};

export const DEFAULT_POMODORO_SETTINGS: PomodoroSettings = {
  workDuration: 25,
  shortBreakDuration: 5,
  longBreakDuration: 15,
  sessionsBeforeLongBreak: 4,
  autoStartBreaks: false,
  autoStartWork: false,
  soundEnabled: true,
  notificationEnabled: true,
  vibrationEnabled: false,
  volume: 0.7,
};

export const PHASE_LABELS: Record<TimerPhase, string> = {
  work: "专注",
  shortBreak: "短休息",
  longBreak: "长休息",
};

export const PHASE_COLORS: Record<TimerPhase, { primary: string; secondary: string }> = {
  work: { primary: "oklch(0.65 0.22 25)", secondary: "oklch(0.75 0.18 35)" },
  shortBreak: { primary: "oklch(0.70 0.18 150)", secondary: "oklch(0.80 0.14 160)" },
  longBreak: { primary: "oklch(0.65 0.20 220)", secondary: "oklch(0.75 0.16 230)" },
};

export const pomodoroSettingsSchema = z.object({
  workDuration: z.number().min(1).max(120),
  shortBreakDuration: z.number().min(1).max(30),
  longBreakDuration: z.number().min(5).max(60),
  sessionsBeforeLongBreak: z.number().min(2).max(10),
  autoStartBreaks: z.boolean(),
  autoStartWork: z.boolean(),
  soundEnabled: z.boolean(),
  notificationEnabled: z.boolean(),
  vibrationEnabled: z.boolean(),
  volume: z.number().min(0).max(1),
});

export const createPomodoroId = (): string => `pomodoro-${crypto.randomUUID()}`;
export const nowIso = (): string => new Date().toISOString();
export const dateKey = (date: Date): string => date.toISOString().slice(0, 10);

export const getPhaseDuration = (phase: TimerPhase, settings: PomodoroSettings): number => {
  switch (phase) {
    case "work":
      return settings.workDuration;
    case "shortBreak":
      return settings.shortBreakDuration;
    case "longBreak":
      return settings.longBreakDuration;
  }
};

export const formatTime = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
};

export const calculateProgress = (remainingSeconds: number, totalSeconds: number): number => {
  if (totalSeconds <= 0) return 0;
  return 1 - remainingSeconds / totalSeconds;
};

export const getWeekBounds = (date: Date): { start: Date; end: Date } => {
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const start = new Date(date);
  start.setDate(diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
};

export const getMonthBounds = (date: Date): { start: Date; end: Date } => {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
};
