# Agent Instructions

# DevDesk

DevDesk is a local-first macOS productivity and AI development
workbench for Salesforce developers.

## Core principles

- Keep the application lightweight.
- Prefer local-first functionality.
- Core task and time-tracking functionality must work offline.
- Avoid unnecessary dependencies.
- Keep integrations isolated behind adapters.
- AI functionality must not be required for core functionality.
- Never automatically send client communication.
- Never automatically modify external systems without explicit user action.
- Support multiple clients without leaking context between them.

## Technology

- Tauri
- React
- TypeScript
- SQLite
- macOS first

## Development rules

- Implement one ticket at a time.
- Do not implement future roadmap features unless explicitly requested.
- Keep business logic separate from React components.
- Keep external integrations separate from core domain logic.
- Add tests for important domain behavior.
- Prefer simple implementations over premature abstractions.
