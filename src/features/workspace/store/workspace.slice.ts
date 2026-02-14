import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  AppView,
  DailyCheckin,
  Locale,
  Note,
  Project,
  ProjectStatus,
  Task,
  TaskPriority,
  TaskStatus,
  ThemeMode,
  UserSettings,
} from "@/domain/models";
import { createId, dateKey, nowIso } from "@/domain/models";

type CreateProjectPayload = {
  name: string;
  description: string;
  startDate: string;
  endDate: string;
};

type CreateTaskPayload = {
  projectId: string;
  parentTaskId?: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  startDate: string;
  dueDate: string;
  estimateHours: number;
  spentHours: number;
};

type UpdateProjectPayload = CreateProjectPayload;
type UpdateTaskPayload = CreateTaskPayload;

type CreateNotePayload = {
  projectId?: string;
  taskId?: string;
  title: string;
  content: string;
};

type UpsertDailyCheckinPayload = {
  date: string;
  mood: 1 | 2 | 3 | 4 | 5;
  energy: 1 | 2 | 3 | 4 | 5;
  focusHours: number;
  reflection: string;
};

type WorkspaceState = {
  locale: Locale;
  view: AppView;
  settings: UserSettings;
  cacheClearedAt?: string;
  selectedProjectId?: string;
  projects: Project[];
  tasks: Task[];
  notes: Note[];
  dailyCheckins: DailyCheckin[];
  setLocale: (locale: Locale) => void;
  setView: (view: AppView) => void;
  updateSettings: (payload: Partial<UserSettings>) => void;
  setTheme: (theme: ThemeMode) => void;
  clearCache: () => void;
  selectProject: (projectId?: string) => void;
  createProject: (payload: CreateProjectPayload) => void;
  updateProject: (projectId: string, payload: UpdateProjectPayload) => void;
  createTask: (payload: CreateTaskPayload) => string;
  updateTask: (taskId: string, payload: UpdateTaskPayload) => void;
  deleteTask: (taskId: string) => void;
  updateTaskStatus: (taskId: string, status: TaskStatus) => void;
  createNote: (payload: CreateNotePayload) => void;
  upsertDailyCheckin: (payload: UpsertDailyCheckinPayload) => void;
  updateProjectStatus: (projectId: string, status: ProjectStatus) => void;
  deleteProject: (projectId: string) => void;
};

const seedProjects: Project[] = [
  {
    id: "project-1",
    name: "Personal Planning Suite",
    description: "Build desktop-grade project planning and notes workflows",
    status: "active",
    startDate: "2026-02-10",
    endDate: "2026-03-01",
    actualStartDate: "2026-02-10",
    createdAt: nowIso(),
  },
  {
    id: "project-2",
    name: "Knowledge Base Refresh",
    description: "Consolidate reusable notes and templates",
    status: "planning",
    startDate: "2026-03-03",
    endDate: "2026-03-22",
    createdAt: nowIso(),
  },
];

const seedTasks: Task[] = [
  {
    id: "task-1",
    projectId: "project-1",
    title: "Define architecture and coding standards",
    status: "done",
    priority: "high",
    startDate: "2026-02-10",
    dueDate: "2026-02-13",
    actualStartDate: "2026-02-10",
    actualEndDate: "2026-02-13",
    estimateHours: 12,
    spentHours: 11,
    createdAt: nowIso(),
  },
  {
    id: "task-2",
    projectId: "project-1",
    title: "Implement project, task, and note modules",
    status: "doing",
    priority: "high",
    startDate: "2026-02-14",
    dueDate: "2026-02-21",
    actualStartDate: "2026-02-14",
    estimateHours: 26,
    spentHours: 14,
    createdAt: nowIso(),
  },
  {
    id: "task-3",
    projectId: "project-1",
    title: "Build analytics and gantt timeline",
    status: "todo",
    priority: "medium",
    startDate: "2026-02-22",
    dueDate: "2026-02-26",
    estimateHours: 16,
    spentHours: 0,
    createdAt: nowIso(),
  },
];

const seedNotes: Note[] = [
  {
    id: "note-1",
    projectId: "project-1",
    title: "Weekly checkpoint",
    content: "Keep active task count below 3 to reduce context switching.",
    updatedAt: nowIso(),
  },
];

