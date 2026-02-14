import { type ReactNode } from "react";

export function NotesPage({ children }: { children?: ReactNode }) {
  return <>{children ?? null}</>;
}
