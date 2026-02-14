export {
  playNotificationSound,
  playTick,
  requestNotificationPermission,
  showDesktopNotification,
  triggerVibration,
  notifyPhaseComplete,
  notifyTimerStart,
} from "@/application/notifications";

import { notifyPhaseComplete as notifyPhaseCompleteImpl } from "@/application/notifications";
import type { PomodoroSettings, TimerPhase } from "@/entities/pomodoro";

export const notificationService = {
  notifyPhaseComplete(phase: TimerPhase, settings: PomodoroSettings) {
    notifyPhaseCompleteImpl(phase, settings);
  },
};

export type NotificationService = typeof notificationService;
