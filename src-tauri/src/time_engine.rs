use crate::persistence::DATABASE_URL;
use serde::Serialize;
use sqlx::{sqlite::SqliteRow, Row, Sqlite, SqlitePool, Transaction};
use tauri::State;
use tauri_plugin_sql::{DbInstances, DbPool};
use tokio::sync::Mutex;
use uuid::Uuid;

pub struct TimeEngineGate(Mutex<()>);

impl Default for TimeEngineGate {
    fn default() -> Self {
        Self(Mutex::new(()))
    }
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct TaskRecord {
    id: String,
    client_id: String,
    external_key: Option<String>,
    title: String,
    status: String,
    next_action: Option<String>,
    created_at: String,
    updated_at: String,
    archived_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct WorkSessionRecord {
    id: String,
    task_id: String,
    started_at: String,
    ended_at: Option<String>,
    created_at: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StartTaskResult {
    task: TaskRecord,
    active_session: WorkSessionRecord,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseTaskResult {
    task: TaskRecord,
    closed_session: WorkSessionRecord,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SwitchTaskResult {
    paused_task: TaskRecord,
    active_task: TaskRecord,
    closed_session: WorkSessionRecord,
    active_session: WorkSessionRecord,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CompleteTaskResult {
    task: TaskRecord,
    closed_session: WorkSessionRecord,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct TimeEngineError {
    code: String,
    message: String,
}

impl TimeEngineError {
    fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.to_owned(),
            message: message.into(),
        }
    }

    fn database(context: &str, error: sqlx::Error) -> Self {
        eprintln!("DevDesk time engine database error during {context}: {error}");
        Self::new(
            "DATABASE_ERROR",
            "DevDesk could not persist the time operation.",
        )
    }

    fn mutation(context: &str, error: sqlx::Error) -> Self {
        let is_concurrent = error
            .as_database_error()
            .and_then(|database_error| database_error.code())
            .is_some_and(|code| matches!(code.as_ref(), "5" | "6" | "1555" | "2067"));

        if is_concurrent {
            eprintln!("DevDesk time engine concurrency conflict during {context}: {error}");
            return Self::new(
                "CONCURRENT_MODIFICATION",
                "Another time operation completed first. Refresh and try again.",
            );
        }
        Self::database(context, error)
    }
}

#[tauri::command]
pub async fn start_task(
    task_id: String,
    instances: State<'_, DbInstances>,
    gate: State<'_, TimeEngineGate>,
) -> Result<StartTaskResult, TimeEngineError> {
    let _guard = gate.0.lock().await;
    let pool = sqlite_pool(&instances).await?;
    start_task_with_pool(&pool, &task_id).await
}

#[tauri::command]
pub async fn pause_task(
    task_id: String,
    instances: State<'_, DbInstances>,
    gate: State<'_, TimeEngineGate>,
) -> Result<PauseTaskResult, TimeEngineError> {
    let _guard = gate.0.lock().await;
    let pool = sqlite_pool(&instances).await?;
    pause_task_with_pool(&pool, &task_id).await
}

#[tauri::command]
pub async fn switch_task(
    target_task_id: String,
    instances: State<'_, DbInstances>,
    gate: State<'_, TimeEngineGate>,
) -> Result<SwitchTaskResult, TimeEngineError> {
    let _guard = gate.0.lock().await;
    let pool = sqlite_pool(&instances).await?;
    switch_task_with_pool(&pool, &target_task_id).await
}

#[tauri::command]
pub async fn complete_active_task(
    task_id: String,
    instances: State<'_, DbInstances>,
    gate: State<'_, TimeEngineGate>,
) -> Result<CompleteTaskResult, TimeEngineError> {
    let _guard = gate.0.lock().await;
    let pool = sqlite_pool(&instances).await?;
    complete_active_task_with_pool(&pool, &task_id).await
}

async fn sqlite_pool(instances: &DbInstances) -> Result<SqlitePool, TimeEngineError> {
    let instances = instances.0.read().await;
    match instances.get(DATABASE_URL) {
        Some(DbPool::Sqlite(pool)) => Ok(pool.clone()),
        _ => Err(TimeEngineError::new(
            "DATABASE_UNAVAILABLE",
            "The DevDesk SQLite database is unavailable.",
        )),
    }
}

async fn start_task_with_pool(
    pool: &SqlitePool,
    task_id: &str,
) -> Result<StartTaskResult, TimeEngineError> {
    let session_id = Uuid::new_v4().to_string();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| TimeEngineError::database("starting a transaction", error))?;
    let result = async {
        let timestamp = transaction_timestamp(&mut transaction).await?;
        start_task_in_transaction(&mut transaction, task_id, &session_id, &timestamp).await
    }
    .await;
    finish_transaction(transaction, result).await
}

async fn pause_task_with_pool(
    pool: &SqlitePool,
    task_id: &str,
) -> Result<PauseTaskResult, TimeEngineError> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| TimeEngineError::database("starting a transaction", error))?;
    let result = async {
        let timestamp = transaction_timestamp(&mut transaction).await?;
        pause_task_in_transaction(&mut transaction, task_id, &timestamp).await
    }
    .await;
    finish_transaction(transaction, result).await
}

async fn switch_task_with_pool(
    pool: &SqlitePool,
    target_task_id: &str,
) -> Result<SwitchTaskResult, TimeEngineError> {
    let session_id = Uuid::new_v4().to_string();
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| TimeEngineError::database("starting a transaction", error))?;
    let result = async {
        let timestamp = transaction_timestamp(&mut transaction).await?;
        switch_task_in_transaction(
            &mut transaction,
            target_task_id,
            &session_id,
            &timestamp,
        )
        .await
    }
    .await;
    finish_transaction(transaction, result).await
}

async fn complete_active_task_with_pool(
    pool: &SqlitePool,
    task_id: &str,
) -> Result<CompleteTaskResult, TimeEngineError> {
    let mut transaction = pool
        .begin()
        .await
        .map_err(|error| TimeEngineError::database("starting a transaction", error))?;
    let result = async {
        let timestamp = transaction_timestamp(&mut transaction).await?;
        complete_task_in_transaction(&mut transaction, task_id, &timestamp).await
    }
    .await;
    finish_transaction(transaction, result).await
}

async fn finish_transaction<T>(
    transaction: Transaction<'_, Sqlite>,
    result: Result<T, TimeEngineError>,
) -> Result<T, TimeEngineError> {
    match result {
        Ok(value) => {
            transaction
                .commit()
                .await
                .map_err(|error| TimeEngineError::mutation("committing a transaction", error))?;
            Ok(value)
        }
        Err(error) => {
            if let Err(rollback_error) = transaction.rollback().await {
                eprintln!("DevDesk time engine rollback failed: {rollback_error}");
            }
            Err(error)
        }
    }
}

async fn start_task_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    task_id: &str,
    session_id: &str,
    timestamp: &str,
) -> Result<StartTaskResult, TimeEngineError> {
    let target = require_task(transaction, task_id).await?;
    ensure_task_not_archived(&target)?;

    if consistent_active_pair(transaction).await?.is_some() {
        return Err(TimeEngineError::new(
            "ANOTHER_TASK_ACTIVE",
            "A task is already being timed. Switch tasks instead.",
        ));
    }
    ensure_task_startable(&target)?;

    require_one_row(
        sqlx::query(
            "UPDATE tasks SET status = 'WORKING', updated_at = ? WHERE id = ? AND status = ? AND archived_at IS NULL",
        )
        .bind(timestamp)
        .bind(task_id)
        .bind(&target.status)
        .execute(&mut **transaction)
        .await
        .map_err(|error| TimeEngineError::mutation("starting a task", error))?
        .rows_affected(),
    )?;

    sqlx::query(
        "INSERT INTO work_sessions (id, task_id, started_at, ended_at, created_at) VALUES (?, ?, ?, NULL, ?)",
    )
    .bind(session_id)
    .bind(task_id)
    .bind(timestamp)
    .bind(timestamp)
    .execute(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::mutation("creating a work session", error))?;

    Ok(StartTaskResult {
        task: require_task(transaction, task_id).await?,
        active_session: require_session(transaction, session_id).await?,
    })
}

