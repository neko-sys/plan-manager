export {
  notifyPhaseComplete,
  notifyTimerStart,
  playNotificationSound,
  playTick,
  requestNotificationPermission,
  showDesktopNotification,
  triggerVibration,
} from "@/application/notifications";

import { notifyPhaseComplete as notifyPhaseCompleteImpl } from "@/application/notifications";
import type { PomodoroSettings, TimerPhase } from "@/entities/pomodoro";

export const notificationService = {
  notifyPhaseComplete(phase: TimerPhase, settings: PomodoroSettings) {
    notifyPhaseCompleteImpl(phase, settings);
  },
};

export type NotificationService = typeof notificationService;
