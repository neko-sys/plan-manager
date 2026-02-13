import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PomodoroSession, PomodoroSettings, TimerPhase } from "../domain/pomodoro";
import {
  createPomodoroId,
  dateKey,
  DEFAULT_POMODORO_SETTINGS,
  getPhaseDuration,
  nowIso,
} from "../domain/pomodoro";

type TimerState = {
  phase: TimerPhase;
  remainingSeconds: number;
  totalSeconds: number;
  isRunning: boolean;
  isPaused: boolean;
  currentSessionId?: string;
  selectedTaskId?: string;
  selectedProjectId?: string;
  completedSessionsInCycle: number;
};

type PomodoroState = {
  timer: TimerState;
  settings: PomodoroSettings;
  sessions: PomodoroSession[];
  setSettings: (settings: Partial<PomodoroSettings>) => void;
  selectTask: (taskId?: string, projectId?: string) => void;
  startTimer: () => void;
  pauseTimer: () => void;
  resumeTimer: () => void;
  resetTimer: () => void;
  skipPhase: () => void;
  completeSession: () => void;
  tick: () => void;
  switchPhase: (phase: TimerPhase) => void;
  getTodayStats: () => { completed: number; focusMinutes: number; breakMinutes: number };
  getWeekStats: () => { completed: number; focusMinutes: number; breakMinutes: number };
  getMonthStats: () => { completed: number; focusMinutes: number; breakMinutes: number };
  getSessionsByDateRange: (start: string, end: string) => PomodoroSession[];
  clearSessions: () => void;
};

const initialTimerState = (settings: PomodoroSettings): TimerState => ({
  phase: "work",
  remainingSeconds: settings.workDuration * 60,
  totalSeconds: settings.workDuration * 60,
  isRunning: false,
  isPaused: false,
  currentSessionId: undefined,
  selectedTaskId: undefined,
  selectedProjectId: undefined,
  completedSessionsInCycle: 0,
});