async fn pause_task_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    task_id: &str,
    timestamp: &str,
) -> Result<PauseTaskResult, TimeEngineError> {
    let (active_session, active_task) = require_active_pair(transaction).await?;
    if active_task.id != task_id {
        return Err(TimeEngineError::new(
            "TASK_NOT_ACTIVE",
            "The requested task is not the active task.",
        ));
    }

    close_session(transaction, &active_session.id, timestamp).await?;
    set_working_task_status(transaction, task_id, "PAUSED", timestamp).await?;

    Ok(PauseTaskResult {
        task: require_task(transaction, task_id).await?,
        closed_session: require_session(transaction, &active_session.id).await?,
    })
}

async fn switch_task_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    target_task_id: &str,
    session_id: &str,
    timestamp: &str,
) -> Result<SwitchTaskResult, TimeEngineError> {
    let (active_session, active_task) = require_active_pair(transaction).await?;
    if active_task.id == target_task_id {
        return Err(TimeEngineError::new(
            "TASK_ALREADY_ACTIVE",
            "The requested task is already active.",
        ));
    }

    let target = require_task(transaction, target_task_id).await?;
    ensure_task_startable(&target)?;

    close_session(transaction, &active_session.id, timestamp).await?;
    set_working_task_status(transaction, &active_task.id, "PAUSED", timestamp).await?;
    require_one_row(
        sqlx::query(
            "UPDATE tasks SET status = 'WORKING', updated_at = ? WHERE id = ? AND status = ? AND archived_at IS NULL",
        )
        .bind(timestamp)
        .bind(target_task_id)
        .bind(&target.status)
        .execute(&mut **transaction)
        .await
        .map_err(|error| TimeEngineError::mutation("activating the target task", error))?
        .rows_affected(),
    )?;

    sqlx::query(
        "INSERT INTO work_sessions (id, task_id, started_at, ended_at, created_at) VALUES (?, ?, ?, NULL, ?)",
    )
    .bind(session_id)
    .bind(target_task_id)
    .bind(timestamp)
    .bind(timestamp)
    .execute(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::mutation("creating the switched work session", error))?;

    Ok(SwitchTaskResult {
        paused_task: require_task(transaction, &active_task.id).await?,
        active_task: require_task(transaction, target_task_id).await?,
        closed_session: require_session(transaction, &active_session.id).await?,
        active_session: require_session(transaction, session_id).await?,
    })
}

