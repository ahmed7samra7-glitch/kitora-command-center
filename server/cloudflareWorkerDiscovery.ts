export type WorkerProtocol = 'A2A' | 'UNKNOWN';
export type WorkerConnectionState = 'DISCOVERED' | 'VERIFIED' | 'REACHABLE' | 'UNAVAILABLE' | 'REQUIRES_AUTH';

export interface DiscoveredAiWorker {
  workerId: string;
  name: string;
  provider: string;
  description: string;
  protocol: WorkerProtocol;
  endpoint: string | null;
  capabilities: string[];
  connectionState: WorkerConnectionState;
  discoveredAt: string;
  lastCheckedAt: string;
  source: string;
  evidenceUrl?: string;
}

export interface WorkerDelegation {
  workerId: string;
  task: string;
  successCriteria?: string;
}

const SENSITIVE_PATTERNS = [
  /(?:api[_-]?key|access[_-]?token|secret|password|authorization)\s*[:=]/i,
  /bearer\s+[a-z0-9._-]{12,}/i,
  /sk-[a-z0-9_-]{16,}/i
];

export function sanitizeDelegationText(value: string, maxLength: number): string {
  const text = String(value || '').replace(/\s+/g, ' ').trim().slice(0, maxLength);
  if (!text) return '';
  if (SENSITIVE_PATTERNS.some(pattern => pattern.test(text))) {
    throw new Error('WORKER_DELEGATION_SENSITIVE_DATA_BLOCKED');
  }
  return text;
}

export function sanitizeWorkerOutput(value: unknown, maxLength = 12000): string {
  let text = typeof value === 'string' ? value : JSON.stringify(value ?? '');
  text = text.replace(/(?:api[_-]?key|access[_-]?token|secret|password|authorization)\s*[:=]\s*[^\s,;]+/gi, '$1=[REDACTED]');
  text = text.replace(/bearer\s+[a-z0-9._-]{12,}/gi, 'Bearer [REDACTED]');
  text = text.replace(/\bsk-[a-z0-9_-]{16,}\b/gi, 'sk-[REDACTED]');
  return text.slice(0, maxLength);
}


export interface WorkerCollaborationResult {
  workerId: string;
  task: string;
  status: 'COMPLETED' | 'FAILED' | 'REQUIRES_AUTH' | 'UNAVAILABLE';
  output?: unknown;
  error?: string;
  checkedAt: string;
}

export async function ensureWorkerDiscoverySchema(db: { prepare(query: string): any }): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS kcc_discovered_workers (
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
  )`).run();

  await db.prepare(`CREATE TABLE IF NOT EXISTS kcc_worker_collaborations (
    id TEXT PRIMARY KEY,
    parent_task_id TEXT NOT NULL,
    worker_id TEXT NOT NULL,
    task TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('COMPLETED', 'FAILED', 'REQUIRES_AUTH', 'UNAVAILABLE')),
    output TEXT,
    error TEXT,
    created_at TEXT NOT NULL
  )`).run();

  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_kcc_workers_last_checked ON kcc_discovered_workers(last_checked_at)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_kcc_workers_protocol_state ON kcc_discovered_workers(protocol, connection_state)`).run();
  await db.prepare(`CREATE INDEX IF NOT EXISTS idx_kcc_collaboration_task ON kcc_worker_collaborations(parent_task_id, created_at)`).run();
}


interface RegistryRecord {
  id?: string;
  identifier?: string;
  name?: string;
  displayName?: string;
  provider?: string;
  description?: string;
  protocol?: string;
  protocolVersion?: string;
  protocols?: string[];
  endpoint?: string;
  url?: string;
  capabilities?: unknown[];
  skills?: unknown[];
  agentCard?: RegistryRecord;
  agent_card?: RegistryRecord;
  metadata?: { agentCard?: RegistryRecord; agent_card?: RegistryRecord };
}

function nestedAgentCard(record: RegistryRecord): RegistryRecord {
  return record.agentCard || record.agent_card || record.metadata?.agentCard || record.metadata?.agent_card || {};
}

function normalizeCapabilities(record: RegistryRecord): string[] {
  const card = nestedAgentCard(record);
  const values = [
    ...(Array.isArray(record.capabilities) ? record.capabilities : []),
    ...(Array.isArray(record.skills) ? record.skills : []),
    ...(Array.isArray(card.capabilities) ? card.capabilities : []),
    ...(Array.isArray(card.skills) ? card.skills : [])
  ];
  return Array.from(new Set(values.map(value => {
    if (typeof value === 'string') return value;
    if (value && typeof value === 'object') {
      const item = value as Record<string, unknown>;
      return String(item.name || item.id || item.description || '').trim();
    }
    return '';
  }).map(value => value.toLowerCase()).filter(Boolean))).slice(0, 32);
}

