import worker, { KccCloudflareEnv, processQueueMessage } from '../worker.js';
import { executeCloudflareBrainTask } from '../server/cloudflareBrain.js';
import {
  hasConfiguredLiveProvider
} from '../server/cloudflareStore.js';
import type {
  CloudflareD1Database,
  CloudflareD1Prepared,
  CloudflareQueue
} from '../server/cloudflareStore.js';

type Task = {
  id: string;
  type: string;
  payload: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED';
  created_at: string;
  updated_at: string;
  attempts: number;
  last_error: string | null;
  result: string | null;
};

class FakeD1 implements CloudflareD1Database {
  tasks: Task[] = [];
  evidence: Array<{ evidence_type: string; count: number }> = [];
  private binds: unknown[] = [];

  prepare(query: string): CloudflareD1Prepared {
    const db = this;
    return new (class implements CloudflareD1Prepared {
      bind(...values: unknown[]): CloudflareD1Prepared {
        db.binds = values;
        return this;
      }

      async first<T = Record<string, unknown>>(): Promise<T | null> {
        if (query.includes('FROM kcc_runtime_tasks WHERE id=?')) {
          const id = String(db.binds[0]);
          return (db.tasks.find((task) => task.id === id) as unknown as T) || null;
        }
        return null;
      }

      async all<T = Record<string, unknown>>(): Promise<{ results: T[] }> {
        if (query.includes('GROUP BY evidence_type')) {
          return { results: db.evidence as T[] };
        }
        if (query.includes('FROM kcc_runtime_tasks')) {
          return { results: db.tasks as unknown as T[] };
        }
        return { results: [] };
      }

      async run(): Promise<{ success: boolean; meta?: { changes?: number } }> {
        if (query.startsWith('INSERT INTO kcc_runtime_tasks')) {
          const [id, type, payload, createdAt, updatedAt] = db.binds.map(String);
          db.tasks.push({
            id,
            type,
            payload,
            status: 'QUEUED',
            created_at: createdAt,
            updated_at: updatedAt,
            attempts: 0,
            last_error: null,
            result: null
          });
          return { success: true, meta: { changes: 1 } };
        }

        if (query.includes("SET status='RUNNING'")) {
          const [updatedAt, id, staleBefore] = db.binds.map(String);
          const task = db.tasks.find((candidate) => candidate.id === id);
          const canClaim = Boolean(
            task &&
            (task.status === 'QUEUED' || (task.status === 'RUNNING' && task.updated_at < staleBefore))
          );
          if (!canClaim) return { success: true, meta: { changes: 0 } };
          task!.status = 'RUNNING';
          task!.attempts += 1;
          task!.updated_at = updatedAt;
          task!.last_error = null;
          return { success: true, meta: { changes: 1 } };
        }

        if (query.includes("SET status='QUEUED'")) {
          const [error, updatedAt, id] = db.binds.map(String);
          const task = db.tasks.find((candidate) => candidate.id === id);
          if (!task || task.status !== 'RUNNING') return { success: true, meta: { changes: 0 } };
          task.status = 'QUEUED';
          task.last_error = error;
          task.updated_at = updatedAt;
          return { success: true, meta: { changes: 1 } };
        }

        if (query.includes('SET status=?, last_error=?, result=?, updated_at=?')) {
          const [status, error, result, updatedAt, id] = db.binds.map((value) => value as string | null);
          const task = db.tasks.find((candidate) => candidate.id === id);
          if (!task || task.status !== 'RUNNING') return { success: true, meta: { changes: 0 } };
          task.status = status as Task['status'];
          task.last_error = error ?? null;
          task.result = result ?? null;
          task.updated_at = updatedAt as string;
          return { success: true, meta: { changes: 1 } };
        }

        if (query.startsWith('UPDATE kcc_runtime_tasks') && query.includes("status='FAILED'")) {
          return { success: true, meta: { changes: 1 } };
        }

        return { success: true, meta: { changes: 0 } };
      }
    })();
  }
}

class FakeQueue implements CloudflareQueue {
  messages: unknown[] = [];
  async send(message: unknown): Promise<void> {
    this.messages.push(message);
  }
}

const db = new FakeD1();
const queue = new FakeQueue();
const env: KccCloudflareEnv = {
  KCC_DB: db,
  KCC_TASK_QUEUE: queue,
  KCC_WORKER_SECRET: 'test-secret'
};

const call = (path: string, init?: RequestInit) =>
  worker.fetch(new Request(`https://kcc.test${path}`, init), env);

