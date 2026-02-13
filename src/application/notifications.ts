import type { PomodoroSettings, TimerPhase } from "../domain/pomodoro";

type NotificationOptions = {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
};

const NOTIFICATION_TAG = "pomodoro-timer";

let audioContext: AudioContext | null = null;

const getAudioContext = (): AudioContext => {
  if (!audioContext) {
    audioContext = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  return audioContext;
};

const createBeepSound = (volume: number, frequency: number = 800, duration: number = 0.3): void => {
  try {
    const ctx = getAudioContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = frequency;
    oscillator.type = "sine";

    gainNode.gain.setValueAtTime(0, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(volume * 0.3, ctx.currentTime + 0.01);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + duration);
  } catch {
    console.warn("Failed to play sound");
  }
};

const playCompletionSound = (volume: number): void => {
  createBeepSound(volume, 880, 0.15);
  setTimeout(() => createBeepSound(volume, 1100, 0.15), 150);
  setTimeout(() => createBeepSound(volume, 1320, 0.3), 300);
};

const playTickSound = (volume: number): void => {
  createBeepSound(volume * 0.5, 600, 0.05);
};

export const playNotificationSound = (settings: PomodoroSettings): void => {
  if (!settings.soundEnabled) return;
  playCompletionSound(settings.volume);
};

export const playTick = (settings: PomodoroSettings): void => {
  if (!settings.soundEnabled) return;
  playTickSound(settings.volume);
};

export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!("Notification" in window)) {
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    return permission === "granted";
  }

  return false;
};

export const showDesktopNotification = async (
  options: NotificationOptions,
  settings: PomodoroSettings,
): Promise<void> => {
  if (!settings.notificationEnabled) return;

  const hasPermission = await requestNotificationPermission();
  if (!hasPermission) return;

  try {
    const notification = new Notification(options.title, {
      body: options.body,
      icon: options.icon,
      tag: options.tag || NOTIFICATION_TAG,
      requireInteraction: false,
    });

    notification.onclick = () => {
      window.focus();
      notification.close();
    };

    setTimeout(() => notification.close(), 5000);
  } catch {
    console.warn("Failed to show notification");
  }
};

export const triggerVibration = (settings: PomodoroSettings, pattern: number | number[] = [200, 100, 200]): void => {
  if (!settings.vibrationEnabled) return;

  if ("vibrate" in navigator) {
    try {
      navigator.vibrate(pattern);
    } catch {
      console.warn("Failed to vibrate");
    }
  }
};

export const notifyPhaseComplete = (phase: TimerPhase, settings: PomodoroSettings): void => {
  const phaseNames: Record<TimerPhase, string> = {
    work: "专注时间",
    shortBreak: "短休息",
    longBreak: "长休息",
  };

  const messages: Record<TimerPhase, string> = {
    work: "太棒了！你完成了一个番茄钟，休息一下吧。",
    shortBreak: "短休息结束，准备开始下一个番茄钟！",
    longBreak: "长休息结束，精力充沛地继续工作吧！",
  };

  playNotificationSound(settings);
  triggerVibration(settings);
  showDesktopNotification(
    {
      title: `${phaseNames[phase]}完成`,
      body: messages[phase],
    },
    settings,
  );
};

export const notifyTimerStart = (phase: TimerPhase, settings: PomodoroSettings): void => {
  const phaseNames: Record<TimerPhase, string> = {
    work: "专注时间",
    shortBreak: "短休息",
    longBreak: "长休息",
  };

  if (settings.notificationEnabled) {
    showDesktopNotification(
      {
        title: `${phaseNames[phase]}开始`,
        body: phase === "work" ? "保持专注，你可以的！" : "放松一下，休息是为了更好的工作。",
      },
      settings,
    );
  }
};
