# DevDesk
Personal Salesforce Developer Workbench

DevDesk is a local-first macOS productivity and AI development workbench for
Salesforce developers. DD-001 provides only a Tauri desktop shell and a minimal
React placeholder confirming that the application is running.

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
placeholder requires no external services.

## Checks and builds

```sh
npm run typecheck
npm run build
cargo check --manifest-path src-tauri/Cargo.toml
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
be resized below 300 × 400. It launches neither fullscreen nor maximized. Window
position and size are not persisted; each new launch uses the configured size.
Always-on-top applies above normal windows; no special behavior across macOS
Spaces or fullscreen applications is configured.

The frontend currently has no native API calls or Tauri plugins. No persistence,
task/timer behavior, integrations, or AI is implemented.
The broader solution design and implementation plan describe later tickets.

The initial application identifier is `com.devdesk.desktop`; confirm ownership before
distribution because changing it later can affect OS identity and data paths.

<img width="10000" height="7500" alt="DevDesk_Solution_Architecture" src="https://github.com/user-attachments/assets/bfb21475-c752-4bce-8738-df1d2c2509f1" />
