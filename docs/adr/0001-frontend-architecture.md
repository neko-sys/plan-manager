# ADR-0001: Frontend Architecture Baseline

## Status

Accepted

## Date

2026-02-14

## Context

The project currently uses Tauri + React + TypeScript with an oversized `src/App.tsx` and weakly enforced layering.

## Decision

Adopt a progressive modular monolith architecture with `feature-first + layer-inside-feature`:

- `src/app`: app shell and bootstrapping.
- `src/features/*`: feature modules.
- `src/entities/*`: domain entities and schema contracts.
- `src/services/*`: infrastructure adapters.
- `src/shared/*`: cross-feature UI/utils.
- `src/processes/*`: cross-feature orchestration.

Dependency rules:

- `app` may depend on `features/entities/services/shared/processes`.
- `features` may depend on `entities/services/shared`, but not peer feature internals.
- `entities` must stay framework-agnostic.
- `services` must avoid React/UI dependencies.

## Naming and import conventions

- Prefer path aliases: `@/app`, `@/features/*`, `@/entities/*`, `@/services/*`, `@/shared/*`, `@/processes/*`.
- Keep compatibility re-exports in old paths during migration.

## Migration strategy

- Keep runtime behavior and localStorage schema unchanged.
- Migrate by slices with compatibility layers.
- Introduce tests before high-risk extractions.