function endpointFrom(record: RegistryRecord): string | null {
  const card = nestedAgentCard(record);
  const candidate = String(record.endpoint || record.url || card.endpoint || card.url || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

function makeWorkerId(record: RegistryRecord, index: number): string {
  const card = nestedAgentCard(record);
  const raw = String(record.identifier || record.id || record.name || record.displayName || card.name || `registry-agent-${index}`).trim();
  return `A2A:${raw.slice(0, 180)}`;
}

export async function discoverPublicAiWorkers(query = 'AI agent ecommerce product research automation coding marketing analytics'): Promise<DiscoveredAiWorker[]> {
  const url = new URL('https://api.a2a-registry.org/public/agents');
  url.searchParams.set('q', query.slice(0, 240));

  const response = await fetch(url.toString(), {
    headers: { accept: 'application/json' }
  });
  if (!response.ok) throw new Error(`A2A registry discovery HTTP ${response.status}`);

  const body = await response.json().catch(() => ({})) as any;
  const records = Array.isArray(body?.agents)
    ? body.agents
    : Array.isArray(body?.results)
      ? body.results
      : Array.isArray(body)
        ? body
        : [];

  const now = new Date().toISOString();
  return records.slice(0, 12).map((raw: RegistryRecord, index: number): DiscoveredAiWorker => ({
    workerId: makeWorkerId(raw, index),
    name: String(raw.name || raw.displayName || raw.identifier || raw.id || nestedAgentCard(raw).name || `A2A Worker ${index + 1}`).slice(0, 200),
    provider: String(raw.provider || nestedAgentCard(raw).provider || 'a2a-registry').slice(0, 120),
    description: String(raw.description || nestedAgentCard(raw).description || '').slice(0, 2000),
    protocol: (() => {
      const card = nestedAgentCard(raw);
      const signal = String(raw.protocol || raw.protocolVersion || raw.protocols?.[0] || card.protocol || card.protocolVersion || '').toUpperCase();
      return signal.includes('A2A') || Boolean(card.url || card.protocolVersion) ? 'A2A' : 'UNKNOWN';
    })(),
    endpoint: endpointFrom(raw),
    capabilities: normalizeCapabilities(raw),
    connectionState: endpointFrom(raw) ? 'DISCOVERED' : 'UNAVAILABLE',
    discoveredAt: now,
    lastCheckedAt: now,
    source: 'a2a-registry-public',
    ...(endpointFrom(raw) ? { evidenceUrl: endpointFrom(raw) } : {})
  }));
}

export async function scoutAiWorkerEcosystem(): Promise<DiscoveredAiWorker[]> {
  const queries = [
    'ecommerce product research sourcing merchandising automation',
    'market research competitor intelligence analytics',
    'software engineering coding testing security automation',
    'marketing SEO copywriting growth content automation',
    'customer support operations finance workflow automation'
  ];

  const batches = await Promise.all(
    queries.map(query => discoverPublicAiWorkers(query).catch(() => []))
  );

  const deduped = new Map<string, DiscoveredAiWorker>();
  for (const worker of batches.flat()) {
    const existing = deduped.get(worker.workerId);
    if (!existing || Date.parse(worker.lastCheckedAt) > Date.parse(existing.lastCheckedAt)) {
      deduped.set(worker.workerId, worker);
    }
  }

  return Array.from(deduped.values()).slice(0, 40);
}


export function rankWorkersForGoal(workers: DiscoveredAiWorker[], goal: string, limit = 5): DiscoveredAiWorker[] {
  const now = Date.now();
  const terms = goal.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length >= 4);
  return workers
    .filter(worker => {
      if (worker.connectionState === 'UNAVAILABLE' || worker.connectionState === 'REQUIRES_AUTH') return false;
      const checkedAt = Date.parse(worker.lastCheckedAt);
      return Number.isFinite(checkedAt) && now - checkedAt <= 24 * 60 * 60 * 1000;
    })
    .map(worker => {
      const haystack = `${worker.name} ${worker.provider} ${worker.description} ${worker.capabilities.join(' ')}`.toLowerCase();
      const overlap = terms.reduce((score, term) => score + (haystack.includes(term) ? 1 : 0), 0);
      const reachabilityBonus = worker.connectionState === 'REACHABLE' ? 3 : worker.connectionState === 'VERIFIED' ? 2 : 0;
      const a2aBonus = worker.protocol === 'A2A' ? 2 : 0;
      return { worker, score: overlap + reachabilityBonus + a2aBonus };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map(item => item.worker);
}

export async function fetchA2AAgentCard(endpoint: string): Promise<any> {
  const baseUrl = new URL(endpoint);
  const cardUrl = `${baseUrl.origin}/.well-known/agent-card.json`;
  const response = await fetch(cardUrl, {
    headers: { accept: 'application/json' }
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`A2A_AUTH_REQUIRED: agent-card HTTP ${response.status}`);
  }
  if (!response.ok) throw new Error(`A2A agent-card HTTP ${response.status}`);
  return response.json();
}

async function sendA2AMessage(
  endpoint: string,
  text: string
): Promise<{ response: Response; result: any }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json'
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: `kcc-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      method: 'message/send',
      params: {
        message: {
          messageId: `kcc-msg-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
          role: 'user',
          parts: [{ text }]
        }
      }
    })
  });
  const result = await response.json().catch(() => ({})) as any;
  return { response, result };
}