async fn complete_task_in_transaction(
    transaction: &mut Transaction<'_, Sqlite>,
    task_id: &str,
    timestamp: &str,
) -> Result<CompleteTaskResult, TimeEngineError> {
    let (active_session, active_task) = require_active_pair(transaction).await?;
    if active_task.id != task_id {
        return Err(TimeEngineError::new(
            "TASK_NOT_ACTIVE",
            "The requested task is not the active task.",
        ));
    }

    close_session(transaction, &active_session.id, timestamp).await?;
    set_working_task_status(transaction, task_id, "DONE", timestamp).await?;

    Ok(CompleteTaskResult {
        task: require_task(transaction, task_id).await?,
        closed_session: require_session(transaction, &active_session.id).await?,
    })
}

async fn transaction_timestamp(
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<String, TimeEngineError> {
    sqlx::query_scalar("SELECT strftime('%Y-%m-%dT%H:%M:%fZ', 'now')")
        .fetch_one(&mut **transaction)
        .await
        .map_err(|error| TimeEngineError::database("creating a transaction timestamp", error))
}

async fn close_session(
    transaction: &mut Transaction<'_, Sqlite>,
    session_id: &str,
    timestamp: &str,
) -> Result<(), TimeEngineError> {
    let rows = sqlx::query(
        "UPDATE work_sessions SET ended_at = ? WHERE id = ? AND ended_at IS NULL AND started_at <= ?",
    )
    .bind(timestamp)
    .bind(session_id)
    .bind(timestamp)
    .execute(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::mutation("closing a work session", error))?
    .rows_affected();
    require_one_row(rows)
}

async fn set_working_task_status(
    transaction: &mut Transaction<'_, Sqlite>,
    task_id: &str,
    status: &str,
    timestamp: &str,
) -> Result<(), TimeEngineError> {
    let rows = sqlx::query(
        "UPDATE tasks SET status = ?, updated_at = ? WHERE id = ? AND status = 'WORKING' AND archived_at IS NULL",
    )
    .bind(status)
    .bind(timestamp)
    .bind(task_id)
    .execute(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::mutation("updating the active task", error))?
    .rows_affected();
    require_one_row(rows)
}

fn require_one_row(rows: u64) -> Result<(), TimeEngineError> {
    if rows == 1 {
        Ok(())
    } else {
        Err(TimeEngineError::new(
            "CONCURRENT_MODIFICATION",
            "The task changed during the time operation. Refresh and try again.",
        ))
    }
}

fn ensure_task_startable(task: &TaskRecord) -> Result<(), TimeEngineError> {
    ensure_task_not_archived(task)?;
    if matches!(
        task.status.as_str(),
        "NEW" | "PAUSED" | "WAITING_FOR_CLIENT" | "WAITING_FOR_REVIEW"
    ) {
        return Ok(());
    }
    Err(TimeEngineError::new(
        "TASK_NOT_STARTABLE",
        "The task is not in a startable state.",
    ))
}

fn ensure_task_not_archived(task: &TaskRecord) -> Result<(), TimeEngineError> {
    if task.archived_at.is_some() {
        return Err(TimeEngineError::new(
            "TASK_ARCHIVED",
            "Archived tasks cannot be started.",
        ));
    }
    Ok(())
}

async fn require_active_pair(
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<(WorkSessionRecord, TaskRecord), TimeEngineError> {
    consistent_active_pair(transaction).await?.ok_or_else(|| {
        TimeEngineError::new("NO_ACTIVE_SESSION", "There is no active work session.")
    })
}

async fn consistent_active_pair(
    transaction: &mut Transaction<'_, Sqlite>,
) -> Result<Option<(WorkSessionRecord, TaskRecord)>, TimeEngineError> {
    let session_rows = sqlx::query(
        "SELECT id, task_id, started_at, ended_at, created_at FROM work_sessions WHERE ended_at IS NULL",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::database("reading the active session", error))?;
    let task_rows = sqlx::query(
        "SELECT id, client_id, external_key, title, status, next_action, created_at, updated_at, archived_at FROM tasks WHERE status = 'WORKING'",
    )
    .fetch_all(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::database("reading the working task", error))?;

    if session_rows.len() > 1 || task_rows.len() > 1 {
        return Err(inconsistent_state());
    }

    let active_session = session_rows.first().map(work_session_from_row).transpose()?;
    let working_task = task_rows.first().map(task_from_row).transpose()?;
    match (active_session, working_task) {
        (None, None) => Ok(None),
        (Some(session), Some(task))
            if session.task_id == task.id && task.archived_at.is_none() =>
        {
            Ok(Some((session, task)))
        }
        _ => Err(inconsistent_state()),
    }
}

fn inconsistent_state() -> TimeEngineError {
    TimeEngineError::new(
        "INCONSISTENT_STATE",
        "Task and WorkSession state are inconsistent. No changes were made.",
    )
}

async fn require_task(
    transaction: &mut Transaction<'_, Sqlite>,
    task_id: &str,
) -> Result<TaskRecord, TimeEngineError> {
    let row = sqlx::query(
        "SELECT id, client_id, external_key, title, status, next_action, created_at, updated_at, archived_at FROM tasks WHERE id = ? LIMIT 1",
    )
    .bind(task_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::database("reading a task", error))?;

    row.as_ref()
        .map(task_from_row)
        .transpose()?
        .ok_or_else(|| TimeEngineError::new("TASK_NOT_FOUND", format!("Task not found: {task_id}")))
}

async fn require_session(
    transaction: &mut Transaction<'_, Sqlite>,
    session_id: &str,
) -> Result<WorkSessionRecord, TimeEngineError> {
    let row = sqlx::query(
        "SELECT id, task_id, started_at, ended_at, created_at FROM work_sessions WHERE id = ? LIMIT 1",
    )
    .bind(session_id)
    .fetch_optional(&mut **transaction)
    .await
    .map_err(|error| TimeEngineError::database("reading a work session", error))?;

    row.as_ref()
        .map(work_session_from_row)
        .transpose()?
        .ok_or_else(inconsistent_state)
}

fn task_from_row(row: &SqliteRow) -> Result<TaskRecord, TimeEngineError> {
    Ok(TaskRecord {
        id: row.try_get("id").map_err(row_error)?,
        client_id: row.try_get("client_id").map_err(row_error)?,
        external_key: row.try_get("external_key").map_err(row_error)?,
        title: row.try_get("title").map_err(row_error)?,
        status: row.try_get("status").map_err(row_error)?,
        next_action: row.try_get("next_action").map_err(row_error)?,
        created_at: row.try_get("created_at").map_err(row_error)?,
        updated_at: row.try_get("updated_at").map_err(row_error)?,
        archived_at: row.try_get("archived_at").map_err(row_error)?,
    })
}

fn work_session_from_row(row: &SqliteRow) -> Result<WorkSessionRecord, TimeEngineError> {
    Ok(WorkSessionRecord {
        id: row.try_get("id").map_err(row_error)?,
        task_id: row.try_get("task_id").map_err(row_error)?,
        started_at: row.try_get("started_at").map_err(row_error)?,
        ended_at: row.try_get("ended_at").map_err(row_error)?,
        created_at: row.try_get("created_at").map_err(row_error)?,
    })
}

fn row_error(error: sqlx::Error) -> TimeEngineError {
    TimeEngineError::database("mapping a database row", error)
}

#[cfg(test)]
mod tests {
    use super::*;
    use sqlx::sqlite::{SqliteConnectOptions, SqlitePoolOptions};
    use std::{path::PathBuf, str::FromStr, time::Duration};

    const T0: &str = "2026-09-22T09:00:00.000Z";

    async fn test_pool() -> (SqlitePool, PathBuf) {
        let path = std::env::temp_dir().join(format!("devdesk-time-engine-{}.db", Uuid::new_v4()));
        let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
            .unwrap()
            .create_if_missing(true)
            .foreign_keys(true)
            .busy_timeout(Duration::from_secs(2));
        let pool = SqlitePoolOptions::new()
            .max_connections(4)
            .connect_with(options)
            .await
            .unwrap();
        apply_schema(&pool).await;
        (pool, path)
    }

    async fn apply_schema(pool: &SqlitePool) {
        for migration in [
            include_str!("../migrations/0001_create_clients_and_tasks.sql"),
            include_str!("../migrations/0002_create_work_sessions.sql"),
            include_str!("../migrations/0003_enforce_single_working_task.sql"),
        ] {
            sqlx::raw_sql(migration).execute(pool).await.unwrap();
        }
    }

    async fn insert_task(pool: &SqlitePool, id: &str, status: &str) {
        sqlx::query(
            "INSERT OR IGNORE INTO clients (id, name, created_at, updated_at) VALUES ('client-1', 'Client', ?, ?)",
        )
        .bind(T0)
        .bind(T0)
        .execute(pool)
        .await
        .unwrap();
        sqlx::query(
            "INSERT INTO tasks (id, client_id, title, status, created_at, updated_at) VALUES (?, 'client-1', ?, ?, ?, ?)",
        )
        .bind(id)
        .bind(format!("Task {id}"))
        .bind(status)
        .bind(T0)
        .bind(T0)
        .execute(pool)
        .await
        .unwrap();
    }

    async fn task_status(pool: &SqlitePool, id: &str) -> String {
        sqlx::query_scalar("SELECT status FROM tasks WHERE id = ?")
            .bind(id)
            .fetch_one(pool)
            .await
            .unwrap()
    }

    async fn active_count(pool: &SqlitePool) -> i64 {
        sqlx::query_scalar("SELECT COUNT(*) FROM work_sessions WHERE ended_at IS NULL")
            .fetch_one(pool)
            .await
            .unwrap()
    }

    #[test]
    fn start_pause_resume_and_complete_are_transactional() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "task-1", "NEW").await;

        let started = start_task_with_pool(&pool, "task-1").await.unwrap();
        assert_eq!(started.task.status, "WORKING");
        assert_eq!(started.task.updated_at, started.active_session.started_at);
        assert_eq!(started.active_session.started_at, started.active_session.created_at);
        assert_eq!(active_count(&pool).await, 1);

        let paused = pause_task_with_pool(&pool, "task-1").await.unwrap();
        assert_eq!(paused.task.status, "PAUSED");
        assert_eq!(paused.task.updated_at, paused.closed_session.ended_at.clone().unwrap());
        assert_eq!(active_count(&pool).await, 0);

        let resumed = start_task_with_pool(&pool, "task-1").await.unwrap();
        assert_ne!(resumed.active_session.id, started.active_session.id);
        let first_end: Option<String> = sqlx::query_scalar(
            "SELECT ended_at FROM work_sessions WHERE id = ?",
        )
        .bind(&started.active_session.id)
        .fetch_one(&pool)
        .await
        .unwrap();
        assert!(first_end.is_some());

        let completed = complete_active_task_with_pool(&pool, "task-1")
            .await
            .unwrap();
        assert_eq!(completed.task.status, "DONE");
        assert!(completed.closed_session.ended_at.is_some());
        assert_eq!(active_count(&pool).await, 0);
        });
    }

    #[test]
    fn start_rejects_done_archived_and_another_active_task() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "done", "DONE").await;
        insert_task(&pool, "archived", "NEW").await;
        insert_task(&pool, "active", "NEW").await;
        insert_task(&pool, "other", "PAUSED").await;
        sqlx::query("UPDATE tasks SET archived_at = ? WHERE id = 'archived'")
            .bind(T0)
            .execute(&pool)
            .await
            .unwrap();

        assert_eq!(
            start_task_with_pool(&pool, "done").await.unwrap_err().code,
            "TASK_NOT_STARTABLE"
        );
        assert_eq!(
            start_task_with_pool(&pool, "archived").await.unwrap_err().code,
            "TASK_ARCHIVED"
        );
        start_task_with_pool(&pool, "active").await.unwrap();
        assert_eq!(
            start_task_with_pool(&pool, "other").await.unwrap_err().code,
            "ANOTHER_TASK_ACTIVE"
        );
        assert_eq!(task_status(&pool, "other").await, "PAUSED");
        });
    }

    #[test]
    fn pause_rejects_wrong_task_and_missing_active_session() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "task-1", "NEW").await;
        insert_task(&pool, "task-2", "NEW").await;

        assert_eq!(
            pause_task_with_pool(&pool, "task-1").await.unwrap_err().code,
            "NO_ACTIVE_SESSION"
        );
        start_task_with_pool(&pool, "task-1").await.unwrap();
        assert_eq!(
            pause_task_with_pool(&pool, "task-2").await.unwrap_err().code,
            "TASK_NOT_ACTIVE"
        );
        assert_eq!(task_status(&pool, "task-1").await, "WORKING");
        assert_eq!(active_count(&pool).await, 1);
        });
    }

    #[test]
    fn switch_has_one_shared_boundary_and_persists_after_reconnect() {
        tauri::async_runtime::block_on(async {
        let (pool, path) = test_pool().await;
        insert_task(&pool, "task-a", "NEW").await;
        insert_task(&pool, "task-b", "PAUSED").await;
        start_task_with_pool(&pool, "task-a").await.unwrap();

        let switched = switch_task_with_pool(&pool, "task-b").await.unwrap();
        assert_eq!(switched.paused_task.status, "PAUSED");
        assert_eq!(switched.active_task.status, "WORKING");
        assert_eq!(
            switched.closed_session.ended_at.as_deref(),
            Some(switched.active_session.started_at.as_str())
        );
        assert_eq!(active_count(&pool).await, 1);
        pool.close().await;

        let options = SqliteConnectOptions::from_str(path.to_str().unwrap())
            .unwrap()
            .foreign_keys(true);
        let reopened = SqlitePool::connect_with(options).await.unwrap();
        assert_eq!(task_status(&reopened, "task-a").await, "PAUSED");
        assert_eq!(task_status(&reopened, "task-b").await, "WORKING");
        assert_eq!(active_count(&reopened).await, 1);
        });
    }

    #[test]
    fn failed_insert_rolls_back_start_and_switch() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "task-a", "NEW").await;
        insert_task(&pool, "task-b", "NEW").await;
        sqlx::query(
            "CREATE TRIGGER reject_task_a_session BEFORE INSERT ON work_sessions WHEN NEW.task_id = 'task-a' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
        )
        .execute(&pool)
        .await
        .unwrap();

        assert!(start_task_with_pool(&pool, "task-a").await.is_err());
        assert_eq!(task_status(&pool, "task-a").await, "NEW");
        assert_eq!(active_count(&pool).await, 0);
        sqlx::query("DROP TRIGGER reject_task_a_session")
            .execute(&pool)
            .await
            .unwrap();

        start_task_with_pool(&pool, "task-a").await.unwrap();
        let original_session: String = sqlx::query_scalar(
            "SELECT id FROM work_sessions WHERE ended_at IS NULL",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        sqlx::query(
            "CREATE TRIGGER reject_task_b_session BEFORE INSERT ON work_sessions WHEN NEW.task_id = 'task-b' BEGIN SELECT RAISE(ABORT, 'test failure'); END",
        )
        .execute(&pool)
        .await
        .unwrap();

        assert!(switch_task_with_pool(&pool, "task-b").await.is_err());
        assert_eq!(task_status(&pool, "task-a").await, "WORKING");
        assert_eq!(task_status(&pool, "task-b").await, "NEW");
        let still_active: String = sqlx::query_scalar(
            "SELECT id FROM work_sessions WHERE ended_at IS NULL",
        )
        .fetch_one(&pool)
        .await
        .unwrap();
        assert_eq!(still_active, original_session);
        });
    }

    #[test]
    fn inconsistent_state_is_rejected_without_changes() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "task-1", "WORKING").await;

        let error = start_task_with_pool(&pool, "task-1").await.unwrap_err();
        assert_eq!(error.code, "INCONSISTENT_STATE");
        let pause_error = pause_task_with_pool(&pool, "task-1").await.unwrap_err();
        assert_eq!(pause_error.code, "INCONSISTENT_STATE");
        assert_eq!(task_status(&pool, "task-1").await, "WORKING");

        sqlx::query("UPDATE tasks SET status = 'PAUSED' WHERE id = 'task-1'")
            .execute(&pool)
            .await
            .unwrap();
        sqlx::query(
            "INSERT INTO work_sessions (id, task_id, started_at, created_at) VALUES ('orphan-active', 'task-1', ?, ?)",
        )
        .bind(T0)
        .bind(T0)
        .execute(&pool)
        .await
        .unwrap();
        let orphan_error = pause_task_with_pool(&pool, "task-1").await.unwrap_err();
        assert_eq!(orphan_error.code, "INCONSISTENT_STATE");
        assert_eq!(task_status(&pool, "task-1").await, "PAUSED");
        assert_eq!(active_count(&pool).await, 1);
        });
    }

    #[test]
    fn concurrent_starts_cannot_both_succeed() {
        tauri::async_runtime::block_on(async {
        let (pool, _) = test_pool().await;
        insert_task(&pool, "task-1", "NEW").await;
        insert_task(&pool, "task-2", "NEW").await;

        let first_pool = pool.clone();
        let second_pool = pool.clone();
        let first = tauri::async_runtime::spawn(async move {
            start_task_with_pool(&first_pool, "task-1").await
        });
        let second = tauri::async_runtime::spawn(async move {
            start_task_with_pool(&second_pool, "task-2").await
        });
        let first = first.await.unwrap();
        let second = second.await.unwrap();
        assert_eq!(u8::from(first.is_ok()) + u8::from(second.is_ok()), 1);
        let working_count: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM tasks WHERE status = 'WORKING'")
                .fetch_one(&pool)
                .await
                .unwrap();
        assert_eq!(working_count, 1);
        assert_eq!(active_count(&pool).await, 1);
        });
    }
}