export const usePomodoroStore = create<PomodoroState>()(
  persist(
    (set, get) => ({
      timer: initialTimerState(DEFAULT_POMODORO_SETTINGS),
      settings: DEFAULT_POMODORO_SETTINGS,
      sessions: [],

      setSettings: (payload) =>
        set((state) => {
          const newSettings = { ...state.settings, ...payload };
          const timer = state.timer;
          const newDuration = getPhaseDuration(timer.phase, newSettings) * 60;
          return {
            settings: newSettings,
            timer: {
              ...timer,
              totalSeconds: newDuration,
              remainingSeconds: timer.isRunning ? timer.remainingSeconds : newDuration,
            },
          };
        }),

      selectTask: (taskId, projectId) =>
        set((state) => ({
          timer: {
            ...state.timer,
            selectedTaskId: taskId,
            selectedProjectId: projectId,
          },
        })),

      startTimer: () =>
        set((state) => {
          const { timer } = state;
          if (timer.isRunning) return state;

          const sessionId = createPomodoroId();
          const session: PomodoroSession = {
            id: sessionId,
            taskId: timer.selectedTaskId,
            projectId: timer.selectedProjectId,
            phase: timer.phase,
            durationMinutes: Math.ceil(timer.remainingSeconds / 60),
            startedAt: nowIso(),
            isCompleted: false,
          };

          return {
            timer: {
              ...timer,
              isRunning: true,
              isPaused: false,
              currentSessionId: sessionId,
            },
            sessions: [session, ...state.sessions],
          };
        }),

      pauseTimer: () =>
        set((state) => ({
          timer: {
            ...state.timer,
            isRunning: false,
            isPaused: true,
          },
        })),

      resumeTimer: () =>
        set((state) => ({
          timer: {
            ...state.timer,
            isRunning: true,
            isPaused: false,
          },
        })),

      resetTimer: () =>
        set((state) => {
          const { settings, timer } = state;
          const duration = getPhaseDuration(timer.phase, settings) * 60;
          return {
            timer: {
              ...timer,
              remainingSeconds: duration,
              totalSeconds: duration,
              isRunning: false,
              isPaused: false,
              currentSessionId: undefined,
            },
          };
        }),

      skipPhase: () => {
        const state = get();
        if (state.timer.currentSessionId) {
          set((s) => ({
            sessions: s.sessions.map((session) =>
              session.id === state.timer.currentSessionId
                ? { ...session, isCompleted: false, completedAt: nowIso() }
                : session,
            ),
          }));
        }
        get().completeSession();
      },

      completeSession: () =>
        set((state) => {
          const { timer, settings, sessions } = state;
          const completedSessionId = timer.currentSessionId;
          const isWorkPhase = timer.phase === "work";
          const newCompletedCount = isWorkPhase
            ? timer.completedSessionsInCycle + 1
            : timer.completedSessionsInCycle;

          const shouldTakeLongBreak =
            isWorkPhase && newCompletedCount >= settings.sessionsBeforeLongBreak;
          const nextPhase: TimerPhase = isWorkPhase
            ? shouldTakeLongBreak
              ? "longBreak"
              : "shortBreak"
            : "work";
          const resetCompletedCount = shouldTakeLongBreak ? 0 : newCompletedCount;

          const nextDuration = getPhaseDuration(nextPhase, settings) * 60;

          const updatedSessions = completedSessionId
            ? sessions.map((s) =>
                s.id === completedSessionId
                  ? { ...s, isCompleted: true, completedAt: nowIso() }
                  : s,
              )
            : sessions;

          return {
            timer: {
              ...timer,
              phase: nextPhase,
              remainingSeconds: nextDuration,
              totalSeconds: nextDuration,
              isRunning: settings.autoStartBreaks && isWorkPhase ? true : settings.autoStartWork && !isWorkPhase,
              isPaused: false,
              currentSessionId: undefined,
              completedSessionsInCycle: resetCompletedCount,
            },
            sessions: updatedSessions,
          };
        }),

      tick: () =>
        set((state) => {
          const { timer } = state;
          if (!timer.isRunning || timer.remainingSeconds <= 0) return state;

          const newRemaining = timer.remainingSeconds - 1;

          if (newRemaining <= 0) {
            return {
              timer: {
                ...timer,
                remainingSeconds: 0,
                isRunning: false,
              },
            };
          }

          return {
            timer: {
              ...timer,
              remainingSeconds: newRemaining,
            },
          };
        }),

      switchPhase: (phase) =>
        set((state) => {
          const { settings, timer } = state;
          const duration = getPhaseDuration(phase, settings) * 60;
          return {
            timer: {
              ...timer,
              phase,
              remainingSeconds: duration,
              totalSeconds: duration,
              isRunning: false,
              isPaused: false,
              currentSessionId: undefined,
            },
          };
        }),

      getTodayStats: () => {
        const state = get();
        const today = dateKey(new Date());
        const todaySessions = state.sessions.filter(
          (s) => s.isCompleted && s.startedAt.slice(0, 10) === today,
        );
        return {
          completed: todaySessions.filter((s) => s.phase === "work").length,
          focusMinutes: todaySessions
            .filter((s) => s.phase === "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
          breakMinutes: todaySessions
            .filter((s) => s.phase !== "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
        };
      },

      getWeekStats: () => {
        const state = get();
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const weekStart = new Date(now);
        weekStart.setDate(diff);
        weekStart.setHours(0, 0, 0, 0);
        const weekStartKey = dateKey(weekStart);

        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekStart.getDate() + 6);
        const weekEndKey = dateKey(weekEnd);

        const weekSessions = state.sessions.filter((s) => {
          if (!s.isCompleted) return false;
          const sessionDate = s.startedAt.slice(0, 10);
          return sessionDate >= weekStartKey && sessionDate <= weekEndKey;
        });

        return {
          completed: weekSessions.filter((s) => s.phase === "work").length,
          focusMinutes: weekSessions
            .filter((s) => s.phase === "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
          breakMinutes: weekSessions
            .filter((s) => s.phase !== "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
        };
      },

      getMonthStats: () => {
        const state = get();
        const now = new Date();
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
        const monthStartKey = dateKey(monthStart);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        const monthEndKey = dateKey(monthEnd);

        const monthSessions = state.sessions.filter((s) => {
          if (!s.isCompleted) return false;
          const sessionDate = s.startedAt.slice(0, 10);
          return sessionDate >= monthStartKey && sessionDate <= monthEndKey;
        });

        return {
          completed: monthSessions.filter((s) => s.phase === "work").length,
          focusMinutes: monthSessions
            .filter((s) => s.phase === "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
          breakMinutes: monthSessions
            .filter((s) => s.phase !== "work")
            .reduce((acc, s) => acc + s.durationMinutes, 0),
        };
      },

      getSessionsByDateRange: (start, end) => {
        const state = get();
        return state.sessions.filter((s) => {
          const sessionDate = s.startedAt.slice(0, 10);
          return sessionDate >= start && sessionDate <= end;
        });
      },

      clearSessions: () => set({ sessions: [] }),
    }),
    {
      name: "plan-manager-pomodoro-v1",
      partialize: (state) => ({
        settings: state.settings,
        sessions: state.sessions,
        timer: {
          phase: state.timer.phase,
          completedSessionsInCycle: state.timer.completedSessionsInCycle,
        },
      }),
      merge: (persisted, current) => {
        const persistedState = persisted as Partial<PomodoroState>;
        const settings = persistedState.settings ?? current.settings;
        const phase = persistedState.timer?.phase ?? current.timer.phase;
        const duration = getPhaseDuration(phase, settings) * 60;
        
        return {
          ...current,
          settings,
          sessions: persistedState.sessions ?? current.sessions,
          timer: {
            ...current.timer,
            phase,
            remainingSeconds: duration,
            totalSeconds: duration,
            completedSessionsInCycle: persistedState.timer?.completedSessionsInCycle ?? 0,
          },
        };
      },
    },
  ),
);

export const selectTimerState = (state: PomodoroState) => state.timer;
export const selectSettings = (state: PomodoroState) => state.settings;
export const selectSessions = (state: PomodoroState) => state.sessions;
