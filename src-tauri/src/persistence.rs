use tauri_plugin_sql::{Migration, MigrationKind};

pub const DATABASE_URL: &str = "sqlite:devdesk.db";

pub fn migrations() -> Vec<Migration> {
    vec![
        Migration {
            version: 1,
            description: "create_clients_and_tasks",
            sql: include_str!("../migrations/0001_create_clients_and_tasks.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 2,
            description: "create_work_sessions",
            sql: include_str!("../migrations/0002_create_work_sessions.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 3,
            description: "enforce_single_working_task",
            sql: include_str!("../migrations/0003_enforce_single_working_task.sql"),
            kind: MigrationKind::Up,
        },
        Migration {
            version: 4,
            description: "add_task_order",
            sql: include_str!("../migrations/0004_add_task_order.sql"),
            kind: MigrationKind::Up,
        },
    ]
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn registers_migrations_in_version_order() {
        let migrations = migrations();

        assert_eq!(migrations.len(), 4);
        assert_eq!(migrations[0].version, 1);
        assert_eq!(migrations[0].description, "create_clients_and_tasks");
        assert!(migrations[0].sql.contains("CREATE TABLE clients"));
        assert!(migrations[0].sql.contains("CREATE TABLE tasks"));
        assert_eq!(migrations[1].version, 2);
        assert_eq!(migrations[1].description, "create_work_sessions");
        assert!(migrations[1].sql.contains("CREATE TABLE work_sessions"));
        assert!(migrations[1]
            .sql
            .contains("work_sessions_single_active_index"));
        assert_eq!(migrations[2].version, 3);
        assert_eq!(migrations[2].description, "enforce_single_working_task");
        assert!(migrations[2].sql.contains("tasks_single_working_index"));
        assert_eq!(migrations[3].version, 4);
        assert_eq!(migrations[3].description, "add_task_order");
        assert!(migrations[3].sql.contains("sort_order"));
    }
}
