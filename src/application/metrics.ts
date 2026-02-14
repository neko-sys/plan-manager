import type { Project, Task } from "../domain/models";

const DAY_MS = 24 * 60 * 60 * 1000;

const toDate = (value: string): Date => new Date(`${value}T00:00:00`);

export const projectProgress = (projectId: string, tasks: Task[]): number => {
  const scoped = tasks.filter((task) => task.projectId === projectId);
  if (scoped.length === 0) {
    return 0;
  }
  const done = scoped.filter((task) => task.status === "done").length;
  return Math.round((done / scoped.length) * 100);
};

export const workspaceMetrics = (projects: Project[], tasks: Task[]) => {
  const totalTasks = tasks.length;
  const doneTasks = tasks.filter((task) => task.status === "done").length;
  const completionRate = totalTasks === 0 ? 0 : Math.round((doneTasks / totalTasks) * 100);

  const today = new Date();
  const activeEndDates = projects
    .filter((project) => project.status !== "completed")
    .map((project) => toDate(project.endDate).getTime())
    .filter((time) => !Number.isNaN(time));
  const nearestEndDate =
    activeEndDates.length === 0 ? today.getTime() : Math.min(...activeEndDates);
  const remainingDays = Math.max(0, Math.ceil((nearestEndDate - today.getTime()) / DAY_MS));

  return {
    projects: projects.length,
    tasks: totalTasks,
    completionRate,
    remainingDays,
  };
};

export const timelineBounds = (tasks: Task[]) => {
  if (tasks.length === 0) {
    const now = new Date();
    return { start: now, end: now, totalDays: 1 };
  }
  const sorted = [...tasks].sort((a, b) => (a.startDate > b.startDate ? 1 : -1));
  const start = toDate(sorted[0].startDate);
  const end = toDate(sorted[0].dueDate);
  for (const task of sorted) {
    const s = toDate(task.startDate);
    const e = toDate(task.dueDate);
    if (s < start) {
      start.setTime(s.getTime());
    }
    if (e > end) {
      end.setTime(e.getTime());
    }
  }
  const totalDays = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / DAY_MS) + 1);
  return { start, end, totalDays };
};
