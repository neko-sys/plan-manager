import { type FormEvent, type MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Battery,
  Bell,
  BookText,
  Brain,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  Copy,
  Flame,
  FolderKanban,
  HeartPulse,
  LayoutDashboard,
  ListTodo,
  Pencil,
  PieChart,
  PlayCircle,
  Plus,
  RotateCcw,
  Settings2,
  Smile,
  Sparkles,
  Timer,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Steps } from "antd";
import { LogicalSize } from "@tauri-apps/api/dpi";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { packs } from "@/domain/i18n";
import {
  dailyCheckinInputSchema,
  noteInputSchema,
  projectInputSchema,
  taskInputSchema,
  PROJECT_STATUSES,
  TASK_STATUSES,
  type ProjectStatus,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type WindowSizePreset,
} from "@/domain/models";
import { projectProgress, timelineBounds, workspaceMetrics } from "@/application/metrics";
import { selectCurrentProject, useWorkspaceStore } from "@/store/workspaceStore";
import { PomodoroPage } from "@/components/pomodoro/PomodoroPage";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

type TaskFormState = {
  projectId: string;
  parentTaskId?: string;
  title: string;
  status: TaskStatus;
  priority: "low" | "medium" | "high";
  startDate: string;
  dueDate: string;
  estimateHours: number;
  spentHours: number;
};
const TASK_CREATE_DEFAULTS = {
  status: "todo" as TaskStatus,
  priority: "medium" as const,
  estimateHours: 8,
  spentHours: 0,
  parentTaskId: "",
};

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_HOURS_PER_DAY = 8;

const parseDateLike = (value: string | Date): Date => {
  if (value instanceof Date) {
    return value;
  }
  return value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
};
const isDateOnlyValue = (value: string | Date): boolean => typeof value === "string" && !value.includes("T");

const formatDate = (value: string | Date, locale: string) => {
  const date = parseDateLike(value);
  return date.toLocaleDateString(locale, { month: "short", day: "numeric" });
};
const formatDateTime = (value: string | Date, locale: string) => {
  if (isDateOnlyValue(value)) {
    return formatDate(value, locale);
  }
  const date = parseDateLike(value);
  return date.toLocaleString(locale, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
};
const dateToKey = (date: Date) => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
};
const startOfMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth(), 1);
const addMonths = (date: Date, offset: number) => new Date(date.getFullYear(), date.getMonth() + offset, 1);
const normalizeDateRange = (start: string, end: string): [string, string] =>
  start <= end ? [start, end] : [end, start];
const calcRangeHours = (start: string, end: string): number => {
  const [from, to] = normalizeDateRange(start, end);
  const startTime = new Date(`${from}T00:00:00`).getTime();
  const endTime = new Date(`${to}T00:00:00`).getTime();
  const days = Math.max(1, Math.floor((endTime - startTime) / DAY_MS) + 1);
  return days * DEFAULT_HOURS_PER_DAY;
};
const calcElapsedHours = (start: string, end: string): number => {
  const startTime = parseDateLike(start).getTime();
  const endTime = parseDateLike(end).getTime();
  if (!Number.isFinite(startTime) || !Number.isFinite(endTime)) {
    return 0;
  }
  const hours = Math.max(0, (endTime - startTime) / (60 * 60 * 1000));
  return Math.round(hours * 10) / 10;
};
const getMonthGrid = (cursor: Date) => {
  const monthStart = startOfMonth(cursor);
  const firstWeekDay = monthStart.getDay();
  const gridStart = new Date(monthStart);
  gridStart.setDate(monthStart.getDate() - firstWeekDay);
  return Array.from({ length: 42 }, (_, index) => {
    const day = new Date(gridStart);
    day.setDate(gridStart.getDate() + index);
    return day;
  });
};

const markerBase = "inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium";
const projectStatusTone: Record<ProjectStatus, string> = {
  planning: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
  active: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  completed: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const taskStatusTone: Record<TaskStatus, string> = {
  todo: "border-slate-500/40 bg-slate-500/15 text-slate-700 dark:text-slate-300",
  doing: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
};
const priorityTone: Record<TaskPriority, string> = {
  low: "border-lime-500/40 bg-lime-500/15 text-lime-700 dark:text-lime-300",
  medium: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300",
  high: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
};
const priorityTriggerTone: Record<TaskPriority, string> = {
  low: "border-lime-500/40 bg-lime-500/10 text-lime-700 dark:text-lime-300",
  medium: "border-orange-500/40 bg-orange-500/10 text-orange-700 dark:text-orange-300",
  high: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300",
};
const projectStatusTriggerTone: Record<ProjectStatus, string> = {
  planning: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  active: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};
const taskStatusTriggerTone: Record<TaskStatus, string> = {
  todo: "border-slate-500/40 bg-slate-500/10 text-slate-700 dark:text-slate-300",
  doing: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300",
  done: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
};
const moodColors: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-rose-500",
  2: "bg-orange-500",
  3: "bg-amber-500",
  4: "bg-lime-500",
  5: "bg-emerald-500",
};
const energyColors: Record<1 | 2 | 3 | 4 | 5, string> = {
  1: "bg-slate-500",
  2: "bg-sky-500",
  3: "bg-cyan-500",
  4: "bg-blue-500",
  5: "bg-violet-500",
};
const ganttTaskBarTone: Record<TaskStatus, string> = {
  todo: "bg-slate-400 ring-1 ring-slate-500/40",
  doing: "bg-amber-500 ring-1 ring-amber-500/40",
  done: "bg-emerald-500 ring-1 ring-emerald-500/45",
};
const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
  transition: { duration: 0.2, ease: "easeOut" },
} as const;
const WINDOW_PRESETS: Record<Exclude<WindowSizePreset, "custom">, { width: number; height: number }> = {
  small: { width: 1024, height: 720 },
  medium: { width: 1280, height: 800 },
  large: { width: 1440, height: 900 },
};
const GANTT_PX_PER_DAY = {
  compact: 18,
  comfortable: 26,
  detailed: 36,
} as const;
const GANTT_MIN_WIDTH = {
  compact: 520,
  comfortable: 760,
  detailed: 1080,
} as const;
const GANTT_LABEL_WIDTH = 260;
const GANTT_TRACK_GAP = 8;
const TASK_STATUS_ORDER: Record<TaskStatus, number> = {
  todo: 0,
  doing: 1,
  done: 2,
};

const calculateCheckinStreak = (dates: string[]): number => {
  if (dates.length === 0) {
    return 0;
  }
  const dateSet = new Set(dates);
  let cursor = new Date();
  let streak = 0;
  while (dateSet.has(dateToKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
};

type AiSubtaskDraft = {
  title: string;
  priority?: TaskPriority;
  estimateHours?: number;
  startDate?: string;
  dueDate?: string;
};

type AiProjectTaskDraft = {
  title: string;
  priority?: TaskPriority;
  estimateHours?: number;
  startDate?: string;
  dueDate?: string;
  children?: AiProjectTaskDraft[];
};

const isDateKey = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
const resolveTaskRange = (
  defaultStart: string,
  defaultDue: string,
  candidateStart?: string,
  candidateDue?: string,
): { startDate: string; dueDate: string } => {
  const rawStart = isDateKey(candidateStart) ? candidateStart : defaultStart;
  const rawDue = isDateKey(candidateDue) ? candidateDue : defaultDue;
  const [startDate, dueDate] = normalizeDateRange(rawStart, rawDue);
  return { startDate, dueDate };
};

const parseAiSubtasks = (raw: string): AiSubtaskDraft[] => {
  const cleaned = raw.trim();
  const normalize = (input: unknown): AiSubtaskDraft[] => {
    if (!Array.isArray(input)) {
      return [];
    }
    const tasks: AiSubtaskDraft[] = [];
    for (const item of input) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const task = item as Record<string, unknown>;
      const title = `${task.title ?? ""}`.trim();
      if (!title) {
        continue;
      }
      const priorityRaw = `${task.priority ?? ""}`.toLowerCase();
      const priority: TaskPriority | undefined =
        priorityRaw === "low" || priorityRaw === "medium" || priorityRaw === "high" ? priorityRaw : undefined;
      const estimateCandidate = Number(task.estimateHours);
      const estimateHours = Number.isFinite(estimateCandidate) ? Math.max(1, Math.round(estimateCandidate)) : undefined;
      const startDate = isDateKey(task.startDate) ? task.startDate : undefined;
      const dueDate = isDateKey(task.dueDate) ? task.dueDate : undefined;
      tasks.push({ title, priority, estimateHours, startDate, dueDate });
    }
    return tasks;
  };

  try {
    return normalize(JSON.parse(cleaned));
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      return [];
    }
    try {
      return normalize(JSON.parse(match[0]));
    } catch {
      return [];
    }
  }
};

const parseAiProjectTasks = (raw: string): AiProjectTaskDraft[] => {
  const cleaned = raw.trim();
  const normalizeNode = (item: unknown): AiProjectTaskDraft | null => {
    if (!item || typeof item !== "object") {
      return null;
    }
    const task = item as Record<string, unknown>;
    const title = `${task.title ?? ""}`.trim();
    if (!title) {
      return null;
    }
    const priorityRaw = `${task.priority ?? ""}`.toLowerCase();
    const priority: TaskPriority | undefined =
      priorityRaw === "low" || priorityRaw === "medium" || priorityRaw === "high" ? priorityRaw : undefined;
    const estimateCandidate = Number(task.estimateHours);
    const estimateHours = Number.isFinite(estimateCandidate) ? Math.max(1, Math.round(estimateCandidate)) : undefined;
    const startDate = isDateKey(task.startDate) ? task.startDate : undefined;
    const dueDate = isDateKey(task.dueDate) ? task.dueDate : undefined;
    const childrenRaw =
      Array.isArray(task.children) ? task.children : Array.isArray(task.subtasks) ? task.subtasks : [];
    const children = childrenRaw.map((child) => normalizeNode(child)).filter((child): child is AiProjectTaskDraft => child !== null);
    return {
      title,
      priority,
      estimateHours,
      startDate,
      dueDate,
      children: children.length > 0 ? children : undefined,
    };
  };

  const normalize = (input: unknown): AiProjectTaskDraft[] => {
    if (!Array.isArray(input)) {
      return [];
    }
    return input.map((item) => normalizeNode(item)).filter((item): item is AiProjectTaskDraft => item !== null);
  };

  try {
    return normalize(JSON.parse(cleaned));
  } catch {
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) {
      return [];
    }
    try {
      return normalize(JSON.parse(match[0]));
    } catch {
      return [];
    }
  }
};

