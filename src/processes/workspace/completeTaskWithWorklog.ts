import type { Task, TaskStatus } from "@/entities/workspace";

type UpdateTaskStatusWithHours = (taskId: string, status: TaskStatus, spentHours?: number) => void;

export const completeTaskWithWorklog = (
  task: Task,
  suggestedSpentHours: number,
  updateTaskStatusWithHours: UpdateTaskStatusWithHours,
) => {
  updateTaskStatusWithHours(task.id, "done", Math.max(0, suggestedSpentHours));
};
