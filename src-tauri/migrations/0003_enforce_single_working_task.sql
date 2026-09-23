CREATE UNIQUE INDEX tasks_single_working_index
    ON tasks((1))
    WHERE status = 'WORKING';