const live = await call('/api/live');
if (live.status !== 200) throw new Error(`Expected live 200, got ${live.status}`);

const health = await call('/api/kcc/health');
if (health.status !== 503) throw new Error(`Expected fail-closed health 503, got ${health.status}`);
const healthBody = await health.json() as any;
if (healthBody.productionReadiness.kccAlive !== false) {
  throw new Error('KCC_ALIVE must remain false without provider evidence.');
}

const preflight = await call('/api/kcc/preflight');
if (preflight.status !== 503) throw new Error(`Expected preflight 503 without AI provider, got ${preflight.status}`);
const preflightBody = await preflight.json() as any;
if (
  preflightBody.readiness?.autonomousMissionConfigured !== false ||
  !Array.isArray(preflightBody.blockers) ||
  !preflightBody.blockers.includes('AI_PROVIDER_NOT_CONFIGURED') ||
  preflightBody.checks?.providerReachability !== 'NOT_TESTED' ||
  preflightBody.readiness?.kccAlive !== false
) {
  throw new Error('Expected preflight to report configuration gaps without claiming provider reachability or KCC_ALIVE.');
}

const brokenD1: KccCloudflareEnv = {
  ...env,
  GEMINI_API_KEY: 'test-gemini-key',
  KCC_AI_PROVIDER: 'gemini',
  KCC_ALLOW_PAID_AI_FALLBACK: 'false',
  KCC_DB: {
    prepare() {
      return {
        bind() { return this; },
        async all() { throw new Error('missing schema'); },
        async first() { return null; },
        async run() { return { success: false, meta: { changes: 0 } }; }
      };
    }
  }
};
const brokenPreflight = await worker.fetch(
  new Request('https://kcc.test/api/kcc/preflight', { method: 'GET' }),
  brokenD1
);
if (brokenPreflight.status !== 503) throw new Error(`Expected preflight 503 when D1 schema is unavailable, got ${brokenPreflight.status}`);
const brokenPreflightBody = await brokenPreflight.json() as any;
if (
  brokenPreflightBody.readiness?.autonomousMissionConfigured !== false ||
  !brokenPreflightBody.blockers?.includes('D1_SCHEMA_NOT_READY') ||
  brokenPreflightBody.checks?.d1SchemaReady !== false
) {
  throw new Error('Expected preflight to fail closed when D1 schema is unavailable.');
}

const configuredPreflightEnv: KccCloudflareEnv = {
  ...env,
  GEMINI_API_KEY: 'test-gemini-key',
  KCC_AI_PROVIDER: 'gemini',
  KCC_ALLOW_PAID_AI_FALLBACK: 'false'
};
const configuredPreflight = await worker.fetch(
  new Request('https://kcc.test/api/kcc/preflight', { method: 'GET' }),
  configuredPreflightEnv
);
if (configuredPreflight.status !== 200) throw new Error(`Expected configured preflight 200, got ${configuredPreflight.status}`);
const configuredPreflightBody = await configuredPreflight.json() as any;
if (
  configuredPreflightBody.readiness?.autonomousMissionConfigured !== true ||
  configuredPreflightBody.readiness?.kccAlive !== false ||
  configuredPreflightBody.checks?.providerReachability !== 'NOT_TESTED'
) {
  throw new Error('Expected configured preflight to report Brain runtime configuration without asserting live-provider reachability.');
}

if (hasConfiguredLiveProvider({
  KCC_AI_PROVIDER: 'gemini',
  KCC_ALLOW_PAID_AI_FALLBACK: 'false',
  OPENAI_API_KEY: 'test-paid-provider-key'
})) {
  throw new Error('Health/provider telemetry must not report an unused paid provider as executable when paid fallback is disabled.');
}
if (!hasConfiguredLiveProvider({
  KCC_AI_PROVIDER: 'gemini',
  KCC_ALLOW_PAID_AI_FALLBACK: 'false',
  GEMINI_API_KEY: 'test-gemini-key'
})) {
  throw new Error('Configured zero-cost Gemini provider must be reported as executable.');
}
if (!hasConfiguredLiveProvider({
  KCC_AI_PROVIDER: 'openai',
  KCC_ALLOW_PAID_AI_FALLBACK: 'true',
  OPENAI_API_KEY: 'test-openai-key'
})) {
  throw new Error('An explicitly enabled paid provider must be reported as executable.');
}

const unauthorized = await call('/api/kcc/tasks', {
  method: 'POST',
  body: JSON.stringify({ type: 'KCC_HEALTH_CHECK' })
});
if (unauthorized.status !== 401) throw new Error(`Expected unauthorized task request 401, got ${unauthorized.status}`);

