import { randomUUID } from 'node:crypto';
import { dbRuntime } from './dbStorage.js';

type TaskStatus = 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';

export interface DurableQueuedTask {
  id: string;
  type: string;
  payload: any;
  status: TaskStatus;
  attempts: number;
  maxRetries: number;
  providerUsed?: string;
  result?: any;
  lastError?: string;
  leaseOwner?: string;
  leaseUntil?: string;
  createdAt: string;
  updatedAt: string;
}

export class DurableTaskQueue {
  private readonly useSupabase: boolean;
  private readonly url: string;
  private readonly serviceRoleKey: string;
  private readonly workerId: string;

  constructor() {
    this.useSupabase = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() === 'supabase';
    this.url = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
    this.workerId = process.env.KCC_WORKER_INSTANCE_ID || `kcc-${randomUUID()}`;
    if (this.useSupabase && (!this.url || !this.serviceRoleKey)) {
      throw new Error('Supabase task queue requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
    }
  }

  private headers() {
    return {
      apikey: this.serviceRoleKey,
      Authorization: `Bearer ${this.serviceRoleKey}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    };
  }

  public async enqueue(task: Omit<DurableQueuedTask, 'createdAt' | 'updatedAt' | 'attempts' | 'status'> & Partial<Pick<DurableQueuedTask, 'createdAt' | 'updatedAt' | 'attempts' | 'status'>>): Promise<DurableQueuedTask> {
    const now = new Date().toISOString();
    const normalized: DurableQueuedTask = {
      id: task.id,
      type: task.type,
      payload: task.payload ?? {},
      status: task.status ?? 'QUEUED',
      attempts: task.attempts ?? 0,
      maxRetries: task.maxRetries ?? 3,
      createdAt: task.createdAt ?? now,
      updatedAt: task.updatedAt ?? now,
      providerUsed: task.providerUsed,
      result: task.result,
      lastError: task.lastError
    };

    if (!this.useSupabase) {
      const queue = dbRuntime.get('taskQueue') || [];
      if (!queue.some((item: DurableQueuedTask) => item.id === normalized.id)) {
        queue.push(normalized);
        dbRuntime.set('taskQueue', queue);
      }
      return normalized;
    }

    const response = await fetch(`${this.url}/rest/v1/rpc/kcc_enqueue_task`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        p_id: normalized.id,
        p_type: normalized.type,
        p_payload: normalized.payload,
        p_max_retries: normalized.maxRetries
      })
    });
    if (!response.ok) {
      throw new Error(`Supabase enqueue failed (${response.status}).`);
    }
    return normalized;
  }

  public async claimBatch(limit: number): Promise<DurableQueuedTask[]> {
    if (!this.useSupabase) {
      const queue = (dbRuntime.get('taskQueue') || []) as DurableQueuedTask[];
      const claimed = queue.filter((task) => task.status === 'QUEUED').slice(0, Math.min(Math.max(limit, 1), 10));
      const leaseUntil = new Date(Date.now() + 300000).toISOString();
      for (const task of claimed) {
        task.status = 'RUNNING';
        task.attempts += 1;
        task.leaseOwner = this.workerId;
        task.leaseUntil = leaseUntil;
        task.updatedAt = new Date().toISOString();
      }
      dbRuntime.set('taskQueue', queue);
      return claimed;
    }

    const response = await fetch(`${this.url}/rest/v1/rpc/kcc_claim_task_batch`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ p_worker_id: this.workerId, p_limit: Math.min(Math.max(limit, 1), 10), p_lease_seconds: 300 })
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      throw new Error(`Supabase claim failed (${response.status}). ${detail}`.trim());
    }

    const rows = await response.json() as any[];
    return rows.map((row) => ({
      id: row.id,
      type: row.type,
      payload: row.payload || {},
      status: row.status,
      attempts: row.attempts,
      maxRetries: row.max_retries,
      providerUsed: row.provider_used,
      result: row.result,
      lastError: row.last_error,
      leaseOwner: row.lease_owner,
      leaseUntil: row.lease_until,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }));
  }

  public async complete(taskId: string, result: any, providerUsed: string): Promise<void> {
    if (!this.useSupabase) {
      const queue = (dbRuntime.get('taskQueue') || []) as DurableQueuedTask[];
      const task = queue.find((item) => item.id === taskId);
      if (!task) return;
      task.status = 'COMPLETED';
      task.result = result;
      task.providerUsed = providerUsed;
      task.leaseOwner = undefined;
      task.leaseUntil = undefined;
      task.updatedAt = new Date().toISOString();
      dbRuntime.set('taskQueue', queue);
      return;
    }

    const response = await fetch(`${this.url}/rest/v1/rpc/kcc_complete_task`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ p_id: taskId, p_worker_id: this.workerId, p_result: result ?? {}, p_provider_used: providerUsed })
    });
    if (!response.ok) throw new Error(`Supabase task completion failed (${response.status}).`);
  }

  public async fail(taskId: string, error: string, retry: boolean): Promise<void> {
    if (!this.useSupabase) {
      const queue = (dbRuntime.get('taskQueue') || []) as DurableQueuedTask[];
      const task = queue.find((item) => item.id === taskId);
      if (!task) return;
      task.status = retry ? 'QUEUED' : 'FAILED';
      task.lastError = error;
      task.leaseOwner = undefined;
      task.leaseUntil = undefined;
      task.updatedAt = new Date().toISOString();
      dbRuntime.set('taskQueue', queue);
      return;
    }

    const response = await fetch(`${this.url}/rest/v1/rpc/kcc_fail_task`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({ p_id: taskId, p_worker_id: this.workerId, p_error: error, p_retry: retry })
    });
    if (!response.ok) throw new Error(`Supabase task failure update failed (${response.status}).`);
  }

  public async health() {
    if (!this.useSupabase) return { status: 'LOCAL' as const, workerId: this.workerId };
    try {
      const response = await fetch(`${this.url}/rest/v1/kcc_task_queue?select=id&limit=1`, { headers: this.headers() });
      return { status: response.ok ? 'CONNECTED' as const : 'DEGRADED' as const, workerId: this.workerId };
    } catch {
      return { status: 'DEGRADED' as const, workerId: this.workerId };
    }
  }
}

export const durableTaskQueue = new DurableTaskQueue();
