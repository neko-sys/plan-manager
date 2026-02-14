import { beforeEach, describe, expect, test } from "vitest";
import { useWorkspaceStore } from "@/store/workspaceStore";

describe("workspace store", () => {
  beforeEach(() => {
    localStorage.clear();
    useWorkspaceStore.setState(useWorkspaceStore.getInitialState(), true);
  });

  test("updates task lifecycle timestamps", () => {
    const initialTask = useWorkspaceStore.getState().tasks[0];
    useWorkspaceStore.getState().updateTaskStatus(initialTask.id, "doing");
    let updated = useWorkspaceStore.getState().tasks.find((t) => t.id === initialTask.id);
    expect(updated?.status).toBe("doing");
    expect(updated?.actualStartDate).toBeTruthy();

    useWorkspaceStore.getState().updateTaskStatus(initialTask.id, "done");
    updated = useWorkspaceStore.getState().tasks.find((t) => t.id === initialTask.id);
    expect(updated?.status).toBe("done");
    expect(updated?.actualEndDate).toBeTruthy();
  });

  test("deletes child tasks and related notes when deleting parent task", () => {
    const store = useWorkspaceStore.getState();
    const projectId = store.projects[0].id;
    const parentId = store.createTask({
      projectId,
      title: "Parent",
      status: "todo",
      priority: "medium",
      startDate: "2026-02-14",
      dueDate: "2026-02-15",
      estimateHours: 2,
      spentHours: 0,
    });

    const childId = store.createTask({
      projectId,
      parentTaskId: parentId,
      title: "Child",
      status: "todo",
      priority: "medium",
      startDate: "2026-02-14",
      dueDate: "2026-02-15",
      estimateHours: 1,
      spentHours: 0,
    });

    store.createNote({ projectId, taskId: childId, title: "child-note", content: "linked" });
    store.deleteTask(parentId);

    const next = useWorkspaceStore.getState();
    expect(next.tasks.find((t) => t.id === parentId)).toBeUndefined();
    expect(next.tasks.find((t) => t.id === childId)).toBeUndefined();
    expect(next.notes.find((n) => n.taskId === childId)).toBeUndefined();
  });
});
