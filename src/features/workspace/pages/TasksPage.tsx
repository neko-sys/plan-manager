import { type ReactNode } from "react";

export function TasksPage({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
