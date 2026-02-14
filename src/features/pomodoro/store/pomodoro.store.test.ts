import { beforeEach, describe, expect, test } from "vitest";
import { usePomodoroStore } from "@/store/pomodoroStore";

describe("pomodoro store", () => {
  beforeEach(() => {
    localStorage.clear();
    usePomodoroStore.setState(usePomodoroStore.getInitialState(), true);
  });

  test("completes work session and switches to short break", () => {
    const store = usePomodoroStore.getState();
    store.startTimer();
    store.completeSession();

    const next = usePomodoroStore.getState();
    expect(next.timer.phase).toBe("shortBreak");
    expect(next.sessions[0]?.isCompleted).toBe(true);
  });

  test("switches to long break after configured cycle", () => {
    usePomodoroStore.setState((state) => ({
      timer: {
        ...state.timer,
        phase: "work",
        completedSessionsInCycle: state.settings.sessionsBeforeLongBreak - 1,
      },
    }));

    const store = usePomodoroStore.getState();
    store.startTimer();
    store.completeSession();

    const next = usePomodoroStore.getState();
    expect(next.timer.phase).toBe("longBreak");
    expect(next.timer.completedSessionsInCycle).toBe(0);
  });
});
