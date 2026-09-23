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
import { executeCloudflareBrainTask, persistCloudflareBrainDecision } from './server/cloudflareBrain.js';
import { issueAutonomyPassport, admitNextActions } from './server/kccAutonomyPassport.js';

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

async function executeMissionTask(env: KccCloudflareEnv, taskId: string, payload: Record<string, unknown>): Promise<'COMPLETED' | 'FAILED'> {
  const goal = typeof payload.goal === 'string'
    ? payload.goal
    : 'Review KITORA runtime state and identify the next safe autonomous action.';
  const passport = issueAutonomyPassport({
    goal,
    sensitivityScore: typeof payload.sensitivityScore === 'number' ? payload.sensitivityScore : undefined,
    costUSD: typeof payload.costUSD === 'number' ? payload.costUSD : undefined
  });

  // The deterministic governor runs before the probabilistic Brain.
  // A mission can never acquire capabilities that the passport did not grant.
  if (passport.mode !== 'READ_ONLY') {
    const decision = {
      decisionId: `CF-GOV-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
      taskId,
      agentId: typeof payload.agentId === 'string' ? payload.agentId : 'EXECUTIVE_AUDITOR',
      provider: 'none' as const,
      model: 'none',
      status: 'BLOCKED' as const,
      output: null,
      requiresOwnerApproval: passport.mode === 'OWNER_APPROVAL',
      ...(passport.reason ? { approvalReason: passport.mode === 'OWNER_APPROVAL' ? passport.reason : undefined } : {}),
      executionTimeMs: 0,
      createdAt: new Date().toISOString(),
      error: passport.reason
    };
    await persistCloudflareBrainDecision(env.KCC_DB, decision);
    await completeCloudflareTask(env.KCC_DB, taskId, 'FAILED', {
      error: passport.reason,
      result: {
        governor: 'KCC_AUTONOMY_PASSPORT',
        passport,
        decision
      }
    });
    return 'FAILED';
  }

  const decision = await executeCloudflareBrainTask(env, {
    taskId,
    agentId: typeof payload.agentId === 'string' ? payload.agentId : 'EXECUTIVE_AUDITOR',
    goal,
    context: {
      ...(payload.context && typeof payload.context === 'object' ? payload.context : {}),
      autonomyPassport: passport
    },
    sensitivityScore: typeof payload.sensitivityScore === 'number' ? payload.sensitivityScore : undefined,
    costUSD: typeof payload.costUSD === 'number' ? payload.costUSD : undefined
  });

  // Preserve transient provider failures for Queue retry before any terminal task update.
  if (decision.status !== 'COMPLETED' && isTransientBrainFailure(decision.error)) {
    throw new Error(decision.error || 'TRANSIENT_BRAIN_PROVIDER_FAILURE');
  }

  await persistCloudflareBrainDecision(env.KCC_DB, decision);

  const context = payload.context && typeof payload.context === 'object' ? payload.context as Record<string, unknown> : {};
  const depth = Number(context.depth || 0);
  const proposedActions = decision.status === 'COMPLETED' && !decision.requiresOwnerApproval && depth < 3 &&
    decision.output && typeof decision.output === 'object' && Array.isArray((decision.output as any).nextActions)
    ? (decision.output as any).nextActions
    : [];
  const admission = admitNextActions(passport, proposedActions);

  if (admission.admitted.length > 0 && env.KCC_TASK_QUEUE) {
    for (const action of admission.admitted) {
      await enqueueCloudflareTask(env.KCC_DB, env.KCC_TASK_QUEUE, 'KCC_MISSION', {
        agentId: action.agentId || 'EXECUTIVE_AUDITOR',
        goal: action.goal,
        priority: 'HIGH',
        context: {
          parentTaskId: taskId,
          parentDecisionId: decision.decisionId,
          parentPassportId: passport.passportId,
          depth: depth + 1
        }
      });
    }
  }

  await completeCloudflareTask(env.KCC_DB, taskId, decision.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED', {
    error: decision.error,
    result: {
      ...decision,
      governor: 'KCC_AUTONOMY_PASSPORT',
      autonomyPassport: passport,
      admittedActions: admission.admitted.length,
      rejectedActions: admission.rejected.length,
      rejectedActionReasons: admission.rejected.slice(0, 4)
    }
  });
  return decision.status === 'COMPLETED' ? 'COMPLETED' : 'FAILED';
}

function isTransientBrainFailure(error?: string): boolean {
  const value = (error || '').toLowerCase();
  return /\bhttp\s+(?:429|500|502|503|504)\b/i.test(value)
    || value.includes('timeout')
    || value.includes('temporarily unavailable')
    || value.includes('high demand');
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

    case 'KCC_BRAIN_EXECUTE':
    case 'KCC_MISSION': {
      const status = await executeMissionTask(env, task.id, payload);
      if (status === 'COMPLETED') return { status: 'COMPLETED' };

      const failedTask = await env.KCC_DB.prepare(
        'SELECT last_error FROM kcc_runtime_tasks WHERE id=?'
      ).bind(task.id).first<{ last_error?: string | null }>();
      if (isTransientBrainFailure(failedTask?.last_error || '')) {
        throw new Error(failedTask?.last_error || 'TRANSIENT_BRAIN_PROVIDER_FAILURE');
      }

      return { status: 'FAILED', reason: 'BRAIN_EXECUTION_BLOCKED_OR_FAILED' };
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
    if (message.attempts >= 3) {
      await completeCloudflareTask(env.KCC_DB, taskId, 'FAILED', {
        error: `QUEUE_EXECUTION_MAX_RETRIES: ${detail}`,
        result: { failClosed: true, attempts: message.attempts }
      });
      message.ack();
      return 'ACK';
    }

    await releaseCloudflareTaskForRetry(env.KCC_DB, taskId, `QUEUE_EXECUTION_FAILED: ${detail}`);
    const transientProviderFailure = isTransientBrainFailure(detail);
    const delaySeconds = transientProviderFailure
      ? Math.min(60, 15 * message.attempts)
      : Math.min(60, 2 ** Math.max(0, message.attempts - 1));
    message.retry({ delaySeconds });
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
        brainExecution: 'native-worker',
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
  },

  async scheduled(controller: { cron: string; noRetry(): void }, env: KccCloudflareEnv): Promise<void> {
    if (!env.KCC_TASK_QUEUE) {
      console.error('[KCC Cron] KCC_TASK_QUEUE binding is required');
      controller.noRetry();
      return;
    }

    try {
      const mission = controller.cron === '*/15 * * * *'
        ? { agentId: 'PRODUCT_HUNTER', goal: 'Find and evaluate promising KITORA product opportunities from verified inputs. Do not claim supplier or purchase actions.' }
        : controller.cron === '0 * * * *'
          ? { agentId: 'INVENTORY_SYNC', goal: 'Review current inventory synchronization requirements from verified inputs and identify safe next steps. Do not execute supplier writes.' }
          : controller.cron === '0 */6 * * *'
            ? { agentId: 'COMPETITOR_SCAN', goal: 'Review competitor and pricing signals from verified inputs and prepare safe recommendations.' }
            : { agentId: 'EXECUTIVE_AUDITOR', goal: 'Produce the daily executive/runtime review from verified evidence, surface blockers and owner approvals.' };

      await enqueueCloudflareTask(env.KCC_DB, env.KCC_TASK_QUEUE, 'KCC_MISSION', {
        ...mission,
        context: { source: 'cloudflare-cron', cron: controller.cron }
      });
    } catch (error) {
      console.error('[KCC Cron] Failed to enqueue mission', error);
      controller.noRetry();
    }
  }
};

export { CLOUDFLARE_TABLES };