function App() {
  const {
    locale,
    view,
    settings,
    cacheClearedAt,
    selectedProjectId,
    projects,
    tasks,
    notes,
    dailyCheckins,
    setView,
    setLocale,
    updateSettings,
    setTheme,
    clearCache,
    selectProject,
    createProject,
    updateProject,
    createTask,
    updateTask,
    deleteTask,
    deleteProject,
    createNote,
    upsertDailyCheckin,
    updateTaskStatus,
    updateProjectStatus,
  } = useWorkspaceStore();

  const currentProject = useWorkspaceStore(selectCurrentProject);
  const t = packs[locale];
  const text = {
    cancel: locale === "zh-CN" ? "取消" : "Cancel",
    taskStatusChart: locale === "zh-CN" ? "任务状态分布" : "Task Status",
    priorityChart: locale === "zh-CN" ? "优先级占比" : "Priority Mix",
    workloadChart: locale === "zh-CN" ? "项目工时对比" : "Project Workload",
    workloadEmpty: locale === "zh-CN" ? "暂无项目工时数据" : "No project workload yet",
    deleteProjectConfirm: locale === "zh-CN" ? "删除后将移除该项目、相关任务与笔记，确认删除？" : "Delete this project and all related tasks/notes?",
    deleteTaskConfirm: locale === "zh-CN" ? "确认删除这个任务？" : "Delete this task?",
    editProject: locale === "zh-CN" ? "编辑项目" : "Edit Project",
    editTask: locale === "zh-CN" ? "编辑任务" : "Edit Task",
    saveProject: locale === "zh-CN" ? "保存项目" : "Save Project",
    saveTask: locale === "zh-CN" ? "保存任务" : "Save Task",
    cancelEdit: locale === "zh-CN" ? "取消编辑" : "Cancel Edit",
    updateTaskHint: locale === "zh-CN" ? "正在编辑任务" : "Editing task",
    calendarPlanner: locale === "zh-CN" ? "日历编排" : "Calendar Planner",
    calendarStart: locale === "zh-CN" ? "设置开始日期" : "Set Start Date",
    calendarDue: locale === "zh-CN" ? "设置截止日期" : "Set Due Date",
    calendarHint: locale === "zh-CN" ? "点击日期直接写入任务表单" : "Click a day to assign into task form",
    monthWeek: locale === "zh-CN" ? ["日", "一", "二", "三", "四", "五", "六"] : ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
    quickCreateHint: locale === "zh-CN" ? "双击单日、拖拽区间，或 Shift+点击跨月选区后创建" : "Double-click, drag a range, or Shift-click across months to create",
    quickCreateEsc: locale === "zh-CN" ? "按 Esc 清除当前选区" : "Press Esc to clear current range",
    plannedRange: locale === "zh-CN" ? "计划" : "Planned",
    actualRange: locale === "zh-CN" ? "实际" : "Actual",
    notStarted: locale === "zh-CN" ? "未开始" : "Not started",
    notFinished: locale === "zh-CN" ? "未完成" : "Not finished",
    projectQuickCreateHint: locale === "zh-CN" ? "通过弹窗快速创建项目" : "Create a project in a quick modal",
    delete: locale === "zh-CN" ? "删除" : "Delete",
    deleteTask: locale === "zh-CN" ? "删除任务" : "Delete Task",
    invalidProjectPayload: locale === "zh-CN" ? "项目数据不合法" : "Invalid project payload",
    invalidTaskPayload: locale === "zh-CN" ? "任务数据不合法" : "Invalid task payload",
    invalidNotePayload: locale === "zh-CN" ? "笔记数据不合法" : "Invalid note payload",
    notificationsHelp: locale === "zh-CN" ? "截止提醒和变更通知" : "Desktop alerts for deadlines and updates",
    privacyHelp: locale === "zh-CN" ? "在共享屏幕时隐藏敏感内容" : "Hide sensitive content in shared screens",
    telemetryHelp: locale === "zh-CN" ? "匿名使用统计" : "Anonymous usage analytics",
    windowSize: locale === "zh-CN" ? "窗口大小" : "Window Size",
    windowSizeDesc: locale === "zh-CN" ? "预设或自定义窗口尺寸" : "Apply a preset or custom window size",
    windowPreset: locale === "zh-CN" ? "窗口预设" : "Window Preset",
    windowSmall: locale === "zh-CN" ? "小 (1024x720)" : "Small (1024x720)",
    windowMedium: locale === "zh-CN" ? "中 (1280x800)" : "Medium (1280x800)",
    windowLarge: locale === "zh-CN" ? "大 (1440x900)" : "Large (1440x900)",
    windowCustom: locale === "zh-CN" ? "自定义" : "Custom",
    windowWidth: locale === "zh-CN" ? "宽度" : "Width",
    windowHeight: locale === "zh-CN" ? "高度" : "Height",
    applyWindowSize: locale === "zh-CN" ? "应用窗口尺寸" : "Apply Window Size",
    windowDesktopOnly: locale === "zh-CN" ? "仅桌面端可调整窗口尺寸" : "Window sizing is available in desktop runtime only",
    projectDateAdjustHint: locale === "zh-CN" ? "日期可随时调整" : "Dates can be adjusted later",
    ganttZoom: locale === "zh-CN" ? "缩放" : "Zoom",
    ganttCompact: locale === "zh-CN" ? "紧凑" : "Compact",
    ganttComfortable: locale === "zh-CN" ? "标准" : "Comfortable",
    ganttDetailed: locale === "zh-CN" ? "详细" : "Detailed",
    ganttFilter: locale === "zh-CN" ? "状态筛选" : "Status Filter",
    ganttAll: locale === "zh-CN" ? "全部" : "All",
    ganttToday: locale === "zh-CN" ? "今天" : "Today",
    ganttProgress: locale === "zh-CN" ? "进度" : "Progress",
    ganttEmpty: locale === "zh-CN" ? "当前筛选下没有任务" : "No tasks in current filter",
    workhourSummary: locale === "zh-CN" ? "工时统计" : "Work Hour Summary",
    plannedHours: locale === "zh-CN" ? "预估工时" : "Planned Hours",
    spentHours: locale === "zh-CN" ? "已耗工时" : "Spent Hours",
    remainingHours: locale === "zh-CN" ? "剩余工时" : "Remaining Hours",
    overrunHours: locale === "zh-CN" ? "超出工时" : "Overrun Hours",
    utilizationRate: locale === "zh-CN" ? "利用率" : "Utilization",
    confirmDeleteTitle: locale === "zh-CN" ? "删除确认" : "Delete Confirmation",
    confirmAction: locale === "zh-CN" ? "确认" : "Confirm",
    autoTrackWork: locale === "zh-CN" ? "任务完成自动记录工时" : "Auto record work when task is done",
    autoTrackWorkHelp: locale === "zh-CN" ? "完成任务时自动将已耗工时补齐到预估工时" : "Auto fill spent hours to estimate when finishing a task",
    logWorkTitle: locale === "zh-CN" ? "记录完成工时" : "Log Work Hours",
    logWorkDesc: locale === "zh-CN" ? "输入任务完成时的已耗工时" : "Enter spent hours when marking task done",
    useRangeHours: locale === "zh-CN" ? "按起止时间默认" : "Use Date Range Default",
    rangeHoursHint: locale === "zh-CN" ? "优先按实际开始到完成时间计算，无实际开始时按计划每天 8 小时" : "Prefer actual start-to-finish duration; fallback to 8h/day on planned range",
    saveAndFinish: locale === "zh-CN" ? "保存并完成" : "Save and Finish",
    taskFlow: locale === "zh-CN" ? "执行流程" : "Execution Flow",
    nextStep: locale === "zh-CN" ? "下一步" : "Next",
    backStep: locale === "zh-CN" ? "回退" : "Back",
    startExecution: locale === "zh-CN" ? "开始执行" : "Start Execution",
    completeExecution: locale === "zh-CN" ? "完成并记录工时" : "Complete & Log Hours",
    reopenExecution: locale === "zh-CN" ? "重新打开" : "Reopen",
    backToTodo: locale === "zh-CN" ? "回到待办" : "Back to Todo",
    backToDoing: locale === "zh-CN" ? "回到执行中" : "Back to In Progress",
    taskModalTitleCreate: locale === "zh-CN" ? "新建任务" : "Create Task",
    taskModalTitleEdit: locale === "zh-CN" ? "编辑任务" : "Edit Task",
    openTaskModal: locale === "zh-CN" ? "打开任务表单" : "Open Task Form",
    createFromRange: locale === "zh-CN" ? "从选区新建" : "Create from Range",
    parentTask: locale === "zh-CN" ? "父任务" : "Parent Task",
    noParentTask: locale === "zh-CN" ? "无（顶级任务）" : "None (Top-level)",
    subtask: locale === "zh-CN" ? "子任务" : "Subtask",
    splitByAi: locale === "zh-CN" ? "AI 拆分" : "AI Split",
    splitProjectByAi: locale === "zh-CN" ? "AI 分解项目" : "AI Project Breakdown",
    aiSplitTitle: locale === "zh-CN" ? "AI 子任务拆分" : "AI Subtask Split",
    aiSplitDesc: locale === "zh-CN" ? "使用本机 Ollama 生成子任务" : "Use local Ollama to generate subtasks",
    aiProjectSplitTitle: locale === "zh-CN" ? "AI 项目分解" : "AI Project Decomposition",
    aiProjectSplitDesc: locale === "zh-CN" ? "按项目目标生成任务树（含子任务）" : "Generate a task tree for the project",
    ollamaModel: locale === "zh-CN" ? "Ollama 模型" : "Ollama Model",
    splitCount: locale === "zh-CN" ? "拆分数量" : "Subtask Count",
    splitPrompt: locale === "zh-CN" ? "拆分要求" : "Split Prompt",
    splitPromptPlaceholder:
      locale === "zh-CN" ? "例如：先做技术验证，再实现核心功能，最后补测试与文档" : "e.g. Validate approach, implement core, then tests and docs",
    splitDateRange: locale === "zh-CN" ? "规划时间范围" : "Planning Date Range",
    splitFormatPrompt: locale === "zh-CN" ? "生成格式提示词" : "Generation Format Prompt",
    splitFormatPromptHint:
      locale === "zh-CN"
        ? "可直接复制给模型，确保输出为可解析 JSON。"
        : "Copy this prompt for the model to ensure parseable JSON output.",
    copyFormatPrompt: locale === "zh-CN" ? "复制提示词" : "Copy Prompt",
    copied: locale === "zh-CN" ? "已复制" : "Copied",
    copyFailed: locale === "zh-CN" ? "复制失败，请手动复制" : "Copy failed. Please copy manually.",
    generateSubtasks: locale === "zh-CN" ? "生成子任务" : "Generate Subtasks",
    aiSplitProgress: locale === "zh-CN" ? "生成进度" : "Generation Progress",
    aiPhasePreparing: locale === "zh-CN" ? "准备请求" : "Preparing request",
    aiPhaseGenerating: locale === "zh-CN" ? "模型推理中" : "Model is generating",
    aiPhaseParsing: locale === "zh-CN" ? "解析结果" : "Parsing response",
    aiPhaseSaving: locale === "zh-CN" ? "写入子任务" : "Saving subtasks",
    aiPhaseDone: locale === "zh-CN" ? "完成" : "Completed",
    ollamaUnavailable:
      locale === "zh-CN"
        ? "无法连接 Ollama，请确认本机已启动：ollama serve（默认 http://127.0.0.1:11434）"
        : "Cannot reach Ollama. Start it with `ollama serve` at http://127.0.0.1:11434.",
    aiSplitInvalid: locale === "zh-CN" ? "AI 返回格式异常，未生成子任务" : "AI response format is invalid. No subtasks created.",
    aiSplitDone: locale === "zh-CN" ? "已生成子任务" : "Subtasks created",
    aiProjectSplitInvalid: locale === "zh-CN" ? "AI 返回格式异常，未生成任务树" : "AI response format is invalid. No task tree created.",
    aiProjectSplitDone: locale === "zh-CN" ? "已生成项目任务树" : "Project task tree created",
    refreshModels: locale === "zh-CN" ? "刷新模型" : "Refresh Models",
    loadingModels: locale === "zh-CN" ? "正在读取本地模型..." : "Loading local models...",
    noLocalModels: locale === "zh-CN" ? "未发现本地模型，请先执行 ollama pull" : "No local model found. Run `ollama pull` first.",
    tauriOnlyModelList: locale === "zh-CN" ? "模型动态列表仅桌面端可用" : "Dynamic model list is available in desktop runtime only",
    dailyCheckinTitle: locale === "zh-CN" ? "今日个人打卡" : "Daily Personal Check-in",
    dailyCheckinDesc: locale === "zh-CN" ? "记录状态，形成长期个人趋势" : "Track your state and build long-term personal trends",
    mood: locale === "zh-CN" ? "心情" : "Mood",
    energy: locale === "zh-CN" ? "精力" : "Energy",
    focusHoursToday: locale === "zh-CN" ? "专注时长(小时)" : "Focused Hours",
    reflection: locale === "zh-CN" ? "今日复盘" : "Reflection",
    saveCheckin: locale === "zh-CN" ? "保存打卡" : "Save Check-in",
    checkinSaved: locale === "zh-CN" ? "已保存" : "Saved",
    personalInsights: locale === "zh-CN" ? "个人洞察" : "Personal Insights",
    checkinStreak: locale === "zh-CN" ? "连续打卡" : "Streak",
    sevenDayMood: locale === "zh-CN" ? "近7天心情均值" : "7-Day Mood Avg",
    sevenDayEnergy: locale === "zh-CN" ? "近7天精力均值" : "7-Day Energy Avg",
    sevenDayFocus: locale === "zh-CN" ? "近7天专注时长" : "7-Day Focus Hours",
    dayUnit: locale === "zh-CN" ? "天" : "days",
    noCheckinYet: locale === "zh-CN" ? "还没有打卡记录" : "No check-in data yet",
    latestReflection: locale === "zh-CN" ? "最近复盘" : "Latest Reflection",
    checkinInvalid: locale === "zh-CN" ? "打卡数据不合法" : "Invalid check-in data",
    moodOptions: locale === "zh-CN" ? ["1 很差", "2 偏低", "3 一般", "4 不错", "5 很好"] : ["1 Very Low", "2 Low", "3 Neutral", "4 Good", "5 Great"],
    energyOptions: locale === "zh-CN" ? ["1 透支", "2 疲惫", "3 尚可", "4 充沛", "5 极佳"] : ["1 Drained", "2 Tired", "3 Fair", "4 Energetic", "5 Peak"],
  };
  const autoTrackWorkOnDone = settings.autoTrackWorkOnDone ?? true;

  const isTauriWindowApiAvailable =
    typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

  const applyWindowSize = useCallback(
    async (width: number, height: number) => {
      if (!isTauriWindowApiAvailable) {
        return;
      }
      const safeWidth = Math.max(900, Math.round(width));
      const safeHeight = Math.max(600, Math.round(height));
      try {
        const appWindow = getCurrentWindow();
        await appWindow.setSize(new LogicalSize(safeWidth, safeHeight));
        await appWindow.center();
      } catch (error) {
        console.error("Failed to apply window size", error);
      }
    },
    [isTauriWindowApiAvailable],
  );

  useEffect(() => {
    const root = document.documentElement;
    const darkMode =
      settings.theme === "dark" ||
      (settings.theme === "system" &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    root.classList.toggle("dark", darkMode);
  }, [settings.theme]);

  useEffect(() => {
    void applyWindowSize(settings.windowWidth, settings.windowHeight);
  }, [applyWindowSize, settings.windowHeight, settings.windowWidth]);

  const scopedTasks = useMemo(
    () => (selectedProjectId ? tasks.filter((task) => task.projectId === selectedProjectId) : tasks),
    [selectedProjectId, tasks],
  );
  const scopedProjects = useMemo(
    () => (selectedProjectId ? projects.filter((project) => project.id === selectedProjectId) : projects),
    [projects, selectedProjectId],
  );
  const [ganttZoom, setGanttZoom] = useState<"compact" | "comfortable" | "detailed">("comfortable");
  const [ganttStatusFilter, setGanttStatusFilter] = useState<"all" | TaskStatus>("all");
  const ganttTasks = useMemo(
    () => (ganttStatusFilter === "all" ? scopedTasks : scopedTasks.filter((task) => task.status === ganttStatusFilter)),
    [ganttStatusFilter, scopedTasks],
  );
  const sortedScopedTasks = useMemo(
    () =>
      [...scopedTasks].sort((a, b) => {
        const statusDiff = TASK_STATUS_ORDER[a.status] - TASK_STATUS_ORDER[b.status];
        if (statusDiff !== 0) {
          return statusDiff;
        }
        if (a.startDate !== b.startDate) {
          return a.startDate.localeCompare(b.startDate);
        }
        if (a.dueDate !== b.dueDate) {
          return a.dueDate.localeCompare(b.dueDate);
        }
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [scopedTasks],
  );
  const taskTitleMap = useMemo(() => new Map(tasks.map((task) => [task.id, task.title])), [tasks]);
  const taskHierarchy = useMemo(() => {
    const childrenMap = new Map<string, Task[]>();
    const roots: Task[] = [];
    for (const task of sortedScopedTasks) {
      if (task.parentTaskId && sortedScopedTasks.some((item) => item.id === task.parentTaskId)) {
        const list = childrenMap.get(task.parentTaskId) ?? [];
        list.push(task);
        childrenMap.set(task.parentTaskId, list);
      } else {
        roots.push(task);
      }
    }
    const ordered: Array<{ task: Task; depth: number; isLast: boolean; ancestorHasSibling: boolean[] }> = [];
    const visit = (task: Task, depth: number, isLast: boolean, ancestorHasSibling: boolean[]) => {
      ordered.push({ task, depth, isLast, ancestorHasSibling });
      const children = childrenMap.get(task.id) ?? [];
      for (let index = 0; index < children.length; index += 1) {
        const child = children[index];
        const childIsLast = index === children.length - 1;
        visit(child, depth + 1, childIsLast, [...ancestorHasSibling, !isLast]);
      }
    };
    for (let index = 0; index < roots.length; index += 1) {
      const root = roots[index];
      const rootIsLast = index === roots.length - 1;
      visit(root, 0, rootIsLast, []);
    }
    return ordered;
  }, [sortedScopedTasks]);

  const kpi = useMemo(() => workspaceMetrics(scopedProjects, scopedTasks), [scopedProjects, scopedTasks]);
  const gantt = useMemo(() => timelineBounds(ganttTasks.length > 0 ? ganttTasks : scopedTasks), [ganttTasks, scopedTasks]);
  const taskStatusData = useMemo(() => {
    const total = Math.max(scopedTasks.length, 1);
    const todo = scopedTasks.filter((task) => task.status === "todo").length;
    const doing = scopedTasks.filter((task) => task.status === "doing").length;
    const done = scopedTasks.filter((task) => task.status === "done").length;
    return {
      total,
      items: [
        { key: "todo", label: t.status.todo, value: todo, className: "bg-slate-500" },
        { key: "doing", label: t.status.doing, value: doing, className: "bg-amber-500" },
        { key: "done", label: t.status.done, value: done, className: "bg-emerald-500" },
      ],
    };
  }, [scopedTasks, t.status.done, t.status.doing, t.status.todo]);
  const priorityData = useMemo(() => {
    const low = scopedTasks.filter((task) => task.priority === "low").length;
    const medium = scopedTasks.filter((task) => task.priority === "medium").length;
    const high = scopedTasks.filter((task) => task.priority === "high").length;
    const total = Math.max(scopedTasks.length, 1);
    const lowPct = Math.round((low / total) * 100);
    const mediumPct = Math.round((medium / total) * 100);
    const highPct = Math.max(0, 100 - lowPct - mediumPct);
    const gradient = `conic-gradient(#84cc16 0% ${lowPct}%, #f59e0b ${lowPct}% ${lowPct + mediumPct}%, #f43f5e ${lowPct + mediumPct}% 100%)`;
    return { low, medium, high, total, lowPct, mediumPct, highPct, gradient };
  }, [scopedTasks]);
  const projectWorkloadData = useMemo(
    () =>
      scopedProjects.map((project) => {
        const projectTasks = scopedTasks.filter((task) => task.projectId === project.id);
        const estimate = projectTasks.reduce((sum, task) => sum + task.estimateHours, 0);
        const spent = projectTasks.reduce((sum, task) => sum + task.spentHours, 0);
        return {
          id: project.id,
          name: project.name,
          status: project.status,
          estimate,
          spent,
          ratio: estimate === 0 ? 0 : Math.min(120, Math.round((spent / estimate) * 100)),
        };
      }),
    [scopedProjects, scopedTasks],
  );
  const projectWorkloadMap = useMemo(
    () => new Map(projectWorkloadData.map((item) => [item.id, item])),
    [projectWorkloadData],
  );
  const projectHourSummary = useMemo(() => {
    const estimate = projectWorkloadData.reduce((sum, item) => sum + item.estimate, 0);
    const spent = projectWorkloadData.reduce((sum, item) => sum + item.spent, 0);
    const remaining = Math.max(0, estimate - spent);
    const overrun = Math.max(0, spent - estimate);
    const utilization = estimate === 0 ? 0 : Math.round((spent / estimate) * 100);
    return { estimate, spent, remaining, overrun, utilization };
  }, [projectWorkloadData]);
  const ganttTimelineWidth = useMemo(
    () => Math.max(GANTT_MIN_WIDTH[ganttZoom], gantt.totalDays * GANTT_PX_PER_DAY[ganttZoom]),
    [gantt.totalDays, ganttZoom],
  );
  const ganttTicks = useMemo(() => {
    const count = 5;
    return Array.from({ length: count }, (_, index) => {
      const ratio = index / (count - 1);
      const offsetDays = Math.round((gantt.totalDays - 1) * ratio);
      const date = new Date(gantt.start);
      date.setDate(gantt.start.getDate() + offsetDays);
      return {
        key: `tick-${index}-${offsetDays}`,
        ratio,
        label: formatDate(date, locale),
      };
    });
  }, [gantt.start, gantt.totalDays, locale]);
  const ganttTodayPosition = useMemo(() => {
    const today = dateToKey(new Date());
    const startKey = dateToKey(gantt.start);
    const endKey = dateToKey(gantt.end);
    if (today < startKey || today > endKey || gantt.totalDays <= 0) {
      return null;
    }
    const diffDays = (new Date(`${today}T00:00:00`).getTime() - gantt.start.getTime()) / DAY_MS;
    return Math.max(0, Math.min(100, (diffDays / gantt.totalDays) * 100));
  }, [gantt.end, gantt.start, gantt.totalDays]);
  const todayCheckinDate = useMemo(() => dateToKey(new Date()), []);
  const todayCheckin = useMemo(
    () => dailyCheckins.find((item) => item.date === todayCheckinDate),
    [dailyCheckins, todayCheckinDate],
  );
  const recentCheckins = useMemo(
    () => [...dailyCheckins].sort((a, b) => b.date.localeCompare(a.date)),
    [dailyCheckins],
  );
  const personalSummary = useMemo(() => {
    const streak = calculateCheckinStreak(recentCheckins.map((item) => item.date));
    const recent7 = recentCheckins.slice(0, 7);
    const moodAvg = recent7.length === 0 ? 0 : Math.round((recent7.reduce((sum, item) => sum + item.mood, 0) / recent7.length) * 10) / 10;
    const energyAvg = recent7.length === 0 ? 0 : Math.round((recent7.reduce((sum, item) => sum + item.energy, 0) / recent7.length) * 10) / 10;
    const focusHours = Math.round(recent7.reduce((sum, item) => sum + item.focusHours, 0) * 10) / 10;
    return { streak, moodAvg, energyAvg, focusHours };
  }, [recentCheckins]);
  const [dailyCheckinForm, setDailyCheckinForm] = useState({
    mood: 3 as 1 | 2 | 3 | 4 | 5,
    energy: 3 as 1 | 2 | 3 | 4 | 5,
    focusHours: 0,
    reflection: "",
  });
  const [dailyCheckinError, setDailyCheckinError] = useState("");
  const [dailyCheckinSaved, setDailyCheckinSaved] = useState(false);
  const [aiSplitDialog, setAiSplitDialog] = useState<{
    taskId: string;
    model: string;
    count: number;
    prompt: string;
    startDate: string;
    dueDate: string;
    pending: boolean;
    progress: number;
    phase: string;
    error: string;
    success: string;
  } | null>(null);
  const [aiProjectSplitDialog, setAiProjectSplitDialog] = useState<{
    projectId: string;
    model: string;
    count: number;
    prompt: string;
    startDate: string;
    dueDate: string;
    pending: boolean;
    progress: number;
    phase: string;
    error: string;
    success: string;
  } | null>(null);
  const [ollamaModels, setOllamaModels] = useState<string[]>([]);
  const [ollamaModelsLoading, setOllamaModelsLoading] = useState(false);
  const [ollamaModelsError, setOllamaModelsError] = useState("");
  const [aiFormatCopied, setAiFormatCopied] = useState(false);
  const [aiProjectFormatCopied, setAiProjectFormatCopied] = useState(false);

  const [projectForm, setProjectForm] = useState({
    name: "",
    description: "",
    startDate: "2026-02-12",
    endDate: "2026-02-25",
  });
  const [taskForm, setTaskForm] = useState<TaskFormState>({
    projectId: selectedProjectId ?? projects[0]?.id ?? "",
    parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
    title: "",
    status: TASK_CREATE_DEFAULTS.status,
    priority: TASK_CREATE_DEFAULTS.priority,
    startDate: "2026-02-12",
    dueDate: "2026-02-15",
    estimateHours: TASK_CREATE_DEFAULTS.estimateHours,
    spentHours: TASK_CREATE_DEFAULTS.spentHours,
  });
  const [noteForm, setNoteForm] = useState({
    projectId: selectedProjectId ?? "",
    title: "",
    content: "",
  });
  const [projectError, setProjectError] = useState("");
  const [taskError, setTaskError] = useState("");
  const [noteError, setNoteError] = useState("");
  const [projectDialogOpen, setProjectDialogOpen] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const parentTaskCandidates = useMemo(
    () =>
      tasks
        .filter((task) => task.projectId === taskForm.projectId && (!editingTaskId || task.id !== editingTaskId))
        .sort((a, b) => a.startDate.localeCompare(b.startDate) || a.createdAt.localeCompare(b.createdAt)),
    [editingTaskId, taskForm.projectId, tasks],
  );
  const [calendarCursor, setCalendarCursor] = useState(() => startOfMonth(new Date()));
  const [calendarTarget, setCalendarTarget] = useState<"start" | "due">("start");
  const [selectedRangeStart, setSelectedRangeStart] = useState("");
  const [selectedRangeEnd, setSelectedRangeEnd] = useState("");
  const [dragRangeStart, setDragRangeStart] = useState("");
  const [dragRangeEnd, setDragRangeEnd] = useState("");
  const [rangeMoved, setRangeMoved] = useState(false);
  const [showRangeCreateAction, setShowRangeCreateAction] = useState(false);
  const [suppressCalendarClick, setSuppressCalendarClick] = useState(false);
  const [rangeAnchorDate, setRangeAnchorDate] = useState("");
  const [taskDialogOpen, setTaskDialogOpen] = useState(false);
  const [deleteDialog, setDeleteDialog] = useState<{ kind: "project" | "task"; id: string } | null>(null);
  const [worklogDialog, setWorklogDialog] = useState<{ taskId: string; spentHours: number } | null>(null);
  const monthGrid = useMemo(() => getMonthGrid(calendarCursor), [calendarCursor]);
  const todayKey = useMemo(() => dateToKey(new Date()), []);
  const taskCalendarMap = useMemo(() => {
    const map = new Map<string, { id: string; title: string; status: TaskStatus }[]>();
    const sourceTasks = tasks.filter((task) => !taskForm.projectId || task.projectId === taskForm.projectId);
    for (const task of sourceTasks) {
      const start = new Date(`${task.startDate}T00:00:00`);
      const end = new Date(`${task.dueDate}T00:00:00`);
      const cursor = new Date(start);
      while (cursor <= end) {
        const key = dateToKey(cursor);
        const list = map.get(key) ?? [];
        list.push({ id: task.id, title: task.title, status: task.status });
        map.set(key, list);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [taskForm.projectId, tasks]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") {
        return;
      }
      if (worklogDialog) {
        setWorklogDialog(null);
        return;
      }
      if (aiSplitDialog) {
        setAiSplitDialog(null);
        return;
      }
      if (aiProjectSplitDialog) {
        setAiProjectSplitDialog(null);
        return;
      }
      if (deleteDialog) {
        setDeleteDialog(null);
        return;
      }
      if (taskDialogOpen) {
        setTaskDialogOpen(false);
        setEditingTaskId(null);
        return;
      }
      if (projectDialogOpen) {
        setProjectDialogOpen(false);
        setEditingProjectId(null);
        return;
      }
      setSelectedRangeStart("");
      setSelectedRangeEnd("");
      setDragRangeStart("");
      setDragRangeEnd("");
      setRangeMoved(false);
      setShowRangeCreateAction(false);
      setRangeAnchorDate("");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [aiProjectSplitDialog, aiSplitDialog, deleteDialog, projectDialogOpen, taskDialogOpen, worklogDialog]);

  useEffect(() => {
    if (!todayCheckin) {
      setDailyCheckinForm({
        mood: 3,
        energy: 3,
        focusHours: 0,
        reflection: "",
      });
      setDailyCheckinSaved(false);
      return;
    }
    setDailyCheckinForm({
      mood: todayCheckin.mood,
      energy: todayCheckin.energy,
      focusHours: todayCheckin.focusHours,
      reflection: todayCheckin.reflection,
    });
    setDailyCheckinSaved(true);
  }, [todayCheckin]);

  const addProject = (event: FormEvent) => {
    event.preventDefault();
    const parsed = projectInputSchema.safeParse(projectForm);
    if (!parsed.success || projectForm.endDate < projectForm.startDate) {
      setProjectError(text.invalidProjectPayload);
      return;
    }
    if (editingProjectId) {
      updateProject(editingProjectId, parsed.data);
    } else {
      createProject(parsed.data);
    }
    setProjectForm((previous) => ({ ...previous, name: "", description: "" }));
    setProjectError("");
    setEditingProjectId(null);
    setProjectDialogOpen(false);
  };

  const commitTask = (
    payload: TaskFormState,
    options?: { forceCreate?: boolean; closeDialog?: boolean; clearTitleOnly?: boolean },
  ) => {
    const parsed = taskInputSchema.safeParse({
      ...payload,
      parentTaskId: payload.parentTaskId || undefined,
    });
    if (!parsed.success) {
      setTaskError(text.invalidTaskPayload);
      return false;
    }
    if (!options?.forceCreate && editingTaskId) {
      updateTask(editingTaskId, parsed.data);
    } else {
      createTask(parsed.data);
    }
    setTaskError("");
    if (!options?.forceCreate) {
      setEditingTaskId(null);
    }
    if (options?.clearTitleOnly) {
      setTaskForm((previous) => ({
        ...previous,
        title: "",
        spentHours: TASK_CREATE_DEFAULTS.spentHours,
        parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
      }));
    } else {
      setTaskForm((previous) => ({
        ...previous,
        parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
        title: "",
        status: TASK_CREATE_DEFAULTS.status,
        priority: TASK_CREATE_DEFAULTS.priority,
        estimateHours: TASK_CREATE_DEFAULTS.estimateHours,
        spentHours: TASK_CREATE_DEFAULTS.spentHours,
      }));
    }
    if (options?.closeDialog) {
      setTaskDialogOpen(false);
    }
    return true;
  };

  const addTask = (event: FormEvent) => {
    event.preventDefault();
    void commitTask(taskForm, { closeDialog: true, clearTitleOnly: true });
  };

  const addNote = (event: FormEvent) => {
    event.preventDefault();
    const parsed = noteInputSchema.safeParse(noteForm);
    if (!parsed.success) {
      setNoteError(text.invalidNotePayload);
      return;
    }
    createNote(parsed.data);
    setNoteForm((previous) => ({ ...previous, title: "", content: "" }));
    setNoteError("");
  };

  const saveDailyCheckin = (event: FormEvent) => {
    event.preventDefault();
    const parsed = dailyCheckinInputSchema.safeParse({
      date: todayCheckinDate,
      mood: dailyCheckinForm.mood,
      energy: dailyCheckinForm.energy,
      focusHours: dailyCheckinForm.focusHours,
      reflection: dailyCheckinForm.reflection.trim(),
    });
    if (!parsed.success) {
      setDailyCheckinError(text.checkinInvalid);
      return;
    }
    upsertDailyCheckin({
      date: parsed.data.date,
      mood: parsed.data.mood as 1 | 2 | 3 | 4 | 5,
      energy: parsed.data.energy as 1 | 2 | 3 | 4 | 5,
      focusHours: parsed.data.focusHours,
      reflection: parsed.data.reflection,
    });
    setDailyCheckinError("");
    setDailyCheckinSaved(true);
  };

  const handleDeleteProject = (projectId: string) => {
    setDeleteDialog({ kind: "project", id: projectId });
  };

  const handleDeleteTask = (taskId: string) => {
    setDeleteDialog({ kind: "task", id: taskId });
  };

  const loadOllamaModels = useCallback(async (): Promise<string[]> => {
    if (!isTauriWindowApiAvailable) {
      setOllamaModels([]);
      setOllamaModelsError(text.tauriOnlyModelList);
      return [];
    }
    setOllamaModelsLoading(true);
    setOllamaModelsError("");
    try {
      const models = await invoke<string[]>("list_ollama_models");
      setOllamaModels(models);
      if (models.length === 0) {
        setOllamaModelsError(text.noLocalModels);
      }
      return models;
    } catch {
      setOllamaModels([]);
      setOllamaModelsError(text.ollamaUnavailable);
      return [];
    } finally {
      setOllamaModelsLoading(false);
    }
  }, [isTauriWindowApiAvailable, text.noLocalModels, text.ollamaUnavailable, text.tauriOnlyModelList]);

  const aiFormatPromptTemplate = useMemo(() => {
    const count = aiSplitDialog?.count ?? 5;
    return locale === "zh-CN"
      ? `你是资深项目经理。请把任务拆分为 ${count} 个可执行子任务。只返回 JSON 数组，不要 markdown，不要解释。每项字段：title(字符串),priority(low|medium|high),estimateHours(数字),startDate(YYYY-MM-DD),dueDate(YYYY-MM-DD)。`
      : `You are a senior project planner. Split the task into ${count} actionable subtasks. Return JSON array only, no markdown, no explanation. Each item fields: title(string), priority(low|medium|high), estimateHours(number), startDate(YYYY-MM-DD), dueDate(YYYY-MM-DD).`;
  }, [aiSplitDialog?.count, locale]);
  const aiProjectFormatPromptTemplate = useMemo(() => {
    const count = aiProjectSplitDialog?.count ?? 6;
    return locale === "zh-CN"
      ? `你是资深项目经理。请基于项目目标拆分出 ${count} 个一级任务，并为每个一级任务补充 1~3 个子任务。只返回 JSON 数组，不要 markdown，不要解释。每项字段：title(字符串),priority(low|medium|high),estimateHours(数字),startDate(YYYY-MM-DD),dueDate(YYYY-MM-DD),children(同结构数组，可为空)。`
      : `You are a senior project planner. Break the project into ${count} top-level tasks, and add 1-3 subtasks for each top-level task. Return JSON array only, no markdown, no explanation. Each item fields: title(string), priority(low|medium|high), estimateHours(number), startDate(YYYY-MM-DD), dueDate(YYYY-MM-DD), children(array with same schema, optional).`;
  }, [aiProjectSplitDialog?.count, locale]);

  const copyAiFormatPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(aiFormatPromptTemplate);
      setAiFormatCopied(true);
    } catch {
      setAiSplitDialog((previous) => (previous ? { ...previous, error: text.copyFailed } : previous));
      setAiFormatCopied(false);
    }
  }, [aiFormatPromptTemplate, text.copyFailed]);
  const copyAiProjectFormatPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(aiProjectFormatPromptTemplate);
      setAiProjectFormatCopied(true);
    } catch {
      setAiProjectSplitDialog((previous) => (previous ? { ...previous, error: text.copyFailed } : previous));
      setAiProjectFormatCopied(false);
    }
  }, [aiProjectFormatPromptTemplate, text.copyFailed]);

  const openAiSplitDialog = (task: Task) => {
    setAiFormatCopied(false);
    setAiSplitDialog({
      taskId: task.id,
      model: "llama3.1:8b",
      count: 5,
      prompt: "",
      startDate: task.startDate,
      dueDate: task.dueDate,
      pending: false,
      progress: 0,
      phase: text.aiPhasePreparing,
      error: "",
      success: "",
    });
    void (async () => {
      const models = await loadOllamaModels();
      setAiSplitDialog((previous) => {
        if (!previous || previous.taskId !== task.id) {
          return previous;
        }
        const preferredModel = models.includes("llama3.1:8b")
          ? "llama3.1:8b"
          : models[0] ?? previous.model;
        return { ...previous, model: preferredModel };
      });
    })();
  };
  const openAiProjectSplitDialog = (projectId: string) => {
    const project = projects.find((item) => item.id === projectId);
    if (!project) {
      return;
    }
    setAiProjectFormatCopied(false);
    setAiProjectSplitDialog({
      projectId,
      model: "llama3.1:8b",
      count: 6,
      prompt: "",
      startDate: project.startDate,
      dueDate: project.endDate,
      pending: false,
      progress: 0,
      phase: text.aiPhasePreparing,
      error: "",
      success: "",
    });
    void (async () => {
      const models = await loadOllamaModels();
      setAiProjectSplitDialog((previous) => {
        if (!previous || previous.projectId !== projectId) {
          return previous;
        }
        const preferredModel = models.includes("llama3.1:8b")
          ? "llama3.1:8b"
          : models[0] ?? previous.model;
        return { ...previous, model: preferredModel };
      });
    })();
  };

  const submitAiSplit = async () => {
    if (!aiSplitDialog || aiSplitDialog.pending) {
      return;
    }
    const parentTask = tasks.find((task) => task.id === aiSplitDialog.taskId);
    if (!parentTask) {
      setAiSplitDialog((previous) => (previous ? { ...previous, error: text.aiSplitInvalid } : previous));
      return;
    }
    setAiSplitDialog((previous) =>
      previous
        ? {
            ...previous,
            pending: true,
            progress: 8,
            phase: text.aiPhasePreparing,
            error: "",
            success: "",
          }
        : previous,
    );
    const systemPrompt = aiFormatPromptTemplate;
    const planRange = resolveTaskRange(parentTask.startDate, parentTask.dueDate, aiSplitDialog.startDate, aiSplitDialog.dueDate);
    const planStart = planRange.startDate;
    const planDue = planRange.dueDate;
    const userPrompt =
      locale === "zh-CN"
        ? `父任务：${parentTask.title}\n项目：${projects.find((project) => project.id === parentTask.projectId)?.name ?? "-"}\n父任务时间：${parentTask.startDate} 到 ${parentTask.dueDate}\n本次拆分时间范围：${planStart} 到 ${planDue}\n附加要求：${aiSplitDialog.prompt || "无"}`
        : `Parent task: ${parentTask.title}\nProject: ${projects.find((project) => project.id === parentTask.projectId)?.name ?? "-"}\nParent task dates: ${parentTask.startDate} to ${parentTask.dueDate}\nPlanning range for this split: ${planStart} to ${planDue}\nExtra constraints: ${aiSplitDialog.prompt || "none"}`;

    let progressTicker: number | null = null;
    try {
      setAiSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: Math.max(previous.progress, 20),
              phase: text.aiPhaseGenerating,
            }
          : previous,
      );
      progressTicker = window.setInterval(() => {
        setAiSplitDialog((previous) => {
          if (!previous || !previous.pending) {
            return previous;
          }
          const nextProgress = Math.min(92, previous.progress + (previous.progress < 70 ? 7 : 3));
          return { ...previous, progress: nextProgress };
        });
      }, 350);
      const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiSplitDialog.model,
          stream: false,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { response?: string };
      setAiSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: Math.max(previous.progress, 95),
              phase: text.aiPhaseParsing,
            }
          : previous,
      );
      const drafts = parseAiSubtasks(data.response ?? "");
      if (drafts.length === 0) {
        setAiSplitDialog((previous) =>
          previous
            ? {
                ...previous,
                pending: false,
                error: text.aiSplitInvalid,
              }
            : previous,
        );
        return;
      }
      setAiSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: 97,
              phase: text.aiPhaseSaving,
            }
          : previous,
      );
      for (const draft of drafts) {
        const range = resolveTaskRange(planStart, planDue, draft.startDate, draft.dueDate);
        createTask({
          projectId: parentTask.projectId,
          parentTaskId: parentTask.id,
          title: draft.title,
          status: "todo",
          priority: draft.priority ?? parentTask.priority,
          startDate: range.startDate,
          dueDate: range.dueDate,
          estimateHours: draft.estimateHours ?? Math.max(1, Math.round(parentTask.estimateHours / Math.max(1, drafts.length))),
          spentHours: 0,
        });
      }
      setAiSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              pending: false,
              progress: 100,
              phase: text.aiPhaseDone,
              success: `${text.aiSplitDone} (${drafts.length})`,
            }
          : previous,
      );
    } catch {
      setAiSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              pending: false,
              error: text.ollamaUnavailable,
            }
          : previous,
      );
    } finally {
      if (progressTicker !== null) {
        window.clearInterval(progressTicker);
      }
    }
  };

  const submitAiProjectSplit = async () => {
    if (!aiProjectSplitDialog || aiProjectSplitDialog.pending) {
      return;
    }
    const project = projects.find((item) => item.id === aiProjectSplitDialog.projectId);
    if (!project) {
      setAiProjectSplitDialog((previous) => (previous ? { ...previous, error: text.aiProjectSplitInvalid } : previous));
      return;
    }
    setAiProjectSplitDialog((previous) =>
      previous
        ? {
            ...previous,
            pending: true,
            progress: 8,
            phase: text.aiPhasePreparing,
            error: "",
            success: "",
          }
        : previous,
    );
    const systemPrompt = aiProjectFormatPromptTemplate;
    const planRange = resolveTaskRange(project.startDate, project.endDate, aiProjectSplitDialog.startDate, aiProjectSplitDialog.dueDate);
    const planStart = planRange.startDate;
    const planDue = planRange.dueDate;
    const projectTasks = tasks.filter((item) => item.projectId === project.id);
    const existingTaskTitles = projectTasks.length === 0 ? "-" : projectTasks.map((item) => item.title).join(", ");
    const userPrompt =
      locale === "zh-CN"
        ? `项目：${project.name}\n项目说明：${project.description || "无"}\n项目时间：${project.startDate} 到 ${project.endDate}\n本次分解时间范围：${planStart} 到 ${planDue}\n现有任务：${existingTaskTitles}\n附加要求：${aiProjectSplitDialog.prompt || "无"}`
        : `Project: ${project.name}\nProject description: ${project.description || "none"}\nProject dates: ${project.startDate} to ${project.endDate}\nPlanning range for this breakdown: ${planStart} to ${planDue}\nExisting tasks: ${existingTaskTitles}\nExtra constraints: ${aiProjectSplitDialog.prompt || "none"}`;

    let progressTicker: number | null = null;
    try {
      setAiProjectSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: Math.max(previous.progress, 20),
              phase: text.aiPhaseGenerating,
            }
          : previous,
      );
      progressTicker = window.setInterval(() => {
        setAiProjectSplitDialog((previous) => {
          if (!previous || !previous.pending) {
            return previous;
          }
          const nextProgress = Math.min(92, previous.progress + (previous.progress < 70 ? 7 : 3));
          return { ...previous, progress: nextProgress };
        });
      }, 350);
      const response = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: aiProjectSplitDialog.model,
          stream: false,
          prompt: `${systemPrompt}\n\n${userPrompt}`,
        }),
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const data = (await response.json()) as { response?: string };
      setAiProjectSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: Math.max(previous.progress, 95),
              phase: text.aiPhaseParsing,
            }
          : previous,
      );
      const drafts = parseAiProjectTasks(data.response ?? "");
      if (drafts.length === 0) {
        setAiProjectSplitDialog((previous) =>
          previous
            ? {
                ...previous,
                pending: false,
                error: text.aiProjectSplitInvalid,
              }
            : previous,
        );
        return;
      }
      setAiProjectSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              progress: 97,
              phase: text.aiPhaseSaving,
            }
          : previous,
      );

      let createdCount = 0;
      const createTreeTasks = (
        nodes: AiProjectTaskDraft[],
        parentTaskId: string | undefined,
        inheritedEstimate: number,
        defaultStart: string,
        defaultDue: string,
      ) => {
        for (const node of nodes) {
          const children = node.children ?? [];
          const estimate = node.estimateHours ?? inheritedEstimate;
          const range = resolveTaskRange(defaultStart, defaultDue, node.startDate, node.dueDate);
          const createdTaskId = createTask({
            projectId: project.id,
            parentTaskId,
            title: node.title,
            status: "todo",
            priority: node.priority ?? "medium",
            startDate: range.startDate,
            dueDate: range.dueDate,
            estimateHours: Math.max(1, estimate),
            spentHours: 0,
          });
          createdCount += 1;
          if (children.length > 0) {
            const childFallback = Math.max(1, Math.round(Math.max(1, estimate) / children.length));
            createTreeTasks(children, createdTaskId, childFallback, range.startDate, range.dueDate);
          }
        }
      };
      createTreeTasks(drafts, undefined, 8, planStart, planDue);

      setAiProjectSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              pending: false,
              progress: 100,
              phase: text.aiPhaseDone,
              success: `${text.aiProjectSplitDone} (${createdCount})`,
            }
          : previous,
      );
    } catch {
      setAiProjectSplitDialog((previous) =>
        previous
          ? {
              ...previous,
              pending: false,
              error: text.ollamaUnavailable,
            }
          : previous,
      );
    } finally {
      if (progressTicker !== null) {
        window.clearInterval(progressTicker);
      }
    }
  };

  const getSuggestedDoneSpentHours = (task: Task, finishedAtIso: string): number => {
    if (task.spentHours > 0) {
      return task.spentHours;
    }
    if (task.actualStartDate && task.actualStartDate.includes("T")) {
      return calcElapsedHours(task.actualStartDate, finishedAtIso);
    }
    return calcRangeHours(task.startDate, task.dueDate);
  };

  const setTaskStatusWithHours = (task: Task, status: TaskStatus, spentHours?: number) => {
    updateTask(task.id, {
      projectId: task.projectId,
      parentTaskId: task.parentTaskId,
      title: task.title,
      status,
      priority: task.priority,
      startDate: task.startDate,
      dueDate: task.dueDate,
      estimateHours: task.estimateHours,
      spentHours: spentHours ?? task.spentHours,
    });
  };

  const handleTaskStatusChange = (task: Task, status: TaskStatus) => {
    if (status !== "done") {
      updateTaskStatus(task.id, status);
      return;
    }
    const finishedAtIso = new Date().toISOString();
    const defaultSpentHours = getSuggestedDoneSpentHours(task, finishedAtIso);
    if (autoTrackWorkOnDone) {
      setTaskStatusWithHours(task, "done", defaultSpentHours);
      return;
    }
    setWorklogDialog({
      taskId: task.id,
      spentHours: defaultSpentHours,
    });
  };
  const getNextActionForTask = (task: Task) => {
    if (task.status === "todo") {
      return { label: text.startExecution, status: "doing" as TaskStatus, icon: PlayCircle };
    }
    if (task.status === "doing") {
      return { label: text.completeExecution, status: "done" as TaskStatus, icon: CheckCircle2 };
    }
    return { label: text.reopenExecution, status: "doing" as TaskStatus, icon: RotateCcw };
  };

  const getBackActionForTask = (task: Task) => {
    if (task.status === "doing") {
      return { label: text.backToTodo, status: "todo" as TaskStatus };
    }
    if (task.status === "done") {
      return { label: text.backToDoing, status: "doing" as TaskStatus };
    }
    return null;
  };

  const handleEditProject = (projectId: string) => {
    const target = projects.find((project) => project.id === projectId);
    if (!target) {
      return;
    }
    setProjectForm({
      name: target.name,
      description: target.description,
      startDate: target.startDate,
      endDate: target.endDate,
    });
    setProjectError("");
    setEditingProjectId(projectId);
    setProjectDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    const target = tasks.find((task) => task.id === taskId);
    if (!target) {
      return;
    }
    setTaskForm({
      projectId: target.projectId,
      parentTaskId: target.parentTaskId ?? "",
      title: target.title,
      status: target.status,
      priority: target.priority,
      startDate: target.startDate,
      dueDate: target.dueDate,
      estimateHours: target.estimateHours,
      spentHours: target.spentHours,
    });
    setSelectedRangeStart(target.startDate);
    setSelectedRangeEnd(target.dueDate);
    setCalendarCursor(startOfMonth(new Date(`${target.startDate}T00:00:00`)));
    setDragRangeStart("");
    setDragRangeEnd("");
    setRangeMoved(false);
    setTaskError("");
    setEditingTaskId(taskId);
    setTaskDialogOpen(true);
    setView("tasks");
  };

  const cancelTaskEdit = () => {
    setEditingTaskId(null);
    setTaskError("");
    setTaskForm((previous) => ({ ...previous, title: "", spentHours: 0, parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId }));
    setTaskDialogOpen(false);
  };

  const handleCalendarPick = (date: Date) => {
    const picked = dateToKey(date);
    setRangeAnchorDate("");
    setSelectedRangeStart("");
    setSelectedRangeEnd("");
    setShowRangeCreateAction(false);
    setTaskForm((previous) => {
      if (calendarTarget === "start") {
        const nextDue = previous.dueDate < picked ? picked : previous.dueDate;
        return { ...previous, startDate: picked, dueDate: nextDue };
      }
      const nextStart = previous.startDate > picked ? picked : previous.startDate;
      return { ...previous, startDate: nextStart, dueDate: picked };
    });
  };

  const openQuickCreateTask = (date: Date) => {
    const key = dateToKey(date);
    setSelectedRangeStart(key);
    setSelectedRangeEnd(key);
    setTaskForm((previous) => ({
      ...previous,
      projectId: previous.projectId || selectedProjectId || projects[0]?.id || "",
      startDate: key,
      dueDate: key,
      title: "",
      status: TASK_CREATE_DEFAULTS.status,
      priority: TASK_CREATE_DEFAULTS.priority,
      estimateHours: TASK_CREATE_DEFAULTS.estimateHours,
      spentHours: TASK_CREATE_DEFAULTS.spentHours,
      parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
    }));
    setEditingTaskId(null);
    setTaskError("");
    setShowRangeCreateAction(false);
    setRangeAnchorDate("");
    setTaskDialogOpen(true);
  };

  const handleRangeAnchorPick = (picked: string) => {
    if (!rangeAnchorDate) {
      setRangeAnchorDate(picked);
      setSelectedRangeStart(picked);
      setSelectedRangeEnd(picked);
      setShowRangeCreateAction(false);
      return;
    }
    const [start, end] = normalizeDateRange(rangeAnchorDate, picked);
    setTaskForm((previous) => ({ ...previous, startDate: start, dueDate: end }));
    setSelectedRangeStart(start);
    setSelectedRangeEnd(end);
    setShowRangeCreateAction(true);
    setRangeAnchorDate("");
  };

  const startRangeSelection = (date: Date, event: MouseEvent<HTMLButtonElement>) => {
    if (event.shiftKey) {
      return;
    }
    const key = dateToKey(date);
    setRangeAnchorDate("");
    setDragRangeStart(key);
    setDragRangeEnd(key);
    setRangeMoved(false);
  };

  const updateRangeSelection = (date: Date) => {
    if (!dragRangeStart) {
      return;
    }
    const key = dateToKey(date);
    setDragRangeEnd(key);
    if (key !== dragRangeStart) {
      setRangeMoved(true);
    }
  };

  const finishRangeSelection = () => {
    if (!dragRangeStart || !dragRangeEnd || !rangeMoved) {
      setDragRangeStart("");
      setDragRangeEnd("");
      return;
    }
    const [start, end] = normalizeDateRange(dragRangeStart, dragRangeEnd);
    setTaskForm((previous) => ({ ...previous, startDate: start, dueDate: end }));
    setSelectedRangeStart(start);
    setSelectedRangeEnd(end);
    setShowRangeCreateAction(true);
    setSuppressCalendarClick(true);
    setDragRangeStart("");
    setDragRangeEnd("");
    setRangeMoved(false);
  };

  const openTaskModalFromSelectedRange = () => {
    if (!selectedRangeStart || !selectedRangeEnd) {
      return;
    }
    const [start, end] = normalizeDateRange(selectedRangeStart, selectedRangeEnd);
    setTaskForm((previous) => ({
      ...previous,
      projectId: previous.projectId || selectedProjectId || projects[0]?.id || "",
      parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
      startDate: start,
      dueDate: end,
      title: "",
      status: TASK_CREATE_DEFAULTS.status,
      priority: TASK_CREATE_DEFAULTS.priority,
      estimateHours: TASK_CREATE_DEFAULTS.estimateHours,
      spentHours: TASK_CREATE_DEFAULTS.spentHours,
    }));
    setEditingTaskId(null);
    setTaskError("");
    setTaskDialogOpen(true);
    setShowRangeCreateAction(false);
    setRangeAnchorDate("");
  };

  const navItems = [
    { key: "dashboard", label: t.views.dashboard, icon: LayoutDashboard },
    { key: "pomodoro", label: t.views.pomodoro, icon: Timer },
    { key: "projects", label: t.views.projects, icon: FolderKanban },
    { key: "tasks", label: t.views.tasks, icon: ListTodo },
    { key: "notes", label: t.views.notes, icon: BookText },
    { key: "settings", label: t.views.settings, icon: Settings2 },
  ] as const;

  return (
    <div className="h-dvh overflow-hidden bg-muted/20">
      <div className="mx-auto grid h-full min-h-0 max-w-[1600px] grid-cols-1 md:grid-cols-[280px_1fr]">
        <aside className="flex min-h-0 flex-col border-r bg-background/95">
          <div className="shrink-0 p-4 md:p-5">
            <h1 className="text-lg font-semibold tracking-tight">{t.appTitle}</h1>
            <p className="text-sm text-muted-foreground">{t.appSubtitle}</p>
          </div>
          <div className="shrink-0 space-y-1 px-4 md:px-5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.key}
                  variant={view === item.key ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2"
                  onClick={() => setView(item.key)}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Button>
              );
            })}
          </div>
          <Separator className="mx-4 my-3 shrink-0 md:mx-5" />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-2 md:px-5">
            <div className="space-y-2">
              {projects.map((project, index) => (
                <motion.div
                  key={project.id}
                  layout
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.18, delay: index * 0.02 }}
                  className={`w-full rounded-lg border p-3 transition ${
                    project.id === selectedProjectId ? "border-primary bg-primary/5" : "border-border hover:bg-accent/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => {
                        selectProject(project.id);
                        setTaskForm((previous) => ({ ...previous, projectId: project.id }));
                        setNoteForm((previous) => ({ ...previous, projectId: project.id }));
                      }}
                    >
                      <p className="truncate text-sm font-medium">{project.name}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <span className={`${markerBase} ${projectStatusTone[project.status]}`}>{t.status[project.status]}</span>
                        <span className="inline-flex h-2 w-2 rounded-full bg-muted-foreground/40" />
                      </div>
                    </button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="text-destructive hover:text-destructive"
                      onClick={() => handleDeleteProject(project.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
          <div className="shrink-0 border-t bg-muted/30 p-3 md:p-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{t.sidebar.shortcuts}</div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px] text-muted-foreground">
              <div className="flex items-center gap-2">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-gradient-to-b from-muted to-muted/80 px-1.5 font-mono text-[10px] font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] dark:shadow-[0_2px_0_0_rgb(255,255,255,0.05)]">Ctrl+N</kbd>
                <span>{t.sidebar.shortcutsList.newProject}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-gradient-to-b from-muted to-muted/80 px-1.5 font-mono text-[10px] font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] dark:shadow-[0_2px_0_0_rgb(255,255,255,0.05)]">Space</kbd>
                <span>{t.sidebar.shortcutsList.toggleTimer}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-gradient-to-b from-muted to-muted/80 px-1.5 font-mono text-[10px] font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] dark:shadow-[0_2px_0_0_rgb(255,255,255,0.05)]">R</kbd>
                <span>{t.sidebar.shortcutsList.resetTimer}</span>
              </div>
              <div className="flex items-center gap-2">
                <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-border/60 bg-gradient-to-b from-muted to-muted/80 px-1.5 font-mono text-[10px] font-medium shadow-[0_2px_0_0_rgb(0,0,0,0.1)] dark:shadow-[0_2px_0_0_rgb(255,255,255,0.05)]">1-6</kbd>
                <span>{t.sidebar.shortcutsList.switchView}</span>
              </div>
            </div>
          </div>
        </aside>

        <main
          className={`panel-scroll min-h-0 p-4 md:p-6 ${
            view === "tasks" || view === "pomodoro" ? "flex flex-col gap-4 overflow-hidden" : "space-y-4 overflow-y-auto"
          }`}
        >
          {view !== "pomodoro" && (
          <header className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-xl font-semibold tracking-tight">{t.views[view]}</h2>
            {currentProject && view !== "settings" ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="outline">{currentProject.name}</Badge>
                <span className={`${markerBase} ${projectStatusTone[currentProject.status]}`}>{t.status[currentProject.status]}</span>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="text-destructive hover:text-destructive"
                  onClick={() => handleDeleteProject(currentProject.id)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Select
                  value={currentProject.status}
                  onValueChange={(value) => updateProjectStatus(currentProject.id, value as ProjectStatus)}
                >
                  <SelectTrigger className={`h-8 w-[130px] ${projectStatusTriggerTone[currentProject.status]}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        <span className={`${markerBase} ${projectStatusTone[status]}`}>{t.status[status]}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : null}
          </header>
          )}

          <AnimatePresence mode="wait" initial={false}>
            {view === "dashboard" ? (
            <motion.section key="dashboard" className="space-y-4" {...pageTransition}>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  { label: t.kpi.projects, value: kpi.projects, icon: FolderKanban, tone: "text-sky-600" },
                  { label: t.kpi.tasks, value: kpi.tasks, icon: ListTodo, tone: "text-indigo-600" },
                  { label: t.kpi.completionRate, value: `${kpi.completionRate}%`, icon: CheckCircle2, tone: "text-emerald-600" },
                  { label: t.kpi.remainingDays, value: `${kpi.remainingDays} ${t.units.days}`, icon: CalendarDays, tone: "text-amber-600" },
                ].map((item, index) => (
                  <motion.div
                    key={item.label}
                    layout
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: index * 0.03 }}
                  >
                    <Card>
                      <CardHeader className="pb-2">
                        <CardDescription className="flex items-center gap-2">
                          <item.icon className={`h-4 w-4 ${item.tone}`} />
                          <span>{item.label}</span>
                        </CardDescription>
                        <CardTitle className="text-2xl">{item.value}</CardTitle>
                      </CardHeader>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-[1.3fr_1fr]">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                      <HeartPulse className="h-4 w-4 text-rose-500" />
                      {text.dailyCheckinTitle}
                    </CardTitle>
                    <CardDescription>{text.dailyCheckinDesc}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form className="space-y-3" onSubmit={saveDailyCheckin}>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="space-y-2">
                          <Label>{text.mood}</Label>
                          <Select
                            value={`${dailyCheckinForm.mood}`}
                            onValueChange={(value) => {
                              setDailyCheckinForm((previous) => ({ ...previous, mood: Number(value) as 1 | 2 | 3 | 4 | 5 }));
                              setDailyCheckinSaved(false);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((level) => (
                                <SelectItem key={`mood-${level}`} value={`${level}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${moodColors[level as 1 | 2 | 3 | 4 | 5]}`} />
                                    {text.moodOptions[level - 1]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{text.energy}</Label>
                          <Select
                            value={`${dailyCheckinForm.energy}`}
                            onValueChange={(value) => {
                              setDailyCheckinForm((previous) => ({ ...previous, energy: Number(value) as 1 | 2 | 3 | 4 | 5 }));
                              setDailyCheckinSaved(false);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {[1, 2, 3, 4, 5].map((level) => (
                                <SelectItem key={`energy-${level}`} value={`${level}`}>
                                  <div className="flex items-center gap-2">
                                    <span className={`h-2.5 w-2.5 rounded-full ${energyColors[level as 1 | 2 | 3 | 4 | 5]}`} />
                                    {text.energyOptions[level - 1]}
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label>{text.focusHoursToday}</Label>
                        <Input
                          type="number"
                          min={0}
                          max={24}
                          step={0.5}
                          value={dailyCheckinForm.focusHours}
                          onChange={(event) => {
                            setDailyCheckinForm((previous) => ({ ...previous, focusHours: Math.max(0, Number(event.currentTarget.value) || 0) }));
                            setDailyCheckinSaved(false);
                          }}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>{text.reflection}</Label>
                        <Textarea
                          value={dailyCheckinForm.reflection}
                          onChange={(event) => {
                            setDailyCheckinForm((previous) => ({ ...previous, reflection: event.currentTarget.value }));
                            setDailyCheckinSaved(false);
                          }}
                          placeholder={locale === "zh-CN" ? "例如：今天最有效的工作方式是什么？" : "What worked best for you today?"}
                        />
                      </div>
                      {dailyCheckinError ? <p className="text-sm text-destructive">{dailyCheckinError}</p> : null}
                      <div className="flex items-center justify-end gap-2">
                        {dailyCheckinSaved ? <span className="text-xs text-emerald-600">{text.checkinSaved}</span> : null}
                        <Button type="submit">{text.saveCheckin}</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="h-4 w-4" />
                      {text.personalInsights}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="rounded-md border p-2">
                        <div className="flex items-center gap-1.5">
                          <Flame className="h-3.5 w-3.5 text-orange-500" />
                          <p className="text-xs text-muted-foreground">{text.checkinStreak}</p>
                        </div>
                        <p className="text-lg font-semibold">{personalSummary.streak} {text.dayUnit}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="flex items-center gap-1.5">
                          <Battery className="h-3.5 w-3.5 text-blue-500" />
                          <p className="text-xs text-muted-foreground">{text.sevenDayFocus}</p>
                        </div>
                        <p className="text-lg font-semibold">{personalSummary.focusHours}h</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="flex items-center gap-1.5">
                          <Smile className="h-3.5 w-3.5 text-emerald-500" />
                          <p className="text-xs text-muted-foreground">{text.sevenDayMood}</p>
                        </div>
                        <p className="text-lg font-semibold">{personalSummary.moodAvg || "-"}</p>
                      </div>
                      <div className="rounded-md border p-2">
                        <div className="flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-violet-500" />
                          <p className="text-xs text-muted-foreground">{text.sevenDayEnergy}</p>
                        </div>
                        <p className="text-lg font-semibold">{personalSummary.energyAvg || "-"}</p>
                      </div>
                    </div>
                    <Separator />
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">{text.latestReflection}</p>
                      {recentCheckins.length === 0 ? (
                        <p className="text-sm text-muted-foreground">{text.noCheckinYet}</p>
                      ) : (
                        recentCheckins.slice(0, 3).map((item) => (
                          <div key={item.id} className="rounded-md border p-2">
                            <p className="text-xs text-muted-foreground">{formatDate(item.date, locale)}</p>
                            <p className="text-sm">{item.reflection || "-"}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      {text.taskStatusChart}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {taskStatusData.items.map((item) => {
                      const width = Math.max(6, Math.round((item.value / taskStatusData.total) * 100));
                      return (
                        <div key={item.key} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span>{item.label}</span>
                            <span className="text-muted-foreground">{item.value}</span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <motion.div
                              className={`h-2 rounded-full ${item.className}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${width}%` }}
                              transition={{ duration: 0.35, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <PieChart className="h-4 w-4" />
                      {text.priorityChart}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center gap-4">
                      <motion.div
                        className="h-24 w-24 rounded-full border"
                        style={{ backgroundImage: priorityData.gradient }}
                        initial={{ rotate: -50, opacity: 0.8 }}
                        animate={{ rotate: 0, opacity: 1 }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                      <div className="space-y-1 text-xs">
                        <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-lime-500" />{t.priority.low}: {priorityData.low}</p>
                        <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-orange-500" />{t.priority.medium}: {priorityData.medium}</p>
                        <p><span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />{t.priority.high}: {priorityData.high}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <BarChart3 className="h-4 w-4" />
                      {text.workloadChart}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {projectWorkloadData.length === 0 ? (
                      <p className="text-xs text-muted-foreground">{text.workloadEmpty}</p>
                    ) : (
                      projectWorkloadData.map((item) => (
                        <div key={item.id} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="truncate pr-2">{item.name}</span>
                            <span className="text-muted-foreground">
                              {item.spent}/{item.estimate || 0}h
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-muted">
                            <motion.div
                              className={`h-2 rounded-full ${item.ratio > 100 ? "bg-red-500" : "bg-cyan-500"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.max(4, Math.min(100, item.ratio))}%` }}
                              transition={{ duration: 0.35, ease: "easeOut" }}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <CardTitle>{t.section.gantt}</CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Label className="text-xs text-muted-foreground">{text.ganttZoom}</Label>
                      <Select value={ganttZoom} onValueChange={(value) => setGanttZoom(value as "compact" | "comfortable" | "detailed")}>
                        <SelectTrigger className="h-8 w-[128px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="compact">{text.ganttCompact}</SelectItem>
                          <SelectItem value="comfortable">{text.ganttComfortable}</SelectItem>
                          <SelectItem value="detailed">{text.ganttDetailed}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-muted-foreground">{text.ganttFilter}</span>
                    <Button size="sm" variant={ganttStatusFilter === "all" ? "default" : "outline"} onClick={() => setGanttStatusFilter("all")}>
                      {text.ganttAll}
                    </Button>
                    <Button size="sm" variant={ganttStatusFilter === "todo" ? "default" : "outline"} onClick={() => setGanttStatusFilter("todo")}>
                      {t.status.todo}
                    </Button>
                    <Button size="sm" variant={ganttStatusFilter === "doing" ? "default" : "outline"} onClick={() => setGanttStatusFilter("doing")}>
                      {t.status.doing}
                    </Button>
                    <Button size="sm" variant={ganttStatusFilter === "done" ? "default" : "outline"} onClick={() => setGanttStatusFilter("done")}>
                      {t.status.done}
                    </Button>
                    <div className="ml-auto flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-slate-400" />{t.status.todo}</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" />{t.status.doing}</span>
                      <span className="inline-flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />{t.status.done}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto pb-1">
                    <div
                      className="relative space-y-2"
                      style={{ width: `${ganttTimelineWidth + 280}px`, minWidth: `${ganttTimelineWidth + 280}px` }}
                    >
                      {ganttTodayPosition !== null ? (
                        <span
                          className="pointer-events-none absolute bottom-0 z-30 w-px -translate-x-1/2 bg-primary/90"
                          style={{
                            top: "45px",
                            left: `calc(${GANTT_LABEL_WIDTH + GANTT_TRACK_GAP}px + (${ganttTimelineWidth}px * ${ganttTodayPosition / 100}))`,
                          }}
                        />
                      ) : null}
                      <div className="flex items-end gap-2">
                        <p className="w-[260px] text-xs text-muted-foreground">{t.field.taskTitle}</p>
                        <div className="relative h-12 shrink-0 border-b" style={{ width: `${ganttTimelineWidth}px` }}>
                          {ganttTodayPosition !== null ? (
                            <>
                              <span
                                className="absolute top-0 z-30 -translate-x-1/2 whitespace-nowrap rounded-full border bg-background/95 px-2 py-0.5 text-[10px] font-medium text-primary shadow-sm"
                                style={{ left: `clamp(20px, ${ganttTodayPosition}%, calc(100% - 20px))` }}
                              >
                                {text.ganttToday}
                              </span>
                              <div className="absolute inset-y-0 z-30" style={{ left: `${ganttTodayPosition}%` }}>
                                <span className="absolute top-4 -bottom-px left-1/2 w-px -translate-x-1/2 bg-primary/80" />
                                <span className="absolute top-4 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full border border-primary/70 bg-background" />
                              </div>
                            </>
                          ) : null}
                          {ganttTicks.map((tick, index) => (
                            <div key={tick.key} className="absolute inset-y-0" style={{ left: `${tick.ratio * 100}%` }}>
                              <span
                                className={`absolute top-0 text-[10px] text-muted-foreground whitespace-nowrap ${
                                  index === 0
                                    ? "left-0 translate-x-0"
                                    : index === ganttTicks.length - 1
                                      ? "right-0 translate-x-0"
                                      : "left-1/2 -translate-x-1/2"
                                }`}
                                style={{ top: "24px" }}
                              >
                                {tick.label}
                              </span>
                              <span className="absolute bottom-0 left-1/2 h-2 w-px -translate-x-1/2 bg-border/90" />
                            </div>
                          ))}
                        </div>
                      </div>
                      {ganttTasks.length === 0 ? (
                        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">{text.ganttEmpty}</div>
                      ) : null}
                      {ganttTasks.map((task) => {
                        const start = new Date(`${task.startDate}T00:00:00`).getTime();
                        const end = new Date(`${task.dueDate}T00:00:00`).getTime();
                        const left = ((start - gantt.start.getTime()) / DAY_MS / gantt.totalDays) * 100;
                        const width = ((end - start + DAY_MS) / DAY_MS / gantt.totalDays) * 100;
                        const progress = task.estimateHours === 0 ? 0 : Math.min(999, Math.round((task.spentHours / task.estimateHours) * 100));
                        return (
                          <div key={task.id} className="flex items-center gap-2">
                            <div className="w-[260px] min-w-0">
                              <p className="truncate text-sm">{task.title}</p>
                              <p className="text-xs text-muted-foreground flex items-center gap-2">
                                <span>{formatDate(task.startDate, locale)} - {formatDate(task.dueDate, locale)}</span>
                                <span className={`${markerBase} border-violet-500/40 bg-violet-500/10 text-violet-700 dark:text-violet-300`}>
                                  {text.ganttProgress}: {progress}%
                                </span>
                              </p>
                            </div>
                            <div className="relative h-7 shrink-0 overflow-hidden rounded-full border bg-muted" style={{ width: `${ganttTimelineWidth}px` }}>
                              <div
                                className={`absolute top-1 z-10 h-5 rounded-full ${ganttTaskBarTone[task.status]}`}
                                title={`${task.title} (${formatDate(task.startDate, locale)} - ${formatDate(task.dueDate, locale)})`}
                                style={{ left: `${Math.max(0, left)}%`, width: `${Math.max(3, width)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.section>
          ) : null}

          {view === "projects" ? (
            <motion.section key="projects" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]" {...pageTransition}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FolderKanban className="h-4 w-4" />
                    {t.section.projectManager}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border bg-muted/30 p-3">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">{t.section.projectManager}</p>
                      <p className="text-xs text-muted-foreground">{text.projectQuickCreateHint}</p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      className="gap-2"
                      onClick={() => {
                        setEditingProjectId(null);
                        setProjectError("");
                        setProjectForm({
                          name: "",
                          description: "",
                          startDate: "2026-02-12",
                          endDate: "2026-02-25",
                        });
                        setProjectDialogOpen(true);
                      }}
                    >
                      <Plus className="h-4 w-4" />
                      {t.action.addProject}
                    </Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`${markerBase} ${projectStatusTone.planning}`}>{t.status.planning}</span>
                    <span className={`${markerBase} ${projectStatusTone.active}`}>{t.status.active}</span>
                    <span className={`${markerBase} ${projectStatusTone.completed}`}>{t.status.completed}</span>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4" />
                    {t.views.projects}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-2 lg:grid-cols-5">
                    {[
                      { label: text.plannedHours, value: projectHourSummary.estimate, tone: "border-sky-500/30 text-sky-700 dark:text-sky-300" },
                      { label: text.spentHours, value: projectHourSummary.spent, tone: "border-amber-500/30 text-amber-700 dark:text-amber-300" },
                      { label: text.remainingHours, value: projectHourSummary.remaining, tone: "border-emerald-500/30 text-emerald-700 dark:text-emerald-300" },
                      { label: text.overrunHours, value: projectHourSummary.overrun, tone: "border-rose-500/30 text-rose-700 dark:text-rose-300" },
                      { label: text.utilizationRate, value: `${projectHourSummary.utilization}%`, tone: "border-violet-500/30 text-violet-700 dark:text-violet-300" },
                    ].map((item) => (
                      <div key={item.label} className={`rounded-md border px-2.5 py-2 ${item.tone}`}>
                        <p className="text-[11px]">{item.label}</p>
                        <p className="text-sm font-semibold">
                          {typeof item.value === "number" ? `${item.value} ${t.units.hours}` : item.value}
                        </p>
                      </div>
                    ))}
                  </div>
                  {projects.map((project, index) => (
                    <motion.div
                      key={project.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.03 }}
                      className="rounded-lg border p-3"
                    >
                      {(() => {
                        const workload = projectWorkloadMap.get(project.id);
                        const estimate = workload?.estimate ?? 0;
                        const spent = workload?.spent ?? 0;
                        const remaining = Math.max(0, estimate - spent);
                        const utilization = estimate === 0 ? 0 : Math.round((spent / estimate) * 100);
                        return (
                          <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium">{project.name}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`${markerBase} ${projectStatusTone[project.status]}`}>{t.status[project.status]}</span>
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            className="h-8 gap-1 px-2"
                            onClick={() => openAiProjectSplitDialog(project.id)}
                          >
                            <Sparkles className="h-4 w-4" />
                            {text.splitProjectByAi}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2"
                            onClick={() => handleEditProject(project.id)}
                          >
                            <Pencil className="h-4 w-4" />
                            {text.editProject}
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-8 gap-1 px-2 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteProject(project.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {text.delete}
                          </Button>
                        </div>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{formatDate(project.startDate, locale)} - {formatDate(project.endDate, locale)}</span>
                        <span className={`${markerBase} border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300`}>
                          {projectProgress(project.id, tasks)}%
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {text.actualRange}:{" "}
                        {project.actualStartDate ? formatDate(project.actualStartDate, locale) : text.notStarted}
                        {" - "}
                        {project.actualEndDate ? formatDate(project.actualEndDate, locale) : text.notFinished}
                      </p>
                      <div className="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground sm:grid-cols-3">
                        <span>{text.plannedHours}: {estimate} {t.units.hours}</span>
                        <span>{text.spentHours}: {spent} {t.units.hours}</span>
                        <span>{text.remainingHours}: {remaining} {t.units.hours}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-muted">
                        <div
                          className={`h-1.5 rounded-full ${utilization > 100 ? "bg-rose-500" : "bg-cyan-500"}`}
                          style={{ width: `${Math.max(4, Math.min(100, utilization))}%` }}
                        />
                      </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.section>
          ) : null}

          {view === "tasks" ? (
            <motion.section key="tasks" className="grid h-full min-h-0 grid-cols-1 gap-4 overflow-hidden xl:grid-cols-[1.3fr_1fr]" {...pageTransition}>
              <div className="min-h-0 space-y-4 overflow-hidden">
                <Card>
                  <CardHeader className="space-y-3">
                    <CardTitle className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" />
                      {text.calendarPlanner}
                    </CardTitle>
                    <div className="flex flex-wrap items-center gap-2">
                      <Button type="button" size="sm" variant={calendarTarget === "start" ? "default" : "outline"} onClick={() => setCalendarTarget("start")}>
                        {text.calendarStart}
                      </Button>
                      <Button type="button" size="sm" variant={calendarTarget === "due" ? "default" : "outline"} onClick={() => setCalendarTarget("due")}>
                        {text.calendarDue}
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setCalendarCursor((prev) => addMonths(prev, -1))}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <p className="text-sm font-medium">
                        {calendarCursor.toLocaleDateString(locale, { year: "numeric", month: "long" })}
                      </p>
                      <Button type="button" size="icon-sm" variant="ghost" onClick={() => setCalendarCursor((prev) => addMonths(prev, 1))}>
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[11px] text-muted-foreground">
                      {text.monthWeek.map((item) => (
                        <span key={item}>{item}</span>
                      ))}
                    </div>
                    <div className="grid grid-cols-7 gap-1" onMouseLeave={finishRangeSelection}>
                      {monthGrid.map((day) => {
                        const key = dateToKey(day);
                        const isToday = key === todayKey;
                        const isCurrentMonth = day.getMonth() === calendarCursor.getMonth();
                        const isPicked = calendarTarget === "start" ? taskForm.startDate === key : taskForm.dueDate === key;
                        const [rangeStart, rangeEnd] = dragRangeStart && dragRangeEnd ? normalizeDateRange(dragRangeStart, dragRangeEnd) : ["", ""];
                        const isInDraftRange = rangeStart !== "" && key >= rangeStart && key <= rangeEnd;
                        const [selectedStart, selectedEnd] =
                          selectedRangeStart && selectedRangeEnd
                            ? normalizeDateRange(selectedRangeStart, selectedRangeEnd)
                            : ["", ""];
                        const isInSelectedRange = selectedStart !== "" && key >= selectedStart && key <= selectedEnd;
                        const dayTasks = taskCalendarMap.get(key) ?? [];
                        return (
                          <button
                            key={key}
                            type="button"
                            className={`min-h-16 rounded-md border p-1 text-left text-xs transition ${
                              isInDraftRange
                                ? "border-blue-400 bg-blue-500/15"
                                : isInSelectedRange
                                  ? "border-primary/70 bg-primary/15"
                                : isPicked
                                ? "border-primary bg-primary/10"
                                : isToday
                                  ? "border-cyan-500/70 bg-cyan-500/10"
                                : isCurrentMonth
                                  ? "border-border hover:bg-accent/40"
                                  : "border-border/50 text-muted-foreground/60"
                            }`}
                            onClick={(event: MouseEvent<HTMLButtonElement>) => {
                              if (suppressCalendarClick) {
                                setSuppressCalendarClick(false);
                                return;
                              }
                              if (rangeMoved) {
                                setRangeMoved(false);
                                return;
                              }
                              if (event.shiftKey) {
                                handleRangeAnchorPick(key);
                                return;
                              }
                              handleCalendarPick(day);
                            }}
                            onMouseDown={(event) => startRangeSelection(day, event)}
                            onMouseEnter={() => updateRangeSelection(day)}
                            onMouseUp={finishRangeSelection}
                            onDoubleClick={() => openQuickCreateTask(day)}
                          >
                            <p className="mb-1 flex items-center justify-end gap-1 text-[11px]">
                              {day.getDate()}
                              {isToday ? <span className="inline-block h-1.5 w-1.5 rounded-full bg-cyan-500" /> : null}
                            </p>
                            <div className="space-y-1">
                              {dayTasks.slice(0, 2).map((task) => (
                                <span
                                  key={task.id}
                                  role="button"
                                  tabIndex={0}
                                  className={`block cursor-pointer truncate rounded px-1 py-0.5 text-[10px] ${
                                    task.status === "done"
                                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300"
                                      : task.status === "doing"
                                        ? "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                        : "bg-slate-500/15 text-slate-700 dark:text-slate-300"
                                  }`}
                                  onMouseDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    handleEditTask(task.id);
                                  }}
                                  onKeyDown={(event) => {
                                    if (event.key === "Enter" || event.key === " ") {
                                      event.preventDefault();
                                      handleEditTask(task.id);
                                    }
                                  }}
                                >
                                  {task.title}
                                </span>
                              ))}
                              {dayTasks.length > 2 ? <span className="text-[10px] text-muted-foreground">+{dayTasks.length - 2}</span> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">
                        {text.calendarHint} · {text.quickCreateHint} · {text.quickCreateEsc}
                      </p>
                      {showRangeCreateAction && selectedRangeStart && selectedRangeEnd ? (
                        <Button type="button" size="xs" className="h-7 gap-1 px-2.5" onClick={openTaskModalFromSelectedRange}>
                          <Plus className="h-3.5 w-3.5" />
                          {text.createFromRange}
                        </Button>
                      ) : null}
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between rounded-md border bg-muted/30 p-3">
                      <p className="text-xs text-muted-foreground">{text.openTaskModal}</p>
                      <Button
                        type="button"
                        className="gap-2"
                        onClick={() => {
                          if (!taskForm.projectId) {
                            setTaskForm((previous) => ({
                              ...previous,
                              projectId: selectedProjectId ?? projects[0]?.id ?? "",
                              parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
                            }));
                          }
                          setEditingTaskId(null);
                          setTaskError("");
                          setTaskDialogOpen(true);
                        }}
                      >
                        <Plus className="h-4 w-4" />
                        {t.action.addTask}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Card className="flex min-h-0 flex-col">
                <CardHeader>
                  <CardTitle>{t.views.tasks}</CardTitle>
                </CardHeader>
                <CardContent className="modern-scroll min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
                  {taskHierarchy.map(({ task, depth, isLast, ancestorHasSibling }, index) => {
                    const visualDepth = Math.min(depth, 6);
                    const indentUnit = 18;
                    const branchTop = 26;
                    const currentGuideLeft = visualDepth > 0 ? (visualDepth - 1) * indentUnit + 8 : 0;
                    return (
                    <motion.div
                      key={task.id}
                      layout
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.2, delay: index * 0.02 }}
                      className="relative"
                      style={{ paddingLeft: `${visualDepth * indentUnit}px` }}
                    >
                      {Array.from({ length: visualDepth }).map((_, level) =>
                        ancestorHasSibling[level] ? (
                          <span
                            key={`${task.id}-guide-${level}`}
                            className="pointer-events-none absolute top-0 bottom-0 w-px bg-border/70"
                            style={{ left: `${level * indentUnit + 8}px` }}
                          />
                        ) : null,
                      )}
                      {visualDepth > 0 ? (
                        <>
                          <span
                            className="pointer-events-none absolute w-px bg-border/70"
                            style={{
                              left: `${currentGuideLeft}px`,
                              top: 0,
                              height: isLast ? `${branchTop}px` : "100%",
                            }}
                          />
                          <span
                            className="pointer-events-none absolute h-px bg-border/70"
                            style={{
                              left: `${currentGuideLeft}px`,
                              top: `${branchTop}px`,
                              width: `${Math.max(8, indentUnit - 6)}px`,
                            }}
                          />
                        </>
                      ) : null}
                      <div className="rounded-xl border bg-card/70 p-3 shadow-sm transition hover:shadow-md">
                      <div className="mb-2 flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">
                            {task.title}
                          </p>
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {text.plannedRange}: {formatDate(task.startDate, locale)} - {formatDate(task.dueDate, locale)}
                          </p>
                          {task.parentTaskId && taskTitleMap.has(task.parentTaskId) ? (
                            <p className="mt-0.5 text-xs text-muted-foreground">
                              {text.parentTask}: {taskTitleMap.get(task.parentTaskId)}
                            </p>
                          ) : null}
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {text.actualRange}:{" "}
                            {task.actualStartDate ? formatDateTime(task.actualStartDate, locale) : text.notStarted}
                            {" - "}
                            {task.actualEndDate ? formatDateTime(task.actualEndDate, locale) : text.notFinished}
                          </p>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button type="button" variant="outline" size="icon-xs" className="rounded-full" onClick={() => openAiSplitDialog(task)}>
                            <Sparkles className="h-3.5 w-3.5" />
                          </Button>
                          <Button type="button" variant="outline" size="icon-xs" className="rounded-full" onClick={() => handleEditTask(task.id)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon-xs"
                            className="rounded-full text-destructive hover:text-destructive"
                            onClick={() => handleDeleteTask(task.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {task.parentTaskId ? <span className={`${markerBase} border-fuchsia-500/40 bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300`}>{text.subtask}</span> : null}
                        <span className={`${markerBase} ${taskStatusTone[task.status]}`}>{t.status[task.status]}</span>
                        <span className={`${markerBase} ${priorityTone[task.priority]}`}>{t.priority[task.priority]}</span>
                        <span
                          className={`${markerBase} ${
                            task.spentHours > task.estimateHours
                              ? "border-red-500/40 bg-red-500/15 text-red-700 dark:text-red-300"
                              : task.spentHours >= task.estimateHours * 0.8
                                ? "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300"
                                : "border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300"
                          }`}
                        >
                          {task.spentHours}/{task.estimateHours} {t.units.hours}
                        </span>
                      </div>
                      {(() => {
                        const nextAction = getNextActionForTask(task);
                        const backAction = getBackActionForTask(task);
                        const NextIcon = nextAction.icon;
                        const flow = [
                          { key: "todo", label: t.status.todo },
                          { key: "doing", label: t.status.doing },
                          { key: "done", label: t.status.done },
                        ] as const;
                        const order: TaskStatus[] = ["todo", "doing", "done"];
                        const activeIndex = order.indexOf(task.status);
                        return (
                          <div className="mt-2 space-y-2 rounded-lg border border-border/70 bg-gradient-to-br from-background to-muted/25 p-2.5">
                            <div className="text-xs text-muted-foreground">{text.taskFlow}</div>
                            <div className="rounded-lg border border-border/60 bg-background/80 px-3 py-2">
                              <Steps
                                className={`task-flow-steps task-flow-status-${task.status}`}
                                current={activeIndex}
                                size="small"
                                items={flow.map((step, index) => ({
                                  title: <span className="text-xs">{step.label}</span>,
                                  status: index < activeIndex ? "finish" : index === activeIndex ? "process" : "wait",
                                }))}
                              />
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Button
                                type="button"
                                size="xs"
                                className="h-7 gap-1"
                                onClick={() => handleTaskStatusChange(task, nextAction.status)}
                              >
                                <NextIcon className="h-3.5 w-3.5" />
                                {text.nextStep}: {nextAction.label}
                              </Button>
                              {backAction ? (
                                <Button
                                  type="button"
                                  size="xs"
                                  variant="outline"
                                  className="h-7 gap-1"
                                  onClick={() => handleTaskStatusChange(task, backAction.status)}
                                >
                                  {text.backStep}: {backAction.label}
                                </Button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })()}
                      </div>
                    </motion.div>
                    );
                  })}
                </CardContent>
              </Card>
            </motion.section>
          ) : null}

          {view === "notes" ? (
            <motion.section key="notes" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]" {...pageTransition}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookText className="h-4 w-4" />
                    {t.section.noteManager}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <form className="space-y-3" onSubmit={addNote}>
                    <div className="space-y-2">
                      <Label>{t.field.project}</Label>
                      <Select value={noteForm.projectId || "__none__"} onValueChange={(value) => setNoteForm((previous) => ({ ...previous, projectId: value === "__none__" ? "" : value }))}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">-</SelectItem>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.noteTitle}</Label>
                      <Input
                        value={noteForm.title}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setNoteForm((previous) => ({ ...previous, title: value }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.noteContent}</Label>
                      <Textarea
                        rows={5}
                        value={noteForm.content}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setNoteForm((previous) => ({ ...previous, content: value }));
                        }}
                      />
                    </div>
                    {noteError ? <p className="text-sm text-destructive">{noteError}</p> : null}
                    <Button type="submit">{t.action.addNote}</Button>
                  </form>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t.views.notes}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {notes.map((note, index) => (
                    <motion.div
                      key={note.id}
                      layout
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.18, delay: index * 0.02 }}
                      className="rounded-lg border p-3"
                    >
                      <p className="text-sm font-medium">{note.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{note.content}</p>
                      <p className="mt-2 text-xs text-muted-foreground">
                        {new Date(note.updatedAt).toLocaleString(locale)}
                      </p>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.section>
          ) : null}

          {view === "pomodoro" ? (
            <PomodoroPage />
          ) : null}

          {view === "settings" ? (
            <motion.section key="settings" className="grid grid-cols-1 gap-4 xl:grid-cols-[1.2fr_1fr]" {...pageTransition}>
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Settings2 className="h-4 w-4" />
                    {t.section.settings}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.settings.language}</Label>
                      <Select value={locale} onValueChange={(value) => setLocale(value as "zh-CN" | "en-US")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="zh-CN">中文</SelectItem>
                          <SelectItem value="en-US">English</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.settings.theme}</Label>
                      <Select value={settings.theme} onValueChange={(value) => setTheme(value as "system" | "light" | "dark")}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="system">{t.settings.system}</SelectItem>
                          <SelectItem value="light">{t.settings.light}</SelectItem>
                          <SelectItem value="dark">{t.settings.dark}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t.settings.notifications}</p>
                        <p className="text-xs text-muted-foreground">{text.notificationsHelp}</p>
                      </div>
                      <Switch checked={settings.notificationsEnabled} onCheckedChange={(checked) => updateSettings({ notificationsEnabled: checked })} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{text.autoTrackWork}</p>
                        <p className="text-xs text-muted-foreground">{text.autoTrackWorkHelp}</p>
                      </div>
                      <Switch
                        checked={autoTrackWorkOnDone}
                        onCheckedChange={(checked) => updateSettings({ autoTrackWorkOnDone: checked })}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t.settings.privacy}</p>
                        <p className="text-xs text-muted-foreground">{text.privacyHelp}</p>
                      </div>
                      <Switch checked={settings.privacyMode} onCheckedChange={(checked) => updateSettings({ privacyMode: checked })} />
                    </div>
                    <div className="flex items-center justify-between rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{t.settings.telemetry}</p>
                        <p className="text-xs text-muted-foreground">{text.telemetryHelp}</p>
                      </div>
                      <Switch checked={settings.telemetryEnabled} onCheckedChange={(checked) => updateSettings({ telemetryEnabled: checked })} />
                    </div>
                    <div className="space-y-3 rounded-lg border p-3">
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{text.windowSize}</p>
                        <p className="text-xs text-muted-foreground">{text.windowSizeDesc}</p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="space-y-2">
                          <Label>{text.windowPreset}</Label>
                          <Select
                            value={settings.windowSizePreset}
                            onValueChange={(value) => {
                              const preset = value as WindowSizePreset;
                              if (preset === "custom") {
                                updateSettings({ windowSizePreset: "custom" });
                                return;
                              }
                              const next = WINDOW_PRESETS[preset];
                              updateSettings({
                                windowSizePreset: preset,
                                windowWidth: next.width,
                                windowHeight: next.height,
                              });
                              void applyWindowSize(next.width, next.height);
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="small">{text.windowSmall}</SelectItem>
                              <SelectItem value="medium">{text.windowMedium}</SelectItem>
                              <SelectItem value="large">{text.windowLarge}</SelectItem>
                              <SelectItem value="custom">{text.windowCustom}</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>{text.windowWidth}</Label>
                          <Input
                            type="number"
                            min={900}
                            max={3840}
                            value={settings.windowWidth}
                            disabled={settings.windowSizePreset !== "custom"}
                            onChange={(event) => {
                              updateSettings({
                                windowSizePreset: "custom",
                                windowWidth: Math.max(900, Number(event.currentTarget.value) || 900),
                              });
                            }}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>{text.windowHeight}</Label>
                          <Input
                            type="number"
                            min={600}
                            max={2160}
                            value={settings.windowHeight}
                            disabled={settings.windowSizePreset !== "custom"}
                            onChange={(event) => {
                              updateSettings({
                                windowSizePreset: "custom",
                                windowHeight: Math.max(600, Number(event.currentTarget.value) || 600),
                              });
                            }}
                          />
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-xs text-muted-foreground">
                          {isTauriWindowApiAvailable ? `${settings.windowWidth} x ${settings.windowHeight}` : text.windowDesktopOnly}
                        </p>
                        <Button
                          type="button"
                          size="sm"
                          disabled={!isTauriWindowApiAvailable}
                          onClick={() => {
                            const width = Math.max(900, Number(settings.windowWidth) || 1280);
                            const height = Math.max(600, Number(settings.windowHeight) || 800);
                            updateSettings({
                              windowSizePreset: "custom",
                              windowWidth: width,
                              windowHeight: height,
                            });
                            void applyWindowSize(width, height);
                          }}
                        >
                          {text.applyWindowSize}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>{t.settings.account}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t.field.name}</Label>
                      <Input value={settings.accountName} onChange={(event) => updateSettings({ accountName: event.currentTarget.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.email}</Label>
                      <Input type="email" value={settings.accountEmail} onChange={(event) => updateSettings({ accountEmail: event.currentTarget.value })} />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-4 w-4" />
                      {t.section.cache}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <Label>{t.settings.cacheRetention}</Label>
                      <Input
                        type="number"
                        min={1}
                        max={365}
                        value={settings.cacheRetentionDays}
                        onChange={(event) => updateSettings({ cacheRetentionDays: Number(event.currentTarget.value) || 1 })}
                      />
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t.settings.cacheLastCleaned}: {cacheClearedAt ? new Date(cacheClearedAt).toLocaleString(locale) : "-"}
                    </p>
                    <Button variant="outline" className="w-full gap-2" onClick={clearCache}>
                      <Trash2 className="h-4 w-4" />
                      {t.action.clearCache}
                    </Button>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4" />
                      {t.sidebar.about}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.sidebar.version}</span>
                      <span className="text-sm font-medium">0.1.0</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">{t.sidebar.developer}</span>
                      <span className="text-sm font-medium">Plan Manager Team</span>
                    </div>
                    <Separator />
                    <div className="text-center text-xs text-muted-foreground">
                      <p className="font-medium">{t.appTitle}</p>
                      <p className="mt-1">{t.appSubtitle}</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.section>
          ) : null}
          </AnimatePresence>
        </main>
      </div>
      <AnimatePresence>
      {projectDialogOpen ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
          <Card className="w-full max-w-2xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FolderKanban className="h-4 w-4" />
                {editingProjectId ? text.editProject : t.action.addProject}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-3" onSubmit={addProject}>
                <div className="space-y-2">
                  <Label>{t.field.name}</Label>
                  <Input
                    value={projectForm.name}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setProjectForm((previous) => ({ ...previous, name: value }));
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t.field.description}</Label>
                  <Textarea
                    value={projectForm.description}
                    onChange={(event) => {
                      const { value } = event.currentTarget;
                      setProjectForm((previous) => ({ ...previous, description: value }));
                    }}
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{t.field.startDate}</Label>
                    <Input
                      type="date"
                      value={projectForm.startDate}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setProjectForm((previous) => ({ ...previous, startDate: value }));
                      }}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>{t.field.endDate}</Label>
                    <Input
                      type="date"
                      value={projectForm.endDate}
                      onChange={(event) => {
                        const { value } = event.currentTarget;
                        setProjectForm((previous) => ({ ...previous, endDate: value }));
                      }}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                  <span>{text.projectDateAdjustHint}</span>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className={`${markerBase} ${projectStatusTone.planning}`}>{t.status.planning}</span>
                </div>
                {projectError ? <p className="text-sm text-destructive">{projectError}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setProjectDialogOpen(false);
                      setEditingProjectId(null);
                    }}
                  >
                    {text.cancel}
                  </Button>
                  <Button type="submit" className="gap-2">
                    {editingProjectId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingProjectId ? text.saveProject : t.action.addProject}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
          </motion.div>
        </motion.div>
      ) : null}
      {taskDialogOpen ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-3xl"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ListTodo className="h-4 w-4" />
                  {editingTaskId ? text.taskModalTitleEdit : text.taskModalTitleCreate}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form className="space-y-3" onSubmit={addTask}>
                  {editingTaskId ? (
                    <div className="flex items-center justify-between rounded-md border border-blue-400/40 bg-blue-500/10 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
                      <span>{text.updateTaskHint}</span>
                      <Button type="button" variant="ghost" size="xs" className="h-6 gap-1" onClick={cancelTaskEdit}>
                        <XCircle className="h-3.5 w-3.5" />
                        {text.cancelEdit}
                      </Button>
                    </div>
                  ) : null}
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.field.project}</Label>
                      <Select
                        value={taskForm.projectId}
                        onValueChange={(value) =>
                          setTaskForm((previous) => ({
                            ...previous,
                            projectId: value,
                            parentTaskId: TASK_CREATE_DEFAULTS.parentTaskId,
                          }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map((project) => (
                            <SelectItem key={project.id} value={project.id}>
                              {project.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.taskTitle}</Label>
                      <Input
                        value={taskForm.title}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setTaskForm((previous) => ({ ...previous, title: value }));
                        }}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>{text.parentTask}</Label>
                    <Select
                      value={taskForm.parentTaskId || "__none__"}
                      onValueChange={(value) =>
                        setTaskForm((previous) => ({ ...previous, parentTaskId: value === "__none__" ? "" : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">{text.noParentTask}</SelectItem>
                        {parentTaskCandidates.map((task) => (
                          <SelectItem key={`parent-${task.id}`} value={task.id}>
                            {task.title}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.field.status}</Label>
                      <Select value={taskForm.status} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, status: value as TaskStatus }))}>
                        <SelectTrigger className={taskStatusTriggerTone[taskForm.status]}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATUSES.map((status) => (
                            <SelectItem key={status} value={status}>
                              <span className={`${markerBase} ${taskStatusTone[status]}`}>{t.status[status]}</span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.priority}</Label>
                      <Select value={taskForm.priority} onValueChange={(value) => setTaskForm((previous) => ({ ...previous, priority: value as "low" | "medium" | "high" }))}>
                        <SelectTrigger className={priorityTriggerTone[taskForm.priority]}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="low">
                            <span className={`${markerBase} ${priorityTone.low}`}>{t.priority.low}</span>
                          </SelectItem>
                          <SelectItem value="medium">
                            <span className={`${markerBase} ${priorityTone.medium}`}>{t.priority.medium}</span>
                          </SelectItem>
                          <SelectItem value="high">
                            <span className={`${markerBase} ${priorityTone.high}`}>{t.priority.high}</span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.field.startDate}</Label>
                      <Input type="date" value={taskForm.startDate} readOnly className="bg-muted/40" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.dueDate}</Label>
                      <Input type="date" value={taskForm.dueDate} readOnly className="bg-muted/40" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>{t.field.estimate}</Label>
                      <Input
                        type="number"
                        min={1}
                        value={taskForm.estimateHours}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setTaskForm((previous) => ({ ...previous, estimateHours: Number(value) }));
                        }}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t.field.spent}</Label>
                      <Input
                        type="number"
                        min={0}
                        value={taskForm.spentHours}
                        onChange={(event) => {
                          const { value } = event.currentTarget;
                          setTaskForm((previous) => ({ ...previous, spentHours: Number(value) }));
                        }}
                      />
                    </div>
                  </div>
                  {taskError ? <p className="text-sm text-destructive">{taskError}</p> : null}
                  <div className="flex justify-end gap-2">
                    <Button type="button" variant="outline" onClick={cancelTaskEdit}>
                      {text.cancel}
                    </Button>
                    <Button type="submit" className="gap-2">
                      {editingTaskId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                      {editingTaskId ? text.saveTask : t.action.addTask}
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
      {aiSplitDialog ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {text.aiSplitTitle}
                </CardTitle>
                <CardDescription>{text.aiSplitDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{text.ollamaModel}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-7 gap-1"
                        onClick={() => {
                          void loadOllamaModels();
                        }}
                        disabled={ollamaModelsLoading}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {text.refreshModels}
                      </Button>
                    </div>
                    {ollamaModels.length > 0 ? (
                      <Select
                        value={aiSplitDialog.model}
                        onValueChange={(value) =>
                          setAiSplitDialog((previous) => (previous ? { ...previous, model: value, error: "", success: "" } : previous))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ollamaModels.map((model) => (
                            <SelectItem key={model} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={aiSplitDialog.model}
                        onChange={(event) =>
                          setAiSplitDialog((previous) =>
                            previous
                              ? { ...previous, model: event.currentTarget.value, error: "", success: "" }
                              : previous,
                          )
                        }
                      />
                    )}
                    {ollamaModelsLoading ? <p className="text-xs text-muted-foreground">{text.loadingModels}</p> : null}
                    {ollamaModelsError ? <p className="text-xs text-muted-foreground">{ollamaModelsError}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>{text.splitCount}</Label>
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={aiSplitDialog.count}
                      onChange={(event) => {
                        const nextCount = Math.max(2, Math.min(20, Number(event.currentTarget.value) || 2));
                        setAiFormatCopied(false);
                        setAiSplitDialog((previous) =>
                          previous ? { ...previous, count: nextCount, error: "", success: "" } : previous,
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{text.splitPrompt}</Label>
                  <Textarea
                    rows={4}
                    value={aiSplitDialog.prompt}
                    placeholder={text.splitPromptPlaceholder}
                    onChange={(event) =>
                      setAiSplitDialog((previous) =>
                        previous ? { ...previous, prompt: event.currentTarget.value, error: "", success: "" } : previous,
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{text.splitDateRange}</Label>
                    <Input
                      type="date"
                      value={aiSplitDialog.startDate}
                      onChange={(event) =>
                        setAiSplitDialog((previous) =>
                          previous ? { ...previous, startDate: event.currentTarget.value, error: "", success: "" } : previous,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="opacity-0">{text.splitDateRange}</Label>
                    <Input
                      type="date"
                      value={aiSplitDialog.dueDate}
                      onChange={(event) =>
                        setAiSplitDialog((previous) =>
                          previous ? { ...previous, dueDate: event.currentTarget.value, error: "", success: "" } : previous,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{text.splitFormatPrompt}</Label>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyAiFormatPrompt}>
                      {aiFormatCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {aiFormatCopied ? text.copied : text.copyFormatPrompt}
                    </Button>
                  </div>
                  <Textarea rows={3} value={aiFormatPromptTemplate} readOnly className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground">{text.splitFormatPromptHint}</p>
                </div>
                {(aiSplitDialog.pending || aiSplitDialog.success) ? (
                  <div className="space-y-2 rounded-lg border border-black/25 bg-white p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/90">{text.aiSplitProgress}</span>
                      <span className="text-muted-foreground">{aiSplitDialog.phase}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/15">
                      <motion.div
                        className="h-full rounded-full bg-black shadow-none"
                        initial={{ width: "0%" }}
                        animate={{ width: `${Math.max(2, aiSplitDialog.progress)}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-right text-xs font-semibold tabular-nums text-black/80">{aiSplitDialog.progress}%</p>
                  </div>
                ) : null}
                {aiSplitDialog.error ? <p className="text-sm text-destructive">{aiSplitDialog.error}</p> : null}
                {aiSplitDialog.success ? <p className="text-sm text-emerald-600">{aiSplitDialog.success}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAiSplitDialog(null);
                      setAiFormatCopied(false);
                    }}
                  >
                    {text.cancel}
                  </Button>
                  <Button type="button" className="gap-2" onClick={submitAiSplit} disabled={aiSplitDialog.pending}>
                    <Sparkles className="h-4 w-4" />
                    {aiSplitDialog.pending ? `${text.generateSubtasks}...` : text.generateSubtasks}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
      {aiProjectSplitDialog ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 18, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="w-full max-w-2xl"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4" />
                  {text.aiProjectSplitTitle}
                </CardTitle>
                <CardDescription>{text.aiProjectSplitDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label>{text.ollamaModel}</Label>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="h-7 gap-1"
                        onClick={() => {
                          void loadOllamaModels();
                        }}
                        disabled={ollamaModelsLoading}
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {text.refreshModels}
                      </Button>
                    </div>
                    {ollamaModels.length > 0 ? (
                      <Select
                        value={aiProjectSplitDialog.model}
                        onValueChange={(value) =>
                          setAiProjectSplitDialog((previous) => (previous ? { ...previous, model: value, error: "", success: "" } : previous))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ollamaModels.map((model) => (
                            <SelectItem key={`project-${model}`} value={model}>
                              {model}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        value={aiProjectSplitDialog.model}
                        onChange={(event) =>
                          setAiProjectSplitDialog((previous) =>
                            previous
                              ? { ...previous, model: event.currentTarget.value, error: "", success: "" }
                              : previous,
                          )
                        }
                      />
                    )}
                    {ollamaModelsLoading ? <p className="text-xs text-muted-foreground">{text.loadingModels}</p> : null}
                    {ollamaModelsError ? <p className="text-xs text-muted-foreground">{ollamaModelsError}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label>{text.splitCount}</Label>
                    <Input
                      type="number"
                      min={2}
                      max={20}
                      value={aiProjectSplitDialog.count}
                      onChange={(event) => {
                        const nextCount = Math.max(2, Math.min(20, Number(event.currentTarget.value) || 2));
                        setAiProjectFormatCopied(false);
                        setAiProjectSplitDialog((previous) =>
                          previous ? { ...previous, count: nextCount, error: "", success: "" } : previous,
                        );
                      }}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{text.splitPrompt}</Label>
                  <Textarea
                    rows={4}
                    value={aiProjectSplitDialog.prompt}
                    placeholder={text.splitPromptPlaceholder}
                    onChange={(event) =>
                      setAiProjectSplitDialog((previous) =>
                        previous ? { ...previous, prompt: event.currentTarget.value, error: "", success: "" } : previous,
                      )
                    }
                  />
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>{text.splitDateRange}</Label>
                    <Input
                      type="date"
                      value={aiProjectSplitDialog.startDate}
                      onChange={(event) =>
                        setAiProjectSplitDialog((previous) =>
                          previous ? { ...previous, startDate: event.currentTarget.value, error: "", success: "" } : previous,
                        )
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="opacity-0">{text.splitDateRange}</Label>
                    <Input
                      type="date"
                      value={aiProjectSplitDialog.dueDate}
                      onChange={(event) =>
                        setAiProjectSplitDialog((previous) =>
                          previous ? { ...previous, dueDate: event.currentTarget.value, error: "", success: "" } : previous,
                        )
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label>{text.splitFormatPrompt}</Label>
                    <Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={copyAiProjectFormatPrompt}>
                      {aiProjectFormatCopied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      {aiProjectFormatCopied ? text.copied : text.copyFormatPrompt}
                    </Button>
                  </div>
                  <Textarea rows={4} value={aiProjectFormatPromptTemplate} readOnly className="font-mono text-xs" />
                  <p className="text-xs text-muted-foreground">{text.splitFormatPromptHint}</p>
                </div>
                {(aiProjectSplitDialog.pending || aiProjectSplitDialog.success) ? (
                  <div className="space-y-2 rounded-lg border border-black/25 bg-white p-3">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-foreground/90">{text.aiSplitProgress}</span>
                      <span className="text-muted-foreground">{aiProjectSplitDialog.phase}</span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-black/15">
                      <motion.div
                        className="h-full rounded-full bg-black shadow-none"
                        initial={{ width: "0%" }}
                        animate={{ width: `${Math.max(2, aiProjectSplitDialog.progress)}%` }}
                        transition={{ duration: 0.35, ease: "easeOut" }}
                      />
                    </div>
                    <p className="text-right text-xs font-semibold tabular-nums text-black/80">{aiProjectSplitDialog.progress}%</p>
                  </div>
                ) : null}
                {aiProjectSplitDialog.error ? <p className="text-sm text-destructive">{aiProjectSplitDialog.error}</p> : null}
                {aiProjectSplitDialog.success ? <p className="text-sm text-emerald-600">{aiProjectSplitDialog.success}</p> : null}
                <div className="flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setAiProjectSplitDialog(null);
                      setAiProjectFormatCopied(false);
                    }}
                  >
                    {text.cancel}
                  </Button>
                  <Button type="button" className="gap-2" onClick={submitAiProjectSplit} disabled={aiProjectSplitDialog.pending}>
                    <Sparkles className="h-4 w-4" />
                    {aiProjectSplitDialog.pending ? `${text.splitProjectByAi}...` : text.splitProjectByAi}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
      {deleteDialog ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Trash2 className="h-4 w-4 text-destructive" />
                  {text.confirmDeleteTitle}
                </CardTitle>
                <CardDescription>
                  {deleteDialog.kind === "project" ? text.deleteProjectConfirm : text.deleteTaskConfirm}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setDeleteDialog(null)}>
                  {text.cancel}
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    if (deleteDialog.kind === "project") {
                      deleteProject(deleteDialog.id);
                    } else {
                      deleteTask(deleteDialog.id);
                    }
                    setDeleteDialog(null);
                  }}
                >
                  {text.confirmAction}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
      {worklogDialog ? (
        <motion.div
          className="absolute inset-0 z-50 flex items-center justify-center bg-black/30 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.98 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="w-full max-w-md"
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {text.logWorkTitle}
                </CardTitle>
                <CardDescription>{text.logWorkDesc}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label>{t.field.spent}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={worklogDialog.spentHours}
                    onChange={(event) =>
                      setWorklogDialog((previous) =>
                        previous ? { ...previous, spentHours: Math.max(0, Number(event.currentTarget.value) || 0) } : previous,
                      )
                    }
                  />
                  <p className="text-xs text-muted-foreground">{text.rangeHoursHint}</p>
                </div>
                <div className="flex justify-between gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const task = tasks.find((item) => item.id === worklogDialog.taskId);
                      if (!task) {
                        setWorklogDialog(null);
                        return;
                      }
                      const finishedAtIso = new Date().toISOString();
                      setWorklogDialog({
                        taskId: task.id,
                        spentHours: getSuggestedDoneSpentHours(task, finishedAtIso),
                      });
                    }}
                  >
                    {text.useRangeHours}
                  </Button>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" onClick={() => setWorklogDialog(null)}>
                      {text.cancel}
                    </Button>
                    <Button
                      type="button"
                      onClick={() => {
                        const task = tasks.find((item) => item.id === worklogDialog.taskId);
                        if (!task) {
                          setWorklogDialog(null);
                          return;
                        }
                        setTaskStatusWithHours(task, "done", worklogDialog.spentHours);
                        setWorklogDialog(null);
                      }}
                    >
                      {text.saveAndFinish}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </motion.div>
      ) : null}
      </AnimatePresence>
    </div>
  );
}

export default App;