function extractA2AText(result: any): string {
  const candidates = [
    result?.result?.message?.parts,
    result?.result?.artifacts?.flatMap((artifact: any) => artifact?.parts || []),
    result?.message?.parts
  ].flat(Infinity);
  return candidates
    .filter((part: any) => part && typeof part.text === 'string')
    .map((part: any) => part.text)
    .join('\n')
    .trim();
}

export async function collaborateWithA2AWorker(
  worker: DiscoveredAiWorker,
  delegation: WorkerDelegation,
  traceId: string
): Promise<WorkerCollaborationResult> {
  const checkedAt = new Date().toISOString();
  if (!worker.endpoint || worker.protocol !== 'A2A') {
    return {
      workerId: worker.workerId,
      task: delegation.task,
      status: 'UNAVAILABLE',
      error: 'Worker has no verified A2A endpoint.',
      checkedAt
    };
  }

  try {
    const safeTask = sanitizeDelegationText(delegation.task, 4000);
    const safeCriteria = delegation.successCriteria ? sanitizeDelegationText(delegation.successCriteria, 2000) : undefined;
    const card = await fetchA2AAgentCard(worker.endpoint);
    const sendUrl = String(card?.url || card?.endpoint || worker.endpoint).trim();
    if (!sendUrl.startsWith('https://')) throw new Error('A2A agent card did not expose a secure HTTPS endpoint.');

    const first = await sendA2AMessage(
      sendUrl,
      `[KCC TRACE ${traceId}] Task: ${safeTask}${safeCriteria ? `\\nSuccess criteria: ${safeCriteria}` : ''}\\nReturn evidence-backed results only. Never request, reveal, or reproduce credentials, tokens, passwords, or customer PII. Do not claim external actions.`
    );

    if (first.response.status === 401 || first.response.status === 403 || first.result?.error?.code === -32001) {
      worker.connectionState = 'REQUIRES_AUTH';
      return { workerId: worker.workerId, task: delegation.task, status: 'REQUIRES_AUTH', error: 'Worker requires authentication for collaboration.', checkedAt };
    }
    if (!first.response.ok || first.result?.error) {
      return {
        workerId: worker.workerId,
        task: delegation.task,
        status: 'FAILED',
        error: `A2A collaboration HTTP ${first.response.status}: ${first.result?.error?.message || 'request failed'}`,
        checkedAt
      };
    }

    let answer = extractA2AText(first.result);
    // One bounded repair turn: ask the worker to fill only missing success criteria.
    if (delegation.successCriteria && (!answer || answer.length < 80)) {
      const repair = await sendA2AMessage(
        sendUrl,
        `[KCC TRACE ${traceId}] Your previous answer was incomplete. Provide only the missing evidence needed to satisfy: ${safeCriteria}. Keep it concise and evidence-backed. Never request, reveal, or reproduce credentials, tokens, passwords, or customer PII.`
      );
      if (repair.response.status === 401 || repair.response.status === 403) {
        return { workerId: worker.workerId, task: delegation.task, status: 'REQUIRES_AUTH', error: 'Worker requires authentication during repair turn.', checkedAt };
      }
      if (repair.response.ok && !repair.result?.error) {
        answer = extractA2AText(repair.result) || answer;
      }
    }

    if (!answer) {
      return {
        workerId: worker.workerId,
        task: delegation.task,
        status: 'FAILED',
        error: 'A2A worker returned no usable evidence-backed output.',
        checkedAt
      };
    }

    worker.connectionState = 'REACHABLE';
    return {
      workerId: worker.workerId,
      task: delegation.task,
      status: 'COMPLETED',
      output: { text: sanitizeWorkerOutput(answer), agentCard: {
        name: String(card?.name || '').slice(0, 200),
        version: String(card?.version || '').slice(0, 64),
        capabilities: Array.isArray(card?.capabilities) ? card.capabilities.slice(0, 32) : [],
        authentication: card?.authentication
      } },
      checkedAt
    };
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    worker.connectionState = detail.includes('A2A_AUTH_REQUIRED') ? 'REQUIRES_AUTH' : 'UNAVAILABLE';
    return {
      workerId: worker.workerId,
      task: delegation.task,
      status: detail.includes('A2A_AUTH_REQUIRED') ? 'REQUIRES_AUTH' : 'UNAVAILABLE',
      error: detail,
      checkedAt
    };
  }
}

