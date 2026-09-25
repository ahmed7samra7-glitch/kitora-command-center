export interface CloudflareD1Result {
  results?: unknown[];
  success?: boolean;
  meta?: { changes?: number };
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

export interface CloudflareQueue {
  send(message: unknown): Promise<unknown>;
}

export interface CloudflareRuntimeEnv {
  KCC_DB?: CloudflareD1Database;
  KCC_TASK_QUEUE?: CloudflareQueue;
  KCC_WORKER_SECRET?: string;
  GEMINI_API_KEY?: string;
  GEMINI_MODEL?: string;
  KCC_AI_PROVIDER?: string;
  KCC_ALLOW_PAID_AI_FALLBACK?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PAYPAL_WEBHOOK_ID?: string;
  CJ_DROPSHIPPING_API_KEY?: string;
  CJ_LOGISTICS_NAME?: string;
  CJ_FROM_COUNTRY_CODE?: string;
  META_WHATSAPP_LIVE_BEARER_TOKEN?: string;
  META_WHATSAPP_PHONE_NUMBER_ID?: string;
  META_WHATSAPP_GRAPH_VERSION?: string;
  META_WHATSAPP_APP_SECRET?: string;
  META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?: string;
  KCC_AUTOFULFILL_ENABLED?: string;
  KCC_MAX_AUTO_FULFILL_COST_USD?: string;
  OPENAI_MODEL?: string;
  CLAUDE_MODEL?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
}

export interface KccEvidenceSummary {
  fulfillmentEvidence: boolean;
  notificationEvidence: boolean;
}

export interface KccTaskRecord {
  id: string;
  type: string;
  payload: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  updated_at: string;
  attempts: number;
  last_error?: string | null;
  result?: string | null;
}

const TABLES = {
  state: 'kcc_runtime_state',
  tasks: 'kcc_runtime_tasks',
  evidence: 'kcc_provider_evidence'
} as const;

export async function ensureCloudflareSchema(db: CloudflareD1Database): Promise<void> {
  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${TABLES.state} (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${TABLES.tasks} (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      last_error TEXT,
      result TEXT
    )`
  ).run();

  await db.prepare(
    `CREATE TABLE IF NOT EXISTS ${TABLES.evidence} (
      id TEXT PRIMARY KEY,
      evidence_type TEXT NOT NULL CHECK (evidence_type IN ('REAL_FULFILLMENT_EVIDENCE', 'REAL_NOTIFICATION_EVIDENCE')),
      provider_id TEXT NOT NULL,
      provider_verified INTEGER NOT NULL CHECK (provider_verified IN (0, 1)),
      external_reference TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`
  ).run();

  try { await db.prepare(`ALTER TABLE ${TABLES.tasks} ADD COLUMN attempts INTEGER NOT NULL DEFAULT 0`).run(); } catch {}
  try { await db.prepare(`ALTER TABLE ${TABLES.tasks} ADD COLUMN last_error TEXT`).run(); } catch {}
  try { await db.prepare(`ALTER TABLE ${TABLES.tasks} ADD COLUMN result TEXT`).run(); } catch {}
}

export async function readEvidenceSummary(db: CloudflareD1Database): Promise<KccEvidenceSummary> {
  const rows = await db.prepare(
    `SELECT evidence_type, COUNT(*) AS count
     FROM ${TABLES.evidence}
     WHERE provider_verified = 1
     GROUP BY evidence_type`
  ).all<{ evidence_type: string; count: number }>();

  const evidenceRows = (rows.results || []) as Array<{ evidence_type: string; count: number }>;
  const counts = new Map(evidenceRows.map((row) => [row.evidence_type, Number(row.count)]));

  return {
    fulfillmentEvidence: (counts.get('REAL_FULFILLMENT_EVIDENCE') || 0) > 0,
    notificationEvidence: (counts.get('REAL_NOTIFICATION_EVIDENCE') || 0) > 0
  };
}

export async function enqueueCloudflareTask(
  db: CloudflareD1Database,
  queue: CloudflareQueue | undefined,
  type: string,
  payload: unknown
): Promise<{ id: string; status: 'QUEUED' }> {
  if (!queue) {
    throw new Error('KCC_TASK_QUEUE binding is required for durable task execution');
  }

  const now = new Date().toISOString();
  const id = `CF-TASK-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const serializedPayload = JSON.stringify(payload ?? {});

  await db.prepare(
    `INSERT INTO ${TABLES.tasks}
      (id, type, payload, status, created_at, updated_at, attempts, last_error, result)
     VALUES (?, ?, ?, 'QUEUED', ?, ?, 0, NULL, NULL)`
  ).bind(id, type, serializedPayload, now, now).run();

  try {
    await queue.send({ taskId: id, type, payload: payload ?? {}, enqueuedAt: now });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.prepare(
      `UPDATE ${TABLES.tasks}
       SET status='FAILED', last_error=?, updated_at=?
       WHERE id=? AND status='QUEUED'`
    ).bind(`QUEUE_SEND_FAILED: ${message}`, new Date().toISOString(), id).run();
    throw new Error('Task queue delivery failed');
  }

  return { id, status: 'QUEUED' };
}

export async function listCloudflareTasks(db: CloudflareD1Database): Promise<Record<string, unknown>[]> {
  const rows = await db.prepare(
    `SELECT id, type, payload, status, created_at, updated_at, attempts, last_error, result
     FROM ${TABLES.tasks}
     ORDER BY created_at DESC
     LIMIT 100`
  ).all();

  return rows.results || [];
}

export function taskLeaseSnapshot(task: Pick<KccTaskRecord, 'status' | 'updated_at' | 'attempts'>, now = Date.now()): {
  status: KccTaskRecord['status'];
  attempts: number;
  leaseMs: number;
  leaseRemainingMs: number;
  stale: boolean;
} {
  const leaseMs = TASK_LEASE_MS;
  const updatedAt = Date.parse(task.updated_at);
  const ageMs = Number.isFinite(updatedAt) ? Math.max(0, now - updatedAt) : leaseMs;
  return {
    status: task.status,
    attempts: Number(task.attempts || 0),
    leaseMs,
    leaseRemainingMs: Math.max(0, leaseMs - ageMs),
    stale: task.status === 'RUNNING' && ageMs >= leaseMs
  };
}

const TASK_LEASE_MS = 5 * 60 * 1000;

export async function claimCloudflareTask(
  db: CloudflareD1Database,
  taskId: string,
  staleAfterMs = TASK_LEASE_MS
): Promise<KccTaskRecord | null> {
  const now = new Date();
  const nowIso = now.toISOString();
  const staleBefore = new Date(now.getTime() - staleAfterMs).toISOString();

  const updated = await db.prepare(
    `UPDATE ${TABLES.tasks}
     SET status='RUNNING', attempts=attempts+1, updated_at=?, last_error=NULL
     WHERE id=? AND (
       status='QUEUED'
       OR (status='RUNNING' AND updated_at < ?)
     )`
  ).bind(nowIso, taskId, staleBefore).run();

  if (Number(updated.meta?.changes || 0) !== 1) return null;

  return db.prepare(
    `SELECT id, type, payload, status, created_at, updated_at, attempts, last_error, result
     FROM ${TABLES.tasks} WHERE id=?`
  ).bind(taskId).first<KccTaskRecord>();
}

export async function releaseCloudflareTaskForRetry(
  db: CloudflareD1Database,
  taskId: string,
  error: string
): Promise<void> {
  await db.prepare(
    `UPDATE ${TABLES.tasks}
     SET status='QUEUED', last_error=?, updated_at=?
     WHERE id=? AND status='RUNNING'`
  ).bind(error, new Date().toISOString(), taskId).run();
}

export async function recoverStaleCloudflareTasks(
  db: CloudflareD1Database,
  queue: CloudflareQueue,
  staleAfterMs = TASK_LEASE_MS,
  maxAttempts = 3
): Promise<{ requeued: string[]; failed: string[] }> {
  const staleBefore = new Date(Date.now() - staleAfterMs).toISOString();
  const rows = await db.prepare(
    `SELECT id, attempts FROM ${TABLES.tasks}
     WHERE status='RUNNING' AND updated_at < ?
     ORDER BY updated_at ASC
     LIMIT 20`
  ).bind(staleBefore).all<{ id: string; attempts: number }>();

  const requeued: string[] = [];
  const failed: string[] = [];

  for (const row of (rows.results || [])) {
    const taskId = String(row.id);
    const attempts = Number(row.attempts || 0);
    if (attempts >= maxAttempts) {
      await db.prepare(
        `UPDATE ${TABLES.tasks}
         SET status='FAILED', last_error=?, updated_at=?
         WHERE id=? AND status='RUNNING'`
      ).bind('STALE_TASK_MAX_ATTEMPTS_EXCEEDED', new Date().toISOString(), taskId).run();
      failed.push(taskId);
      continue;
    }

    const update = await db.prepare(
      `UPDATE ${TABLES.tasks}
       SET status='QUEUED', last_error=?, updated_at=?
       WHERE id=? AND status='RUNNING'`
    ).bind('STALE_TASK_RECOVERED', new Date().toISOString(), taskId).run();

    if (Number(update.meta?.changes || 0) !== 1) continue;

    const task = await db.prepare(
      `SELECT id, type, payload FROM ${TABLES.tasks} WHERE id=?`
    ).bind(taskId).first<{ id: string; type: string; payload: string }>();

    if (!task) continue;

    try {
      await queue.send({
        taskId: task.id,
        type: task.type,
        payload: parseQueuedTaskPayload({
          id: task.id,
          type: task.type,
          payload: task.payload,
          status: 'QUEUED',
          created_at: '',
          updated_at: '',
          attempts: attempts
        } as KccTaskRecord),
        enqueuedAt: new Date().toISOString(),
        recovery: true
      });
      requeued.push(taskId);
    } catch {
      await db.prepare(
        `UPDATE ${TABLES.tasks}
         SET status='FAILED', last_error=?, updated_at=?
         WHERE id=? AND status='QUEUED'`
      ).bind('STALE_TASK_RECOVERY_QUEUE_SEND_FAILED', new Date().toISOString(), taskId).run();
      failed.push(taskId);
    }
  }

  return { requeued, failed };
}

export async function completeCloudflareTask(
  db: CloudflareD1Database,
  taskId: string,
  status: 'COMPLETED' | 'FAILED',
  options?: { error?: string; result?: unknown }
): Promise<void> {
  await db.prepare(
    `UPDATE ${TABLES.tasks}
     SET status=?, last_error=?, result=?, updated_at=?
     WHERE id=? AND status='RUNNING'`
  ).bind(
    status,
    options?.error ?? null,
    options?.result === undefined ? null : JSON.stringify(options.result),
    new Date().toISOString(),
    taskId
  ).run();
}

function providerConfigured(env: CloudflareRuntimeEnv, provider: 'gemini' | 'openai' | 'claude'): boolean {
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY?.trim());
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY?.trim());
  return Boolean(env.CLAUDE_API_KEY?.trim() || env.ANTHROPIC_API_KEY?.trim());
}

function effectiveProviderOrder(env: CloudflareRuntimeEnv): Array<'gemini' | 'openai' | 'claude'> {
  const preferred = (env.KCC_AI_PROVIDER || 'gemini').trim().toLowerCase();
  const paidFallbackAllowed = (env.KCC_ALLOW_PAID_AI_FALLBACK || '').trim().toLowerCase() === 'true';

  if (!paidFallbackAllowed) return ['gemini'];

  if (preferred === 'openai') return ['openai', 'gemini', 'claude'];
  if (preferred === 'claude') return ['claude', 'gemini', 'openai'];
  return ['gemini', 'openai', 'claude'];
}

export function hasConfiguredLiveProvider(env: CloudflareRuntimeEnv): boolean {
  return effectiveProviderOrder(env).some((provider) => providerConfigured(env, provider));
}

export function parseQueuedTaskPayload(task: KccTaskRecord): Record<string, unknown> {
  try {
    const parsed = JSON.parse(task.payload);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export { TABLES as CLOUDFLARE_TABLES };