CREATE TABLE IF NOT EXISTS kcc_discovered_workers (
  worker_id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  provider TEXT NOT NULL,
  description TEXT NOT NULL,
  protocol TEXT NOT NULL CHECK (protocol IN ('A2A', 'UNKNOWN')),
  endpoint TEXT,
  capabilities TEXT NOT NULL,
  connection_state TEXT NOT NULL CHECK (connection_state IN ('DISCOVERED', 'VERIFIED', 'REACHABLE', 'UNAVAILABLE', 'REQUIRES_AUTH')),
  discovered_at TEXT NOT NULL,
  last_checked_at TEXT NOT NULL,
  source TEXT NOT NULL,
  evidence_url TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_worker_collaborations (
  id TEXT PRIMARY KEY,
  parent_task_id TEXT NOT NULL,
  worker_id TEXT NOT NULL,
  task TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'REQUIRES_AUTH', 'UNAVAILABLE')),
  output TEXT,
  error TEXT,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kcc_workers_last_checked
  ON kcc_discovered_workers(last_checked_at);

CREATE INDEX IF NOT EXISTS idx_kcc_workers_protocol_state
  ON kcc_discovered_workers(protocol, connection_state);

CREATE INDEX IF NOT EXISTS idx_kcc_collaboration_task
  ON kcc_worker_collaborations(parent_task_id, created_at);
