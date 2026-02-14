import { type ReactNode } from "react";

export function DashboardPage({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