const seedDailyCheckins: DailyCheckin[] = [
  {
    id: "checkin-1",
    date: "2026-02-12",
    mood: 4,
    energy: 4,
    focusHours: 5.5,
    reflection: "完成任务拆解后，执行阻力明显下降。",
    createdAt: nowIso(),
    updatedAt: nowIso(),
  },
];

const defaultSettings: UserSettings = {
  notificationsEnabled: true,
  autoTrackWorkOnDone: true,
  theme: "system",
  windowSizePreset: "medium",
  windowWidth: 1280,
  windowHeight: 800,
  accountName: "Admin",
  accountEmail: "admin@example.com",
  privacyMode: true,
  telemetryEnabled: false,
  cacheRetentionDays: 30,
};

const todayKey = (): string => dateKey(new Date());
const nowTimestamp = (): string => new Date().toISOString();

const applyProjectStatusLifecycle = (project: Project, nextStatus: ProjectStatus): Project => {
  const today = todayKey();
  if (nextStatus === "active") {
    return {
      ...project,
      status: "active",
      actualStartDate: project.actualStartDate ?? today,
      actualEndDate: undefined,
    };
  }
  if (nextStatus === "completed") {
    return {
      ...project,
      status: "completed",
      actualStartDate: project.actualStartDate ?? today,
      actualEndDate: today,
    };
  }
  return {
    ...project,
    status: "planning",
    actualEndDate: undefined,
  };
};

const applyTaskStatusLifecycle = (task: Task, nextStatus: TaskStatus): Task => {
  const now = nowTimestamp();
  const hasPreciseActualStart =
    typeof task.actualStartDate === "string" && task.actualStartDate.includes("T");
  if (nextStatus === "doing") {
    return {
      ...task,
      status: "doing",
      actualStartDate: hasPreciseActualStart ? task.actualStartDate : now,
      actualEndDate: undefined,
      spentHours: task.status === "doing" ? task.spentHours : 0,
    };
  }
  if (nextStatus === "done") {
    return {
      ...task,
      status: "done",
      actualEndDate: now,
    };
  }
  return {
    ...task,
    status: "todo",
    actualEndDate: undefined,
    spentHours: task.status === "todo" ? task.spentHours : 0,
  };
};

const buildTaskFromPayload = (payload: CreateTaskPayload): Omit<Task, "id" | "createdAt"> => {
  const base: Omit<Task, "id" | "createdAt"> = {
    ...payload,
    actualStartDate: undefined,
    actualEndDate: undefined,
  };
  return applyTaskStatusLifecycle(base as Task, payload.status);
};