const noQueueEnv: KccCloudflareEnv = {
  KCC_DB: db,
  KCC_WORKER_SECRET: 'test-secret'
};
const noQueue = await worker.fetch(new Request('https://kcc.test/api/kcc/tasks', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-kcc-worker-secret': 'test-secret' },
  body: JSON.stringify({ type: 'KCC_HEALTH_CHECK' })
}), noQueueEnv);
if (noQueue.status !== 503) throw new Error(`Expected missing queue binding 503, got ${noQueue.status}`);

const queued = await call('/api/kcc/tasks', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-kcc-worker-secret': 'test-secret'
  },
  body: JSON.stringify({ type: 'KCC_HEALTH_CHECK', payload: { safe: true } })
});
if (queued.status !== 202) throw new Error(`Expected queued task 202, got ${queued.status}`);
const queuedBody = await queued.json() as any;
const taskId = String(queuedBody.task?.id || '');
if (!taskId || queue.messages.length !== 1) throw new Error('Expected durable queue message to be published.');

const message: any = {
  id: 'message-1',
  timestamp: new Date(),
  body: queue.messages[0],
  attempts: 1,
  acked: false,
  retried: false,
  ack() { this.acked = true; },
  retry() { this.retried = true; }
};
const queueResult = await processQueueMessage(env, message);
if (queueResult !== 'ACK' || !message.acked || message.retried) {
  throw new Error('Expected queue message to be processed and acknowledged.');
}
const completed = db.tasks.find((task) => task.id === taskId);
if (!completed || completed.status !== 'COMPLETED') {
  throw new Error('Expected KCC_HEALTH_CHECK to complete through the queue consumer.');
}

const evidenceAttempt = await call('/api/kcc/evidence', {
  method: 'POST',
  body: '{}'
});
if (evidenceAttempt.status !== 403) {
  throw new Error(`Expected evidence boundary 403, got ${evidenceAttempt.status}`);
}

const brainQueued = await call('/api/kcc/tasks', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-kcc-worker-secret': 'test-secret'
  },
  body: JSON.stringify({
    type: 'KCC_BRAIN_EXECUTE',
    payload: {
      agentId: 'EXECUTIVE_AUDITOR',
      goal: 'Return the next safe action from an empty evidence set.'
    }
  })
});
if (brainQueued.status !== 202) throw new Error(`Expected Brain task 202, got ${brainQueued.status}`);
const brainTaskId = String((await brainQueued.clone().json() as any).task.id);
const brainMessage: any = {
  id: 'message-brain',
  timestamp: new Date(),
  body: queue.messages.find((candidate: any) => candidate?.taskId === brainTaskId),
  attempts: 1,
  acked: false,
  retried: false,
  ack() { this.acked = true; },
  retry() { this.retried = true; }
};
const brainResult = await processQueueMessage(env, brainMessage);
if (brainResult !== 'ACK' || !brainMessage.acked || brainMessage.retried) {
  throw new Error('Expected Brain queue message to be acknowledged.');
}
const brainTask = db.tasks.find((task) => task.id === brainTaskId);
if (!brainTask || brainTask.status !== 'FAILED' || !brainTask.result?.includes('BLOCKED')) {
  throw new Error('Expected missing AI provider to block Brain execution without synthetic success.');
}

// Transient Gemini overload must use the Queue retry path, not a terminal FAILED state.
const transientDb = new FakeD1();
const transientQueue = new FakeQueue();
const transientEnv: KccCloudflareEnv = {
  KCC_DB: transientDb,
  KCC_TASK_QUEUE: transientQueue,
  KCC_WORKER_SECRET: 'test-secret',
  GEMINI_API_KEY: 'test-key',
  GEMINI_MODEL: 'gemini-3.5-flash-lite',
  KCC_AI_PROVIDER: 'gemini',
  KCC_ALLOW_PAID_AI_FALLBACK: 'false'
};

const originalFetch = globalThis.fetch;
let transientCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  if (url.includes('generativelanguage.googleapis.com')) {
    transientCalls += 1;
    if (transientCalls <= 3) {
      return new Response(JSON.stringify({
        error: { message: 'This model is currently experiencing high demand.' }
      }), {
        status: 503,
        headers: { 'content-type': 'application/json' }
      });
    }
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ status: 'PASS', nextActions: [] }) }]
        }
      }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  return originalFetch(input, init);
}) as typeof globalThis.fetch;

