# Plan Manager Architecture

## Scope

This project runs on `Tauri + React + TypeScript` and follows enterprise-style layering:

- `domain`: business entities and validation contracts.
- `application`: pure use-case helpers and metrics.
- `store`: state orchestration and persistence boundaries.
- `ui` (`App.tsx` + styles): presentation and interaction only.

## Directory Rules

- `src/domain/*`: no React imports, no browser APIs.
- `src/application/*`: consumes domain models only.
- `src/store/*`: state mutations and persistence wiring only.
- `src/App.tsx`: view composition, form binding, i18n selection.

## State & Persistence

- State manager: `zustand`.
- Persistence: `zustand/persist` with local storage key `plan-manager-workspace-v1`.
- Persisted slices: locale, view, selected project, projects, tasks, notes.
- Serialization format: JSON.

## Data Model

- `Project`: planning lifecycle and schedule boundaries.
- `Task`: execution item with status, priority, and effort tracking.
- `Note`: project-linked knowledge capture.

## Quality Standards

- TypeScript strict-mode compatible patterns.
- Input validation with `zod` before state mutation.
- No implicit `any`; keep payloads typed at boundaries.
- Keep side effects localized to store actions.

## UX Guidelines

- Notion-inspired low-noise UI: neutral palette, card surfaces, clear hierarchy.
- Responsive behavior:
  - > =1024px: sidebar + content.
  - <1024px: stacked shell.
  - <680px: single-column forms and analytics.

## Next Enterprise Steps

- Replace local storage with SQLite + migration pipeline.
- Add command-query split and repository adapters.
- Add lint/test pipeline:
  - ESLint + Prettier.
  - Vitest + React Testing Library.
  - Playwright E2E.
- Add audit logging and crash reporting channel.
