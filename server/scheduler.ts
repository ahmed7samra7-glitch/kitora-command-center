import { eventBus } from './eventBus.js';
import { dbRuntime } from './dbStorage.js';
import { payPalRuntime } from './paypal.js';
import { cjDropshippingRuntime } from './cjDropshipping.js';
import { phase4CommerceEngine } from './phase4AutonomousCommerce.js';

export interface ScheduledJob {
  id: string;
  name: string;
  cronExpression: string;
  intervalMs: number;
  lastRunAt?: string;
  nextRunAt: string;
  status: 'IDLE' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PAUSED';
  failureCount: number;
  maxRetries: number;
  lastError?: string;
  enabled: boolean;
  category: 'SYNC' | 'FULFILLMENT' | 'HEALTH' | 'MARKETING';
}

class PersistentSchedulerEngine {
  private jobs: ScheduledJob[] = [];
  private timer: NodeJS.Timeout | null = null;
  private isProcessing = false;

  constructor() {
    this.initDefaultJobs();
    this.startLoop();
  }

  private initDefaultJobs() {
    const saved = dbRuntime.get('scheduledJobs');
    if (Array.isArray(saved) && saved.length > 0) {
      this.jobs = saved;
      return;
    }

    const now = Date.now();
    this.jobs = [
      {
        id: 'JOB-ORDER-FULFILLMENT',
        name: 'Autonomous Order Fulfillment Processor',
        cronExpression: '*/1 * * * *',
        intervalMs: 60000, // 1 minute
        nextRunAt: new Date(now + 60000).toISOString(),
        status: 'IDLE',
        failureCount: 0,
        maxRetries: 3,
        enabled: true,
        category: 'FULFILLMENT'
      },
      {
        id: 'JOB-CJ-CATALOG-SYNC',
        name: 'CJ Dropshipping Catalog & Margin Sync',
        cronExpression: '*/15 * * * *',
        intervalMs: 900000, // 15 minutes
        nextRunAt: new Date(now + 900000).toISOString(),
        status: 'IDLE',
        failureCount: 0,
        maxRetries: 3,
        enabled: true,
        category: 'SYNC'
      },
      {
        id: 'JOB-INVENTORY-REBALANCE',
        name: 'Inventory Stock & Risk Monitor',
        cronExpression: '*/30 * * * *',
        intervalMs: 1800000, // 30 minutes
        nextRunAt: new Date(now + 1800000).toISOString(),
        status: 'IDLE',
        failureCount: 0,
        maxRetries: 3,
        enabled: true,
        category: 'SYNC'
      },
      {
        id: 'JOB-HEALTH-HEARTBEAT',
        name: 'Core System Health & Heartbeat Checker',
        cronExpression: '*/30s * * * *',
        intervalMs: 30000, // 30 seconds
        nextRunAt: new Date(now + 30000).toISOString(),
        status: 'IDLE',
        failureCount: 0,
        maxRetries: 5,
        enabled: true,
        category: 'HEALTH'
      }
    ];

    dbRuntime.set('scheduledJobs', this.jobs);
  }

