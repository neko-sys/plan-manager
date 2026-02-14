import { z } from "zod";

export type Locale = "zh-CN" | "en-US";
export type AppView =
  | "dashboard"
  | "projects"
  | "tasks"
  | "notes"
  | "settings"
  | "pomodoro"
  | "chat";
export type ThemeMode = "system" | "light" | "dark";
export type WindowSizePreset = "small" | "medium" | "large" | "custom";
export type TimerPhase = "work" | "shortBreak" | "longBreak";

export const PROJECT_STATUSES = ["planning", "active", "completed"] as const;
export const TASK_STATUSES = ["todo", "doing", "done"] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type TaskPriority = "low" | "medium" | "high";

export type Project = {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  startDate: string;
  endDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  createdAt: string;
};

export type Task = {
  id: string;
  projectId: string;
  parentTaskId?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  estimateHours: number;
  spentHours: number;
  createdAt: string;
};

export type Note = {
  id: string;
  projectId?: string;
  taskId?: string;
  title: string;
  content: string;
  updatedAt: string;
};

export type DailyCheckin = {
  id: string;
  date: string;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  focusHours: number;
  reflection: string;
  createdAt: string;
  updatedAt: string;
};

export type UserSettings = {
  notificationsEnabled: boolean;
  autoTrackWorkOnDone: boolean;
  theme: ThemeMode;
  windowSizePreset: WindowSizePreset;
  windowWidth: number;
  windowHeight: number;
  accountName: string;
  accountEmail: string;
  privacyMode: boolean;
  telemetryEnabled: boolean;
  cacheRetentionDays: number;
};

export const projectInputSchema = z.object({
  name: z.string().min(2).max(80),
  description: z.string().max(400),
  startDate: z.string().min(10),
  endDate: z.string().min(10),
});

export const taskInputSchema = z
  .object({
    projectId: z.string().min(1),
    parentTaskId: z.string().optional(),
    title: z.string().min(2).max(100),
    status: z.enum(TASK_STATUSES),
    priority: z.enum(["low", "medium", "high"]),
    startDate: z.string().min(10),
    dueDate: z.string().min(10),
    estimateHours: z.coerce.number().min(1).max(500),
    spentHours: z.coerce.number().min(0).max(500),
  })
  .refine((payload) => payload.dueDate >= payload.startDate, {
    message: "Invalid task date range",
    path: ["dueDate"],
  });

export const noteInputSchema = z.object({
  projectId: z.string().optional(),
  taskId: z.string().optional(),
  title: z.string().min(1).max(120),
  content: z.string().min(1).max(4000),
});

export const dailyCheckinInputSchema = z.object({
  date: z.string().min(10),
  mood: z.coerce.number().int().min(1).max(5),
  energy: z.coerce.number().int().min(1).max(5),
  focusHours: z.coerce.number().min(0).max(24),
  reflection: z.string().max(800),
});

export const nowIso = (): string => new Date().toISOString();
export const dateKey = (date: Date): string => date.toISOString().slice(0, 10);
export const createId = (prefix: string): string => `${prefix}-${crypto.randomUUID()}`;
