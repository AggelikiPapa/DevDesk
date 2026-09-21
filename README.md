# DevDesk
Personal Salesforce Developer Workbench

DevDesk is a local-first macOS productivity and AI development workbench for
Salesforce developers. DD-003 adds a compact visual shell with sample tasks,
a static elapsed-time display, and preview-only task controls. The task list
supports manual ordering within the current app session.

## Development on macOS

Prerequisites:

- Node.js 22.12+ (22 LTS), or Node.js 24+, with npm.
- Stable Rust and Cargo, installed through rustup.
- Xcode command-line tools (`xcode-select --install`).

See the [Tauri prerequisites](https://v2.tauri.app/start/prerequisites/) for setup.

```sh
npm ci
npm run tauri dev
```

The Tauri command starts Vite and opens the native DevDesk window. The first run
downloads and compiles Rust dependencies. Once dependencies are installed, the
visual shell requires no external services.

## Checks and builds

```sh
npm run typecheck
npm test
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
cargo test --manifest-path src-tauri/Cargo.toml
npm run tauri build
```

`npm run build` checks TypeScript and builds the frontend into `dist/`.
`npm run tauri build` also compiles the native application and produces a local
macOS `.app` in `src-tauri/target/release/bundle/macos/`. Distribution signing and
notarization are not configured. `npm run dev` serves only the browser frontend.

## Structure and scope

- `src/components/`: shared UI components.
- `src/features/`: future feature UI and logic.
- `src/services/`: future application services and integration boundaries.
- `src/types/`: shared TypeScript types.
- `src-tauri/`: native shell and Tauri configuration.
- `docs/` and `tests/`: existing documentation and test locations.

DD-002 configures a movable, resizable, always-on-top window with standard macOS
window controls. It starts with a 360 × 520 logical-pixel content area and cannot
be resized below 260 × 320. It launches neither fullscreen nor maximized. Window
position and size are not persisted; each new launch uses the configured size.
Always-on-top applies above normal windows; no special behavior across macOS
Spaces or fullscreen applications is configured.

On macOS, the entire window fades to 65% opacity when it loses focus and returns
to full opacity when focused. Its size and position do not change. This uses
Tauri focus events and the public AppKit `NSWindow.alphaValue` API in
`src-tauri/src/window_appearance.rs`; it does not enable macOS private APIs.

The UI uses the existing light theme and plain CSS. Sample data is isolated in
`src/features/task-preview/mockData.ts`; display-only types live in
`src/types/task-preview.ts`. Task action and navigation controls are focusable but marked unavailable
with `aria-disabled` and an explanatory tooltip. They perform no actions.
The paused sample shows Resume and Complete; the Add task button is also
presentation-only. The native title bar supplies the application heading.
The content scrolls vertically when needed at the minimum window size.

Elapsed time displays hours and minutes, without rounding up or discarding the
seconds stored in the fixture. Drag a task's grip to another row to move it to
that position, or focus the grip and use Up/Down arrows. Reordering only affects
Other Tasks and resets on restart; it does not change the current task or status.
The pure ordering function lives in `src/features/task-preview/reorderTasks.ts`
and is covered by `npm test` using Node's built-in test runner.
Tauri's native file-drop handling is disabled so the webview can handle task
drag-and-drop. File importing is not implemented.

## Local persistence

DD-004 adds the official Tauri 2 SQL plugin with its SQLite driver. The database
URL is `sqlite:devdesk.db`, which resolves beneath Tauri's application config
directory. On macOS the expected location is:

```text
~/Library/Application Support/com.devdesk.desktop/devdesk.db
```

Versioned SQL migrations live in `src-tauri/migrations/`. They are embedded in
the binary, registered in `src-tauri/src/persistence.rs`, and applied atomically
by the SQL plugin when the application starts. The plugin records applied
versions in its own migration table and does not rerun a completed version.

Persisted domain types live in `src/types/domain.ts`; they are deliberately
separate from the DD-003 preview types. SQL access is isolated under
`src/services/persistence/`, with focused client and task stores. React
components contain no SQL, and the preview UI does not open or query the
database yet.

DD-005 adds focused application services under `src/services/application/`.
They expose client creation/retrieval/listing and task creation, retrieval,
active listing, title and next-action updates, status changes, and archival.
The services normalize text, validate task status, and turn missing records
into clear typed errors before future UI code consumes them. Store mutations
use targeted SQL updates, and archiving sets timestamps without deleting or
otherwise changing the task. A `DONE` task remains active until it is archived.

Client and task IDs are UUID v4 strings created with `crypto.randomUUID()`.
Timestamps are UTC ISO 8601 text with millisecond precision. Task status is a
TypeScript union and is also protected by a SQLite `CHECK` constraint. SQLite
foreign keys prevent tasks from referencing missing clients.

No task/timer UI behavior, integrations, or AI is implemented.
The broader solution design and implementation plan describe later tickets.

The initial application identifier is `com.devdesk.desktop`; confirm ownership before
distribution because changing it later can affect OS identity and data paths.

<img width="10000" height="7500" alt="DevDesk_Solution_Architecture" src="https://github.com/user-attachments/assets/bfb21475-c752-4bce-8738-df1d2c2509f1" />
