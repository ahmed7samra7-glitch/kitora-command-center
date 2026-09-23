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

export interface WorkerCollaborationResult {
  workerId: string;
  task: string;
  status: 'COMPLETED' | 'FAILED' | 'REQUIRES_AUTH' | 'UNAVAILABLE';
  output?: unknown;
  error?: string;
  checkedAt: string;
}

interface RegistryRecord {
  identifier?: string;
  name?: string;
  provider?: string;
  description?: string;
  protocol?: string;
  protocols?: string[];
  endpoint?: string;
  url?: string;
  capabilities?: string[];
  skills?: string[];
}

function normalizeCapabilities(record: RegistryRecord): string[] {
  return Array.from(new Set([
    ...(Array.isArray(record.capabilities) ? record.capabilities : []),
    ...(Array.isArray(record.skills) ? record.skills : [])
  ].map(value => String(value).trim().toLowerCase()).filter(Boolean))).slice(0, 32);
}

function endpointFrom(record: RegistryRecord): string | null {
  const candidate = String(record.endpoint || record.url || '').trim();
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === 'https:' ? url.toString().replace(/\/$/, '') : null;
  } catch {
    return null;
  }
}

function makeWorkerId(record: RegistryRecord, index: number): string {
  const raw = String(record.identifier || record.name || `registry-agent-${index}`).trim();
  return `A2A:${raw.slice(0, 180)}`;
}

export async function discoverPublicAiWorkers(query = 'AI agent ecommerce product research automation coding marketing analytics'): Promise<DiscoveredAiWorker[]> {
  const url = new URL('https://api.a2a-registry.org/public/agents');
  url.searchParams.set('q', query.slice(0, 240));
  url.searchParams.set('limit', '12');

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
    name: String(raw.name || raw.identifier || `A2A Worker ${index + 1}`).slice(0, 200),
    provider: String(raw.provider || 'a2a-registry').slice(0, 120),
    description: String(raw.description || '').slice(0, 2000),
    protocol: String(raw.protocol || (raw.protocols?.[0] || '')).toUpperCase().includes('A2A') ? 'A2A' : 'UNKNOWN',
    endpoint: endpointFrom(raw),
    capabilities: normalizeCapabilities(raw),
    connectionState: endpointFrom(raw) ? 'DISCOVERED' : 'UNAVAILABLE',
    discoveredAt: now,
    lastCheckedAt: now,
    source: 'a2a-registry-public',
    ...(endpointFrom(raw) ? { evidenceUrl: endpointFrom(raw) } : {})
  }));
}

export function rankWorkersForGoal(workers: DiscoveredAiWorker[], goal: string, limit = 5): DiscoveredAiWorker[] {
  const terms = goal.toLowerCase().split(/[^a-z0-9]+/).filter(term => term.length >= 4);
  return workers
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
    const card = await fetchA2AAgentCard(worker.endpoint);
    const sendUrl = String(card?.url || card?.endpoint || worker.endpoint).trim();
    if (!sendUrl.startsWith('https://')) throw new Error('A2A agent card did not expose a secure HTTPS endpoint.');

    const first = await sendA2AMessage(
      sendUrl,
      `[KCC TRACE ${traceId}] Task: ${delegation.task}${delegation.successCriteria ? `\\nSuccess criteria: ${delegation.successCriteria}` : ''}\\nReturn evidence-backed results only. Do not claim external actions.`
    );

    if (first.response.status === 401 || first.response.status === 403 || first.result?.error?.code === -32001) {
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
        `[KCC TRACE ${traceId}] Your previous answer was incomplete. Provide only the missing evidence needed to satisfy: ${delegation.successCriteria}. Keep it concise and evidence-backed.`
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

    return {
      workerId: worker.workerId,
      task: delegation.task,
      status: 'COMPLETED',
      output: { text: answer, agentCard: {
        name: card?.name,
        version: card?.version,
        capabilities: card?.capabilities,
        authentication: card?.authentication
      } },
      checkedAt
    };
  } catch (error) {
    return {
      workerId: worker.workerId,
      task: delegation.task,
      status: 'UNAVAILABLE',
      error: error instanceof Error ? error.message : String(error),
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
