import {
  CLOUDFLARE_TABLES,
  CloudflareD1Database,
  CloudflareQueue,
  CloudflareRuntimeEnv,
  claimCloudflareTask,
  completeCloudflareTask,
  enqueueCloudflareTask,
  hasConfiguredLiveProvider,
  listCloudflareTasks,
  parseQueuedTaskPayload,
  readEvidenceSummary,
  releaseCloudflareTaskForRetry
} from './server/cloudflareStore.js';

export interface KccCloudflareEnv extends CloudflareRuntimeEnv {
  KCC_DB: CloudflareD1Database;
  KCC_TASK_QUEUE?: CloudflareQueue;
}

interface QueueMessage<T = unknown> {
  id: string;
  timestamp: Date;
  body: T;
  attempts: number;
  ack(): void;
  retry(options?: { delaySeconds?: number }): void;
}

interface MessageBatch<T = unknown> {
  queue: string;
  messages: readonly QueueMessage<T>[];
}

interface KccTaskEnvelope {
  taskId: string;
  type: string;
  payload: unknown;
  enqueuedAt: string;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function constantTimeEqual(left: string, right: string): boolean {
  if (!left || left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return difference === 0;
}

function workerAuthorized(request: Request, env: KccCloudflareEnv): boolean {
  const expected = env.KCC_WORKER_SECRET?.trim();
  const provided = request.headers.get('x-kcc-worker-secret')?.trim() || '';
  return Boolean(expected && constantTimeEqual(provided, expected));
}

async function health(env: KccCloudflareEnv): Promise<Response> {
  try {
    const evidence = await readEvidenceSummary(env.KCC_DB);
    const kccAlive = evidence.fulfillmentEvidence && evidence.notificationEvidence;
    return json({
      success: kccAlive,
      runtime: 'cloudflare-workers',
      storage: 'cloudflare-d1',
      productionReadiness: {
        kccAlive,
        fulfillmentEvidence: evidence.fulfillmentEvidence,
        notificationEvidence: evidence.notificationEvidence,
        failClosed: true
      },
      activeProviderConfigured: hasConfiguredLiveProvider(env),
      evidenceSource: 'provider-backed-only'
    }, kccAlive ? 200 : 503);
  } catch (error) {
    return json({
      success: false,
      runtime: 'cloudflare-workers',
      storage: 'cloudflare-d1',
      productionReadiness: { kccAlive: false, failClosed: true },
      error: 'D1_UNAVAILABLE',
      detail: error instanceof Error ? error.message : String(error)
    }, 503);
  }
}

export async function executeQueuedTask(
  env: KccCloudflareEnv,
  taskId: string
): Promise<{ status: 'COMPLETED' | 'FAILED' | 'SKIPPED'; reason?: string }> {
  const task = await claimCloudflareTask(env.KCC_DB, taskId);
  if (!task) return { status: 'SKIPPED', reason: 'ALREADY_RUNNING_OR_TERMINAL' };

  const payload = parseQueuedTaskPayload(task);

  switch (task.type) {
    case 'KCC_HEALTH_CHECK':
      await completeCloudflareTask(env.KCC_DB, task.id, 'COMPLETED', {
        result: {
          runtime: 'cloudflare-workers',
          storage: 'cloudflare-d1',
          failClosed: true
        }
      });
      return { status: 'COMPLETED' };

    case 'KCC_ALIVE_STATUS_CHECK': {
      const evidence = await readEvidenceSummary(env.KCC_DB);
      await completeCloudflareTask(env.KCC_DB, task.id, 'COMPLETED', {
        result: {
          kccAlive: evidence.fulfillmentEvidence && evidence.notificationEvidence,
          fulfillmentEvidence: evidence.fulfillmentEvidence,
          notificationEvidence: evidence.notificationEvidence,
          evidenceSource: 'provider-backed-only',
          payload
        }
      });
      return { status: 'COMPLETED' };
    }

    default:
      await completeCloudflareTask(env.KCC_DB, task.id, 'FAILED', {
        error: 'CLOUDFLARE_EXECUTOR_UNSUPPORTED_TASK_TYPE',
        result: {
          type: task.type,
          failClosed: true,
          message: 'No provider or business executor is installed for this task type.'
        }
      });
      return { status: 'FAILED', reason: 'UNSUPPORTED_TASK_TYPE' };
  }
}

export async function processQueueMessage(
  env: KccCloudflareEnv,
  message: QueueMessage<KccTaskEnvelope>
): Promise<'ACK' | 'RETRY'> {
  const taskId = String(message.body?.taskId || '').trim();
  if (!taskId) {
    message.ack();
    return 'ACK';
  }

  try {
    const result = await executeQueuedTask(env, taskId);
    if (result.status === 'SKIPPED') {
      message.ack();
      return 'ACK';
    }
    message.ack();
    return 'ACK';
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    await releaseCloudflareTaskForRetry(env.KCC_DB, taskId, `QUEUE_EXECUTION_FAILED: ${detail}`);
    if (message.attempts >= 3) {
      await completeCloudflareTask(env.KCC_DB, taskId, 'FAILED', {
        error: `QUEUE_EXECUTION_MAX_RETRIES: ${detail}`,
        result: { failClosed: true, attempts: message.attempts }
      });
      message.ack();
      return 'ACK';
    }
    message.retry({ delaySeconds: Math.min(60, 2 ** Math.max(0, message.attempts - 1)) });
    return 'RETRY';
  }
}

export default {
  async fetch(request: Request, env: KccCloudflareEnv): Promise<Response> {
    const url = new URL(request.url);
    if (!env.KCC_DB) return json({ success: false, error: 'KCC_DB binding is required', failClosed: true }, 503);

    if (request.method === 'GET' && url.pathname === '/api/live') {
      return json({ success: true, runtime: 'cloudflare-workers' });
    }

    if ((request.method === 'GET' || request.method === 'HEAD') && (url.pathname === '/api/kcc/health' || url.pathname === '/api/health')) {
      return health(env);
    }

    if (request.method === 'GET' && url.pathname === '/api/kcc/runtime') {
      return json({
        success: true,
        runtime: 'cloudflare-workers',
        storage: 'cloudflare-d1',
        backgroundExecution: 'cloudflare-queues',
        localFilesystemPersistence: false,
        failClosed: true
      });
    }

    if (request.method === 'POST' && url.pathname === '/api/kcc/tasks') {
      if (!workerAuthorized(request, env)) return json({ success: false, error: 'WORKER_AUTH_REQUIRED', failClosed: true }, 401);
      if (!env.KCC_TASK_QUEUE) return json({ success: false, error: 'KCC_TASK_QUEUE binding is required', failClosed: true }, 503);

      const body = await request.json().catch(() => ({})) as Record<string, unknown>;
      const type = String(body.type || 'KCC_TASK').trim().slice(0, 128);
      const task = await enqueueCloudflareTask(env.KCC_DB, env.KCC_TASK_QUEUE, type, body.payload || {});
      return json({ success: true, task }, 202);
    }

    if (request.method === 'GET' && url.pathname === '/api/kcc/tasks') {
      if (!workerAuthorized(request, env)) return json({ success: false, error: 'WORKER_AUTH_REQUIRED', failClosed: true }, 401);
      return json({ success: true, tasks: await listCloudflareTasks(env.KCC_DB) });
    }

    if (request.method === 'POST' && url.pathname === '/api/kcc/evidence') {
      return json({ success: false, error: 'PROVIDER_EVIDENCE_MUST_BE_WRITTEN_BY_VERIFIED_PROVIDER_ADAPTER', failClosed: true }, 403);
    }

    return json({ success: false, error: 'NOT_FOUND', runtime: 'cloudflare-workers' }, 404);
  },

  async queue(batch: MessageBatch<KccTaskEnvelope>, env: KccCloudflareEnv): Promise<void> {
    for (const message of batch.messages) {
      await processQueueMessage(env, message);
    }
  }
};

export { CLOUDFLARE_TABLES };
