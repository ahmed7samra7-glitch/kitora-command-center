CREATE TABLE IF NOT EXISTS kcc_runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_runtime_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_provider_evidence (
  id TEXT PRIMARY KEY,
  evidence_type TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  provider_verified INTEGER NOT NULL,
  external_reference TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kcc_runtime_tasks_status_created
  ON kcc_runtime_tasks(status, created_at);

CREATE INDEX IF NOT EXISTS idx_kcc_provider_evidence_type_verified
  ON kcc_provider_evidence(evidence_type, provider_verified);