  private startLoop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = setInterval(() => {
      this.tick();
    }, 10000); // Tick every 10 seconds
  }

  private async tick() {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const now = new Date();
      for (let i = 0; i < this.jobs.length; i++) {
        const job = this.jobs[i];
        if (!job.enabled || job.status === 'RUNNING' || job.status === 'PAUSED') continue;

        const nextRun = new Date(job.nextRunAt);
        if (now >= nextRun) {
          await this.executeJob(job);
        }
      }
    } catch (e) {
      console.error('[Scheduler Engine] Error during loop tick:', e);
    } finally {
      this.isProcessing = false;
    }
  }

  public async executeJob(job: ScheduledJob): Promise<boolean> {
    job.status = 'RUNNING';
    job.lastRunAt = new Date().toISOString();
    dbRuntime.set('scheduledJobs', this.jobs);

    eventBus.publish('SCHEDULER.JOB.STARTED', 'SchedulerEngine', { jobId: job.id, name: job.name });

    let success = false;
    let errorMsg = '';

    try {
      if (job.id === 'JOB-ORDER-FULFILLMENT') {
        // Reuse the canonical pipeline so payment, CJ fulfillment, liveOrders,
        // notification authorization, and the idempotency reservation stay aligned.
        const paypalOrders = payPalRuntime.getSavedOrders().filter(o => o.status === 'COMPLETED');
        const liveOrders = dbRuntime.get('liveOrders') || [];
        const reservations = dbRuntime.get('fulfillmentReservations') || {};

        for (const ppOrder of paypalOrders) {
          const alreadySubmitted = liveOrders.some((order: any) => order.paypalOrderId === ppOrder.id) || Boolean(reservations[ppOrder.id]);
          if (!alreadySubmitted && ppOrder.checkoutDetails) {
            await phase4CommerceEngine.processCompleteOrderPipeline({
              ...ppOrder.checkoutDetails,
              paymentAmountUSD: ppOrder.amount,
              paypalPaymentId: ppOrder.id,
            });
          }
        }
        success = true;
      } else if (job.id === 'JOB-CJ-CATALOG-SYNC') {
        await cjDropshippingRuntime.syncProducts('smart', 10);
        success = true;
      } else if (job.id === 'JOB-INVENTORY-REBALANCE') {
        await cjDropshippingRuntime.syncInventory();
        success = true;
      } else if (job.id === 'JOB-HEALTH-HEARTBEAT') {
        await payPalRuntime.getHealthStatus();
        await cjDropshippingRuntime.getHealthStatus();
        success = true;
      } else {
        success = true;
      }
    } catch (err: any) {
      success = false;
      errorMsg = err?.message || 'Execution failed';
    }

    const now = Date.now();
    job.nextRunAt = new Date(now + job.intervalMs).toISOString();

    if (success) {
      job.status = 'SUCCESS';
      job.failureCount = 0;
      job.lastError = undefined;
      eventBus.publish('SCHEDULER.JOB.COMPLETED', 'SchedulerEngine', { jobId: job.id });
    } else {
      job.failureCount += 1;
      job.lastError = errorMsg;
      job.status = job.failureCount >= job.maxRetries ? 'FAILED' : 'IDLE';

      eventBus.publish('SCHEDULER.JOB.FAILED', 'SchedulerEngine', { 
        jobId: job.id, 
        failureCount: job.failureCount, 
        error: errorMsg 
      });

      // Exponential backoff for retries
      if (job.failureCount < job.maxRetries) {
        const backoffMs = Math.pow(2, job.failureCount) * 10000;
        job.nextRunAt = new Date(now + backoffMs).toISOString();
      }
    }

    dbRuntime.set('scheduledJobs', this.jobs);
    return success;
  }

  public async executeWithRetry<T>(
    operationName: string,
    fn: () => Promise<T>,
    maxRetries = 3,
    initialBackoffMs = 1000
  ): Promise<T> {
    let attempt = 0;
    while (attempt < maxRetries) {
      try {
        attempt++;
        return await fn();
      } catch (error: any) {
        console.warn(`[Retry Engine] ${operationName} failed (Attempt ${attempt}/${maxRetries}):`, error?.message || error);
        if (attempt >= maxRetries) {
          throw new Error(`[Retry Engine] ${operationName} exceeded maximum retries (${maxRetries}). Error: ${error?.message || error}`);
        }
        const backoff = initialBackoffMs * Math.pow(2, attempt - 1);
        await new Promise(res => setTimeout(res, backoff));
      }
    }
    throw new Error(`[Retry Engine] ${operationName} failed after ${maxRetries} attempts.`);
  }

  public getJobs(): ScheduledJob[] {
    return this.jobs;
  }

  public toggleJob(jobId: string, enabled?: boolean): ScheduledJob {
    const job = this.jobs.find(j => j.id === jobId);
    if (!job) throw new Error(`Job ${jobId} not found`);

    job.enabled = enabled !== undefined ? enabled : !job.enabled;
    if (job.enabled && job.status === 'PAUSED') {
      job.status = 'IDLE';
    } else if (!job.enabled) {
      job.status = 'PAUSED';
    }

    dbRuntime.set('scheduledJobs', this.jobs);
    eventBus.publish('SCHEDULER.JOB.TOGGLED', 'SchedulerEngine', { jobId: job.id, enabled: job.enabled });
    return job;
  }
}

export const schedulerEngine = new PersistentSchedulerEngine();
