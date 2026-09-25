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
that `BEGIN`, mutations, and `COMMIT` use the same connection.

DD-008 therefore implements the coordinated time workflows as narrow Tauri
commands in `src-tauri/src/time_engine.rs`. The commands clone the SQLite pool
handle from the SQL plugin's managed `DbInstances` state. They do not open a
second database or retain the plugin's instance-map lock during database work.

Each Start/Resume, Pause, Switch, or Complete operation uses one SQLx transaction
and one UTC timestamp. A process-local async mutex serializes calls from the app,
while SQLite's partial unique indexes protect the one-WORKING-task and
one-active-session invariants across database connections. Constraint or locking
conflicts roll back the full transaction and become stable native error codes.

The application boundary is `src/services/application/timeEngine.ts`; future
React controls should call it rather than `invoke()` directly. General Client
and Task CRUD remains in the existing TypeScript stores. Ordinary task status
and archive operations include guards so they cannot bypass an active time
workflow.

DD-009 keeps the selected task ID and the global active WorkSession separately
in `useTaskWorkspace`. It loads history only for the selected task and refreshes
that history after time-engine mutations. Native command results update the
visible task and session state immediately. The timer uses the pure recorded
duration calculator with an explicit current timestamp, and its interval only
refreshes that timestamp while the selected task is active. Startup reads task
and session state without changing persistence.

DD-010 isolates read-only daily reporting in `todayStore`, `todayService`, and
`useTodayWorkspace`. The store selects only WorkSessions overlapping a UTC range
and joins their Task and Client labels, including archived tasks. The application
service derives local calendar-day boundaries, clips each session interval, and
groups client/task totals without changing stored sessions. The Today hook fetches
on entry and at the next local date, while its one-second clock only recalculates
the visible active duration. The Tasks workspace stays mounted across view changes.
No new index is added: the report is limited to one day and current local data
volume is small; an interval-oriented index can follow measured query costs.