try {
  const transientTask = await import('../server/cloudflareStore.js').then(({ enqueueCloudflareTask }) =>
    enqueueCloudflareTask(transientDb, transientQueue, 'KCC_MISSION', {
      agentId: 'EXECUTIVE_AUDITOR',
      goal: 'Exercise transient provider retry handling.'
    })
  );
  const transientMessage: any = {
    id: 'message-transient',
    timestamp: new Date(),
    body: transientQueue.messages[0],
    attempts: 1,
    acked: false,
    retried: false,
    ack() { this.acked = true; },
    retry() { this.retried = true; }
  };

  const retryResult = await processQueueMessage(transientEnv, transientMessage);
  const retryTask = transientDb.tasks.find((task) => task.id === transientTask.id);
  if (retryResult !== 'RETRY' || !transientMessage.retried || transientMessage.acked || retryTask?.status !== 'QUEUED') {
    throw new Error('Expected transient Gemini overload to release the task and request a Queue retry.');
  }

  transientMessage.attempts = 2;
  transientMessage.retried = false;
  transientMessage.acked = false;
  const recoveredResult = await processQueueMessage(transientEnv, transientMessage);
  const recoveredTask = transientDb.tasks.find((task) => task.id === transientTask.id);
  if (recoveredResult !== 'ACK' || !transientMessage.acked || transientMessage.retried || recoveredTask?.status !== 'COMPLETED') {
    throw new Error('Expected transient Gemini task to complete after the provider recovers.');
  }
} finally {
  globalThis.fetch = originalFetch;
}

const aliveCheck = await call('/api/kcc/tasks', {
  method: 'POST',
  headers: {
    'content-type': 'application/json',
    'x-kcc-worker-secret': 'test-secret'
  },
  body: JSON.stringify({ type: 'KCC_ALIVE_STATUS_CHECK' })
});
if (aliveCheck.status !== 202) throw new Error(`Expected KCC alive status task 202, got ${aliveCheck.status}`);
const aliveTaskId = String((await aliveCheck.clone().json() as any).task.id);
const aliveMessage: any = {
  id: 'message-2',
  timestamp: new Date(),
  body: queue.messages.find((candidate: any) => candidate?.taskId === aliveTaskId),
  attempts: 1,
  acked: false,
  retried: false,
  ack() { this.acked = true; },
  retry() { this.retried = true; }
};
await processQueueMessage(env, aliveMessage);
const aliveTask = db.tasks.find((task) => task.id === aliveTaskId);
if (!aliveTask || aliveTask.status !== 'COMPLETED') {
  throw new Error('Expected KCC_ALIVE status check to complete without making KCC_ALIVE true.');
}

// Brain-level governance must also fail closed when called directly.
const brainGovernanceFetch = globalThis.fetch;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.includes('generativelanguage.googleapis.com')) {
    return new Response(JSON.stringify({
      candidates: [{
        content: {
          parts: [{ text: JSON.stringify({ status: 'PASS', nextActions: [] }) }]
        }
      }]
    }), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  return brainGovernanceFetch(input);
}) as typeof globalThis.fetch;

try {
  const invalidBrainSensitivity = await executeCloudflareBrainTask({
    KCC_AI_PROVIDER: 'gemini',
    KCC_ALLOW_PAID_AI_FALLBACK: 'false',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.5-flash-lite'
  }, {
    taskId: 'brain-governance-naN',
    agentId: 'EXECUTIVE_AUDITOR',
    goal: 'Prepare a financial review.',
    sensitivityScore: Number.NaN
  });
  if (!invalidBrainSensitivity.requiresOwnerApproval) {
    throw new Error('Direct Brain execution must require owner approval for invalid sensitivity.');
  }

  const negativeBrainCost = await executeCloudflareBrainTask({
    KCC_AI_PROVIDER: 'gemini',
    KCC_ALLOW_PAID_AI_FALLBACK: 'false',
    GEMINI_API_KEY: 'test-key',
    GEMINI_MODEL: 'gemini-2.5-flash-lite'
  }, {
    taskId: 'brain-governance-negative-cost',
    agentId: 'EXECUTIVE_AUDITOR',
    goal: 'Prepare a financial review.',
    costUSD: -10
  });
  if (!negativeBrainCost.requiresOwnerApproval) {
    throw new Error('Direct Brain execution must require owner approval for negative cost.');
  }
} finally {
  globalThis.fetch = brainGovernanceFetch;
}

console.log('Cloudflare Worker + D1 + Queue verification: PASS');
