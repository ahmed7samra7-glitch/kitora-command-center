import worker, { KccCloudflareEnv } from '../worker.js';
import type { CloudflareD1Database, CloudflareD1Prepared } from '../server/cloudflareStore.js';

class FakePrepared implements CloudflareD1Prepared {
  constructor(private readonly query: string, private readonly db: FakeD1) {}
  bind(..._values: unknown[]): CloudflareD1Prepared { return this; }
  async first<T = Record<string, unknown>>(): Promise<T | null> { return null; }
  async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
    if (this.query.includes('GROUP BY evidence_type')) return { results: this.db.evidence as T[] };
    return { results: this.db.tasks as T[] };
  }
  async run(): Promise<{ success: boolean }> { return { success: true }; }
}

class FakeD1 implements CloudflareD1Database {
  evidence: Record<string, unknown>[] = [];
  tasks: Record<string, unknown>[] = [];
  prepare(query: string): CloudflareD1Prepared { return new FakePrepared(query, this); }
}

const db = new FakeD1();
const env: KccCloudflareEnv = { KCC_DB: db, KCC_WORKER_SECRET: 'test-secret' };
const call = (path: string, init?: RequestInit) => worker.fetch(new Request(`https://kcc.test${path}`, init), env);

const live = await call('/api/live');
if (live.status !== 200) throw new Error(`Expected live 200, got ${live.status}`);

const health = await call('/api/kcc/health');
if (health.status !== 503) throw new Error(`Expected fail-closed health 503, got ${health.status}`);
const healthBody = await health.json() as any;
if (healthBody.productionReadiness.kccAlive !== false) throw new Error('KCC_ALIVE must remain false without evidence.');

const unauthorized = await call('/api/kcc/tasks', { method: 'POST', body: JSON.stringify({ type: 'TEST' }) });
if (unauthorized.status !== 401) throw new Error(`Expected unauthorized task request 401, got ${unauthorized.status}`);

const queued = await call('/api/kcc/tasks', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-kcc-worker-secret': 'test-secret' },
  body: JSON.stringify({ type: 'TEST', payload: { safe: true } })
});
if (queued.status !== 202) throw new Error(`Expected queued task 202, got ${queued.status}`);

const evidenceAttempt = await call('/api/kcc/evidence', { method: 'POST', body: '{}' });
if (evidenceAttempt.status !== 403) throw new Error(`Expected evidence boundary 403, got ${evidenceAttempt.status}`);

console.log('Cloudflare Worker runtime verification: PASS');
