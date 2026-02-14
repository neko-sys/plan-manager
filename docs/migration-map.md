# Migration Map

## Entry
- `src/App.tsx` -> `src/app/App.tsx` (legacy implementation in `src/app/legacy/LegacyApp.tsx`)

## Features
- `src/components/chat/*` -> `src/features/chat/pages/*` facade imports
- `src/components/pomodoro/*` -> `src/features/pomodoro/pages/*` facade imports

## State
- `src/store/workspaceStore.ts` -> `src/features/workspace/store/workspace.slice.ts` + compatibility re-export
- `src/store/chatStore.ts` -> `src/features/chat/store/chat.slice.ts` + compatibility re-export
- `src/store/pomodoroStore.ts` -> `src/features/pomodoro/store/pomodoro.slice.ts` + compatibility re-export

## Domain to entities
- `src/domain/models.ts` -> `src/entities/workspace/*` (re-export phase)
- `src/domain/chat.ts` -> `src/entities/chat/*` (re-export phase)
- `src/domain/pomodoro.ts` -> `src/entities/pomodoro/*` (re-export phase)

## Services
- New `src/services/ollama/ollamaClient.ts`
- New `src/services/tauri/commands.ts`
- New `src/services/notifications/notificationService.ts`
