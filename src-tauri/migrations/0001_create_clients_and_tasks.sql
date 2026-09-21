PRAGMA foreign_keys = ON;

CREATE TABLE clients (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
    name TEXT NOT NULL CHECK (length(trim(name)) > 0),
    display_name TEXT,
    created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
    updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z')
);

CREATE TABLE tasks (
    id TEXT PRIMARY KEY NOT NULL CHECK (length(trim(id)) > 0),
    client_id TEXT NOT NULL,
    external_key TEXT,
    title TEXT NOT NULL CHECK (length(trim(title)) > 0),
    status TEXT NOT NULL CHECK (
        status IN (
            'NEW',
            'WORKING',
            'PAUSED',
            'WAITING_FOR_CLIENT',
            'WAITING_FOR_REVIEW',
            'DONE'
        )
    ),
    next_action TEXT,
    created_at TEXT NOT NULL CHECK (created_at GLOB '????-??-??T??:??:??.???Z'),
    updated_at TEXT NOT NULL CHECK (updated_at GLOB '????-??-??T??:??:??.???Z'),
    archived_at TEXT CHECK (
        archived_at IS NULL OR archived_at GLOB '????-??-??T??:??:??.???Z'
    ),
    FOREIGN KEY (client_id) REFERENCES clients(id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);

CREATE INDEX tasks_client_id_index ON tasks(client_id);
CREATE INDEX tasks_active_updated_at_index ON tasks(archived_at, updated_at DESC);
