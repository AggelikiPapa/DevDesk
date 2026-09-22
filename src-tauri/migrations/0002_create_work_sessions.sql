CREATE TABLE work_sessions (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
    task_id TEXT NOT NULL,
    started_at TEXT NOT NULL CHECK (started_at GLOB '????-??-??T??:??:??.???Z'),
    ended_at TEXT CHECK (
        ended_at IS NULL OR (
            ended_at GLOB '????-??-??T??:??:??.???Z'
            AND ended_at >= started_at
        )
    ),
    created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
    FOREIGN KEY (task_id) REFERENCES tasks(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX work_sessions_task_chronology_index
    ON work_sessions(task_id, started_at, id);

CREATE UNIQUE INDEX work_sessions_single_active_index
    ON work_sessions((1))
    WHERE ended_at IS NULL;