export async function updateWorkerConnectionState(
  db: { prepare(query: string): any },
  workerId: string,
  state: WorkerConnectionState
): Promise<void> {
  await db.prepare(
    `UPDATE kcc_discovered_workers
     SET connection_state=?, last_checked_at=?, updated_at=?
     WHERE worker_id=?`
  ).bind(state, new Date().toISOString(), new Date().toISOString(), workerId).run();
}

export async function persistDiscoveredWorkers(
  db: { prepare(query: string): any },
  workers: DiscoveredAiWorker[]
): Promise<void> {
  const now = new Date().toISOString();
  for (const worker of workers) {
    await db.prepare(
      `INSERT INTO kcc_discovered_workers
        (worker_id, name, provider, description, protocol, endpoint, capabilities, connection_state, discovered_at, last_checked_at, source, evidence_url, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(worker_id) DO UPDATE SET
        name=excluded.name,
        provider=excluded.provider,
        description=excluded.description,
        protocol=excluded.protocol,
        endpoint=excluded.endpoint,
        capabilities=excluded.capabilities,
        connection_state=excluded.connection_state,
        last_checked_at=excluded.last_checked_at,
        source=excluded.source,
        evidence_url=excluded.evidence_url,
        updated_at=excluded.updated_at`
    ).bind(
      worker.workerId,
      worker.name,
      worker.provider,
      worker.description,
      worker.protocol,
      worker.endpoint,
      JSON.stringify(worker.capabilities),
      worker.connectionState,
      worker.discoveredAt,
      worker.lastCheckedAt,
      worker.source,
      worker.evidenceUrl || null,
      now
    ).run();
  }
}

export async function listDiscoveredWorkers(
  db: { prepare(query: string): any },
  limit = 100
): Promise<DiscoveredAiWorker[]> {
  const rows = await db.prepare(
    `SELECT worker_id, name, provider, description, protocol, endpoint, capabilities, connection_state, discovered_at, last_checked_at, source, evidence_url
     FROM kcc_discovered_workers
     ORDER BY last_checked_at DESC LIMIT ?`
  ).bind(Math.max(1, Math.min(100, limit))).all();

  return (rows.results || []).map((row: any) => ({
    workerId: String(row.worker_id),
    name: String(row.name),
    provider: String(row.provider),
    description: String(row.description || ''),
    protocol: row.protocol === 'A2A' ? 'A2A' : 'UNKNOWN',
    endpoint: row.endpoint ? String(row.endpoint) : null,
    capabilities: (() => { try { return JSON.parse(row.capabilities || '[]'); } catch { return []; } })(),
    connectionState: String(row.connection_state) as WorkerConnectionState,
    discoveredAt: String(row.discovered_at),
    lastCheckedAt: String(row.last_checked_at),
    source: String(row.source),
    ...(row.evidence_url ? { evidenceUrl: String(row.evidence_url) } : {})
  }));
}


export async function persistWorkerCollaboration(
  db: { prepare(query: string): any },
  parentTaskId: string,
  result: WorkerCollaborationResult
): Promise<void> {
  await db.prepare(
    `INSERT INTO kcc_worker_collaborations
      (id, parent_task_id, worker_id, task, status, output, error, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    `KCC-COLLAB-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    parentTaskId,
    result.workerId,
    result.task,
    result.status,
    result.output === undefined ? null : JSON.stringify(result.output),
    result.error || null,
    result.checkedAt
  ).run();
}


export async function listWorkerCollaborations(
  db: { prepare(query: string): any },
  parentTaskId: string
): Promise<WorkerCollaborationResult[]> {
  const rows = await db.prepare(
    `SELECT worker_id, task, status, output, error, created_at
     FROM kcc_worker_collaborations
     WHERE parent_task_id=?
     ORDER BY created_at ASC`
  ).bind(parentTaskId).all();

  return (rows.results || []).map((row: any) => ({
    workerId: String(row.worker_id),
    task: String(row.task),
    status: String(row.status) as WorkerCollaborationResult['status'],
    output: row.output ? (() => { try { return JSON.parse(row.output); } catch { return row.output; } })() : undefined,
    error: row.error ? String(row.error) : undefined,
    checkedAt: String(row.created_at)
  }));
}
