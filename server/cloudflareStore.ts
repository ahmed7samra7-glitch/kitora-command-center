export interface CloudflareD1Result {
  results?: unknown[];
  success?: boolean;
}

export interface CloudflareD1Prepared {
  bind(...values: unknown[]): CloudflareD1Prepared;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<CloudflareD1Result & { results: T[] }>;
  run(): Promise<CloudflareD1Result>;
}

export interface CloudflareD1Database {
  prepare(query: string): CloudflareD1Prepared;
}

export interface CloudflareRuntimeEnv {
  KCC_DB?: CloudflareD1Database;
  KCC_WORKER_SECRET?: string;
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface KccEvidenceSummary {
  fulfillmentEvidence: boolean;
  notificationEvidence: boolean;
}

const TABLES = {
  state: 'kcc_runtime_state',
  tasks: 'kcc_runtime_tasks',
  evidence: 'kcc_provider_evidence'
} as const;

export async function ensureCloudflareSchema(db: CloudflareD1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLES.state} (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLES.tasks} (id TEXT PRIMARY KEY, type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS ${TABLES.evidence} (id TEXT PRIMARY KEY, evidence_type TEXT NOT NULL, provider_id TEXT NOT NULL, provider_verified INTEGER NOT NULL, external_reference TEXT NOT NULL, created_at TEXT NOT NULL)`).run();
}

export async function readEvidenceSummary(db: CloudflareD1Database): Promise<KccEvidenceSummary> {
  const rows = await db.prepare(`SELECT evidence_type, COUNT(*) AS count FROM ${TABLES.evidence} WHERE provider_verified = 1 GROUP BY evidence_type`).all<{ evidence_type: string; count: number }>();
  const evidenceRows = (rows.results || []) as Array<{ evidence_type: string; count: number }>;
  const counts = new Map(evidenceRows.map((row) => [row.evidence_type, Number(row.count)]));
  return {
    fulfillmentEvidence: (counts.get('REAL_FULFILLMENT_EVIDENCE') || 0) > 0,
    notificationEvidence: (counts.get('REAL_NOTIFICATION_EVIDENCE') || 0) > 0
  };
}

export async function enqueueCloudflareTask(db: CloudflareD1Database, type: string, payload: unknown): Promise<{ id: string; status: 'QUEUED' }> {
  const now = new Date().toISOString();
  const id = `CF-TASK-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  await db.prepare(`INSERT INTO ${TABLES.tasks} (id, type, payload, status, created_at, updated_at) VALUES (?, ?, ?, 'QUEUED', ?, ?)`)
    .bind(id, type, JSON.stringify(payload ?? {}), now, now)
    .run();
  return { id, status: 'QUEUED' };
}

export async function listCloudflareTasks(db: CloudflareD1Database): Promise<Record<string, unknown>[]> {
  const rows = await db.prepare(`SELECT id, type, payload, status, created_at, updated_at FROM ${TABLES.tasks} ORDER BY created_at DESC LIMIT 100`).all();
  return rows.results || [];
}

export function hasConfiguredLiveProvider(env: CloudflareRuntimeEnv): boolean {
  return Boolean(env.GEMINI_API_KEY || env.OPENAI_API_KEY || env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY);
}

export { TABLES as CLOUDFLARE_TABLES };
