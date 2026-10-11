CREATE INDEX IF NOT EXISTS idx_users_status_role ON users (status, role, id);
CREATE INDEX IF NOT EXISTS idx_alarms_status_occurred ON alarms (status, occurred_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_work_orders_status_priority_created ON work_orders (status, priority, created_at DESC, id DESC);
