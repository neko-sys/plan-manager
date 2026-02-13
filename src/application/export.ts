import type { PomodoroSession } from "../domain/pomodoro";

const formatDateForExport = (isoString: string): string => {
  return new Date(isoString).toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportToJson = (sessions: PomodoroSession[], filename?: string): void => {
  const exportData = {
    exportedAt: new Date().toISOString(),
    totalSessions: sessions.length,
    sessions: sessions.map((session) => ({
      id: session.id,
      taskId: session.taskId,
      projectId: session.projectId,
      phase: session.phase,
      durationMinutes: session.durationMinutes,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      isCompleted: session.isCompleted,
    })),
  };

  const content = JSON.stringify(exportData, null, 2);
  downloadFile(
    content,
    filename || `pomodoro-export-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
  );
};

export const exportToCsv = (sessions: PomodoroSession[], filename?: string): void => {
  const headers = [
    "ID",
    "阶段",
    "时长(分钟)",
    "开始时间",
    "完成时间",
    "是否完成",
    "关联任务ID",
    "关联项目ID",
  ];

  const phaseNames: Record<string, string> = {
    work: "专注",
    shortBreak: "短休息",
    longBreak: "长休息",
  };

  const rows = sessions.map((session) => [
    session.id,
    phaseNames[session.phase] || session.phase,
    session.durationMinutes.toString(),
    formatDateForExport(session.startedAt),
    session.completedAt ? formatDateForExport(session.completedAt) : "",
    session.isCompleted ? "是" : "否",
    session.taskId || "",
    session.projectId || "",
  ]);

  const csvContent = [
    headers.join(","),
    ...rows.map((row) => row.map((cell) => `"${cell}"`).join(",")),
  ].join("\n");

  const bom = "\uFEFF";
  downloadFile(
    bom + csvContent,
    filename || `pomodoro-export-${new Date().toISOString().slice(0, 10)}.csv`,
    "text/csv;charset=utf-8",
  );
};

export const getExportStats = (sessions: PomodoroSession[]): {
  totalSessions: number;
  completedSessions: number;
  totalFocusMinutes: number;
  totalBreakMinutes: number;
  dateRange: { start: string; end: string } | null;
} => {
  const completedSessions = sessions.filter((s) => s.isCompleted);
  const workSessions = completedSessions.filter((s) => s.phase === "work");
  const breakSessions = completedSessions.filter((s) => s.phase !== "work");

  const dates = sessions.map((s) => s.startedAt.slice(0, 10)).sort();

  return {
    totalSessions: sessions.length,
    completedSessions: completedSessions.length,
    totalFocusMinutes: workSessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    totalBreakMinutes: breakSessions.reduce((acc, s) => acc + s.durationMinutes, 0),
    dateRange:
      dates.length > 0
        ? {
            start: dates[0],
            end: dates[dates.length - 1],
          }
        : null,
  };
};
