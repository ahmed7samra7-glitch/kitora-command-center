CREATE TABLE IF NOT EXISTS kcc_runtime_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_runtime_tasks (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  result TEXT
);

CREATE TABLE IF NOT EXISTS kcc_provider_evidence (
  id TEXT PRIMARY KEY,
  evidence_type TEXT NOT NULL CHECK (evidence_type IN ('REAL_FULFILLMENT_EVIDENCE', 'REAL_NOTIFICATION_EVIDENCE')),
  provider_id TEXT NOT NULL,
  provider_verified INTEGER NOT NULL CHECK (provider_verified IN (0, 1)),
  external_reference TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS kcc_brain_decisions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'BLOCKED')),
  output TEXT,
  requires_owner_approval INTEGER NOT NULL CHECK (requires_owner_approval IN (0, 1)),
  approval_reason TEXT,
  execution_time_ms INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  error TEXT
);

CREATE INDEX IF NOT EXISTS idx_kcc_tasks_status ON kcc_runtime_tasks(status, created_at);
CREATE INDEX IF NOT EXISTS idx_kcc_evidence_type ON kcc_provider_evidence(evidence_type, provider_verified);
CREATE INDEX IF NOT EXISTS idx_kcc_brain_decisions_created ON kcc_brain_decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_kcc_brain_decisions_agent ON kcc_brain_decisions(agent_id, created_at);