const collectTaskAndDescendants = (tasks: Task[], rootTaskId: string): Set<string> => {
  const toDelete = new Set<string>([rootTaskId]);
  let changed = true;
  while (changed) {
    changed = false;
    for (const task of tasks) {
      if (task.parentTaskId && toDelete.has(task.parentTaskId) && !toDelete.has(task.id)) {
        toDelete.add(task.id);
        changed = true;
      }
    }
  }
  return toDelete;
};

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      locale: "zh-CN",
      view: "dashboard",
      settings: defaultSettings,
      cacheClearedAt: undefined,
      selectedProjectId: "project-1",
      projects: seedProjects,
      tasks: seedTasks,
      notes: seedNotes,
      dailyCheckins: seedDailyCheckins,
      setLocale: (locale) => set({ locale }),
      setView: (view) => set({ view }),
      updateSettings: (payload) =>
        set((state) => ({
          settings: {
            ...state.settings,
            ...payload,
          },
        })),
      setTheme: (theme) =>
        set((state) => ({
          settings: {
            ...state.settings,
            theme,
          },
        })),
      clearCache: () => {
        if (typeof sessionStorage !== "undefined") {
          sessionStorage.clear();
        }
        set({ cacheClearedAt: nowIso() });
      },
      selectProject: (projectId) => set({ selectedProjectId: projectId }),
      createProject: (payload) =>
        set((state) => {
          const project: Project = {
            id: createId("project"),
            status: "planning",
            actualStartDate: undefined,
            actualEndDate: undefined,
            createdAt: nowIso(),
            ...payload,
          };
          return {
            projects: [project, ...state.projects],
            selectedProjectId: project.id,
            view: "projects",
          };
        }),
      updateProject: (projectId, payload) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? { ...project, ...payload } : project,
          ),
        })),
      createTask: (payload) => {
        const taskId = createId("task");
        set((state) => {
          const task: Task = {
            id: taskId,
            createdAt: nowIso(),
            ...buildTaskFromPayload(payload),
          };
          return {
            tasks: [task, ...state.tasks],
            selectedProjectId: payload.projectId,
            view: "tasks",
          };
        });
        return taskId;
      },
      updateTask: (taskId, payload) =>
        set((state) => ({
          tasks: state.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }
            const next = { ...task, ...payload };
            return applyTaskStatusLifecycle(next, payload.status);
          }),
        })),
      deleteTask: (taskId) =>
        set((state) => {
          const toDelete = collectTaskAndDescendants(state.tasks, taskId);
          return {
            tasks: state.tasks.filter((task) => !toDelete.has(task.id)),
            notes: state.notes.filter((note) => !note.taskId || !toDelete.has(note.taskId)),
          };
        }),
      updateTaskStatus: (taskId, status) =>
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId ? applyTaskStatusLifecycle(task, status) : task,
          ),
        })),
      createNote: (payload) =>
        set((state) => {
          const note: Note = {
            id: createId("note"),
            updatedAt: nowIso(),
            ...payload,
          };
          return {
            notes: [note, ...state.notes],
            view: "notes",
          };
        }),
      upsertDailyCheckin: (payload) =>
        set((state) => {
          const existing = state.dailyCheckins.find((item) => item.date === payload.date);
          if (existing) {
            return {
              dailyCheckins: state.dailyCheckins.map((item) =>
                item.id === existing.id
                  ? {
                      ...item,
                      ...payload,
                      updatedAt: nowIso(),
                    }
                  : item,
              ),
            };
          }
          return {
            dailyCheckins: [
              {
                id: createId("checkin"),
                createdAt: nowIso(),
                updatedAt: nowIso(),
                ...payload,
              },
              ...state.dailyCheckins,
            ],
          };
        }),
      updateProjectStatus: (projectId, status) =>
        set((state) => ({
          projects: state.projects.map((project) =>
            project.id === projectId ? applyProjectStatusLifecycle(project, status) : project,
          ),
        })),
      deleteProject: (projectId) =>
        set((state) => {
          const projects = state.projects.filter((project) => project.id !== projectId);
          const tasks = state.tasks.filter((task) => task.projectId !== projectId);
          const notes = state.notes.filter((note) => note.projectId !== projectId);
          const nextSelected =
            state.selectedProjectId === projectId ? projects[0]?.id : state.selectedProjectId;
          return {
            projects,
            tasks,
            notes,
            selectedProjectId: nextSelected,
          };
        }),
    }),
    {
      name: "plan-manager-workspace-v1",
      partialize: (state) => ({
        locale: state.locale,
        view: state.view,
        settings: state.settings,
        cacheClearedAt: state.cacheClearedAt,
        selectedProjectId: state.selectedProjectId,
        projects: state.projects,
        tasks: state.tasks,
        notes: state.notes,
        dailyCheckins: state.dailyCheckins,
      }),
      onRehydrateStorage: () => (state) => {
        if (state && !state.selectedProjectId && state.projects.length > 0) {
          state.selectProject(state.projects[0].id);
        }
      },
    },
  ),
);

export const selectCurrentProject = (state: WorkspaceState): Project | undefined =>
  state.projects.find((project) => project.id === state.selectedProjectId) ?? state.projects[0];

export const selectProjectTasks = (state: WorkspaceState): Task[] => {
  const currentProject = getCurrentProjectId(state);
  return currentProject ? state.tasks.filter((task) => task.projectId === currentProject) : [];
};

const getCurrentProjectId = (state: WorkspaceState): string | undefined =>
  state.selectedProjectId ?? state.projects[0]?.id;

export type { WorkspaceState };
