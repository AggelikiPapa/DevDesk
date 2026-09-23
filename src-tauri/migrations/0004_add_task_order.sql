ALTER TABLE tasks ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

-- Preserve the order users saw before manual sorting was restored.
WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY updated_at DESC, id) - 1 AS position
    FROM tasks
    WHERE archived_at IS NULL
)
UPDATE tasks
SET sort_order = (SELECT position FROM ranked WHERE ranked.id = tasks.id)
WHERE archived_at IS NULL;

CREATE INDEX tasks_active_sort_order_index ON tasks(archived_at, sort_order, id);
