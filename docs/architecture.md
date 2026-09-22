# Architecture

## Persistence boundaries

React uses application services, which call focused persistence stores backed by
the Tauri SQL plugin and SQLite. Database rows are mapped to camel-case domain
types before they leave a store.

WorkSession creation and closure are intentionally not exposed by the read-only
WorkSession application service. A valid Start, Pause, or Switch operation must
change Task state and WorkSession state together.

The Tauri SQL plugin's TypeScript API exposes independent `execute` and `select`
calls but no transaction object. Because its Rust implementation executes those
calls through a SQLx connection pool, sequential frontend calls cannot assume
that `BEGIN`, mutations, and `COMMIT` use the same connection. The DD-008 time
engine should be implemented as narrow Tauri commands in Rust. Each command
should acquire a single connection from the existing SQLite pool, start a SQLx
transaction, perform all Task and WorkSession changes, and commit only after all
invariants succeed.
