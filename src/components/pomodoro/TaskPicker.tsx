import { motion } from "motion/react";
import { Circle, Link2, Unlink } from "lucide-react";
import { useWorkspaceStore } from "@/store/workspaceStore";
import { usePomodoroStore } from "@/store/pomodoroStore";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type TaskPickerProps = {
  labels: {
    selectTask: string;
    noTask: string;
    linkedTo: string;
  };
};

export function TaskPicker({ labels }: TaskPickerProps) {
  const projects = useWorkspaceStore((s) => s.projects);
  const tasks = useWorkspaceStore((s) => s.tasks);
  const selectedTaskId = usePomodoroStore((s) => s.timer.selectedTaskId);
  const selectTask = usePomodoroStore((s) => s.selectTask);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const selectedTask = tasks.find((t) => t.id === selectedTaskId);
  const selectedProject = selectedTask
    ? projects.find((p) => p.id === selectedTask.projectId)
    : null;

  const handleTaskSelect = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (task) {
      selectTask(task.id, task.projectId);
    }
  };

  const handleUnlink = () => {
    selectTask(undefined, undefined);
  };

  const groupedTasks = activeTasks.reduce(
    (acc, task) => {
      const project = projects.find((p) => p.id === task.projectId);
      const projectName = project?.name || "无项目";
      if (!acc[projectName]) {
        acc[projectName] = [];
      }
      acc[projectName].push(task);
      return acc;
    },
    {} as Record<string, typeof activeTasks>,
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center gap-3"
    >
      {selectedTask ? (
        <div className="flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="flex items-center gap-2 rounded-full bg-muted/50 px-4 py-2"
          >
            <Link2 className="h-4 w-4 text-muted-foreground" />
            <div className="flex flex-col">
              <span className="text-sm font-medium">{selectedTask.title}</span>
              {selectedProject && (
                <span className="text-xs text-muted-foreground">{selectedProject.name}</span>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleUnlink}
              className="h-6 w-6 rounded-full hover:bg-muted"
            >
              <Unlink className="h-3 w-3" />
            </Button>
          </motion.div>
        </div>
      ) : (
        <Select value={selectedTaskId || ""} onValueChange={handleTaskSelect}>
          <SelectTrigger className="w-[280px] rounded-full border-muted-foreground/20 bg-muted/30">
            <div className="flex items-center gap-2">
              <Circle className="h-4 w-4 text-muted-foreground" />
              <SelectValue placeholder={labels.selectTask} />
            </div>
          </SelectTrigger>
          <SelectContent className="max-h-[300px]">
            {Object.entries(groupedTasks).map(([projectName, projectTasks]) => (
              <div key={projectName}>
                <div className="px-2 py-1.5 text-xs font-medium text-muted-foreground">
                  {projectName}
                </div>
                {projectTasks.map((task) => (
                  <SelectItem
                    key={task.id}
                    value={task.id}
                    className="cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          task.status === "doing"
                            ? "bg-amber-500"
                            : task.priority === "high"
                              ? "bg-rose-500"
                              : "bg-slate-400",
                        )}
                      />
                      <span>{task.title}</span>
                    </div>
                  </SelectItem>
                ))}
              </div>
            ))}
            {activeTasks.length === 0 && (
              <div className="px-2 py-4 text-center text-sm text-muted-foreground">
                {labels.noTask}
              </div>
            )}
          </SelectContent>
        </Select>
      )}
    </motion.div>
  );
}
