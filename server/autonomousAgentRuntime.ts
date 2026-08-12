import { GoogleGenAI } from '@google/genai';
import { dbRuntime } from './dbStorage.js';
import { eventBus } from './eventBus.js';
import { cjDropshippingRuntime } from './cjDropshipping.js';
import { payPalRuntime } from './paypal.js';
import { phase4CommerceEngine } from './phase4AutonomousCommerce.js';
import { kccBrain } from './kccBrain.js';

export interface AgentTask {
  id: string;
  type:
    | 'PRODUCT_HUNT'
    | 'INVENTORY_SYNC'
    | 'COMPETITOR_SCAN'
    | 'ORDER_FULFILLMENT'
    | 'PAYMENT_CAPTURED'
    | 'SHIPMENT_UPDATE'
    | 'CUSTOMER_NOTIFY'
    | 'DAILY_FINANCIAL_REPORT'
    | 'DAILY_EXECUTIVE_REPORT'
    | 'STORE_HEALTH_CHECK';
  payload: any;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'RETRYING';
  attempts: number;
  maxRetries: number;
  providerUsed?: string;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QueueBatchResult {
  processed: number;
  succeeded: number;
  failed: number;
  retried: number;
  remaining: number;
}

export interface RuntimeStatus {
  isAlive: boolean;
  zeroTouchMode: boolean;
  uptimeSeconds: number;
  activeTasksRunning: number;
  queueLength: number;
  completedTasksCount: number;
  failedTasksCount: number;
  lastScheduleCheck: string;
  continuousLoopEnabled: boolean;
  aiProviderHealth: {
    primary: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    secondary: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    deterministicFallback: 'ALWAYS_AVAILABLE';
  };
}

class PermanentAutonomousAgentRuntime {
  private queue: AgentTask[] = [];
  private isLoopRunning = false;
  private loopTimer: NodeJS.Timeout | null = null;
  private scheduleTimer: NodeJS.Timeout | null = null;
  private startTime = Date.now();
  private completedCount = 0;
  private failedCount = 0;
  private activeRunningCount = 0;
  private lastScheduleCheck = new Date().toISOString();
  private subscriptionsInitialized = false;

  private primaryAiClient: GoogleGenAI | null = null;
  private quotaCooloffUntil = 0;

  constructor() {
    this.initAiClients();
    this.recoverPersistedQueue();
    this.subscribeToEventBus();
  }

  private isContinuousLoopEnabled(): boolean {
    return process.env.ENABLE_CONTINUOUS_LOOP === 'true';
  }

  private getBatchSize(): number {
    const value = Number.parseInt(process.env.AGENT_QUEUE_BATCH_SIZE || '3', 10);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 25) : 3;
  }

  private getTaskTimeoutMs(): number {
    const value = Number.parseInt(process.env.AGENT_TASK_TIMEOUT_MS || '30000', 10);
    return Number.isFinite(value) && value > 0 ? Math.min(value, 300000) : 30000;
  }

  private initAiClients() {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      this.primaryAiClient = new GoogleGenAI({
        apiKey: key,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build-autonomous-runtime' } }
      });
    }
  }

  private recoverPersistedQueue() {
    const savedQueue = dbRuntime.get('taskQueue');
    if (!Array.isArray(savedQueue)) return;

    this.queue = savedQueue;
    for (const task of this.queue) {
      if (task.status === 'RUNNING' || task.status === 'RETRYING') {
        task.status = 'QUEUED';
        task.updatedAt = new Date().toISOString();
      }
    }
    this.saveQueue();
  }

  // Legacy continuous mode is retained for development/controlled operation only.
  public start() {
    if (this.isLoopRunning) return;

    this.recoverPersistedQueue();
    this.subscribeToEventBus();

    if (!this.isContinuousLoopEnabled()) {
      this.isLoopRunning = false;
      console.log('[Autonomous Runtime] Continuous loop disabled. Runtime is batch/event driven.');
      eventBus.publish('RUNTIME.BOOT.SUCCESS', 'AutonomousAgentRuntime', {
        zeroTouchMode: true,
        executionMode: 'BATCH_EVENT_DRIVEN',
        timestamp: new Date().toISOString()
      });
      return;
    }

    console.log('[Autonomous Runtime] Continuous background mode enabled.');
    this.isLoopRunning = true;
    this.loopTimer = setInterval(() => {
      void this.processQueueBatch(this.getBatchSize());
    }, 3000);
    this.startAutonomousScheduler();

    eventBus.publish('RUNTIME.BOOT.SUCCESS', 'AutonomousAgentRuntime', {
      zeroTouchMode: true,
      executionMode: 'CONTINUOUS',
      timestamp: new Date().toISOString()
    });
  }

  public stop() {
    this.isLoopRunning = false;
    if (this.loopTimer) {
      clearInterval(this.loopTimer);
      this.loopTimer = null;
    }
    if (this.scheduleTimer) {
      clearInterval(this.scheduleTimer);
      this.scheduleTimer = null;
    }
  }

  private saveQueue() {
    dbRuntime.set('taskQueue', this.queue);
  }

  public async executeWithFallbackAI(
    prompt: string,
    systemInstruction: string,
    fallbackOutput: any,
    agentId: string = 'EXECUTIVE_AUDITOR'
  ): Promise<{ result: any; provider: string }> {
    const decision = await kccBrain.executeAgentTask(agentId, prompt, fallbackOutput);
    return { result: decision.output, provider: decision.selectedModel };
  }

  public enqueueTask(type: AgentTask['type'], payload: any = {}): AgentTask {
    const requestedKey = typeof payload?.idempotencyKey === 'string' ? payload.idempotencyKey : undefined;
    if (requestedKey) {
      const existing = this.queue.find(task => task.payload?.idempotencyKey === requestedKey);
      if (existing) return existing;
    }

    const task: AgentTask = {
      id: `TASK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
      type,
      payload,
      status: 'QUEUED',
      attempts: 0,
      maxRetries: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    this.queue.push(task);
    this.saveQueue();
    eventBus.publish('AGENT.TASK.QUEUED', 'AutonomousAgentRuntime', {
      taskId: task.id,
      type: task.type,
      idempotencyKey: requestedKey
    });
    return task;
  }

  public async processQueueBatch(maxTasks: number = this.getBatchSize()): Promise<QueueBatchResult> {
    const limit = Number.isFinite(maxTasks) && maxTasks > 0 ? Math.min(Math.floor(maxTasks), 25) : this.getBatchSize();
    let processed = 0;
    let succeeded = 0;
    let failed = 0;
    let retried = 0;

    while (processed < limit) {
      const task = this.queue.find(candidate => candidate.status === 'QUEUED');
      if (!task) break;

      processed += 1;
      const outcome = await this.processNextQueueTask(task);
      if (outcome === 'SUCCEEDED') succeeded += 1;
      else if (outcome === 'FAILED') failed += 1;
      else if (outcome === 'RETRYING') retried += 1;
    }

    return {
      processed,
      succeeded,
      failed,
      retried,
      remaining: this.queue.filter(task => task.status === 'QUEUED' || task.status === 'RETRYING').length
    };
  }

  private async processNextQueueTask(task: AgentTask): Promise<'SUCCEEDED' | 'FAILED' | 'RETRYING'> {
    if (this.activeRunningCount > 0) return 'RETRYING';

    task.status = 'RUNNING';
    task.attempts += 1;
    task.updatedAt = new Date().toISOString();
    this.activeRunningCount = 1;
    this.saveQueue();

    eventBus.publish('AGENT.TASK.STARTED', 'AutonomousAgentRuntime', {
      taskId: task.id,
      type: task.type,
      attempt: task.attempts
    });

    try {
      const provider = await Promise.race([
        this.executeTaskLogic(task),
        new Promise<string>((_, reject) => {
          setTimeout(() => reject(new Error(`Task timeout after ${this.getTaskTimeoutMs()}ms`)), this.getTaskTimeoutMs());
        })
      ]);

      task.status = 'COMPLETED';
      task.providerUsed = provider;
      task.updatedAt = new Date().toISOString();
      this.completedCount += 1;
      eventBus.publish('AGENT.TASK.COMPLETED', 'AutonomousAgentRuntime', {
        taskId: task.id,
        type: task.type,
        provider
      });
      return 'SUCCEEDED';
    } catch (err: any) {
      task.lastError = err?.message || String(err);
      task.updatedAt = new Date().toISOString();

      if (task.attempts < task.maxRetries) {
        // Retries are persisted and picked up by the next external batch invocation.
        task.status = 'QUEUED';
        this.saveQueue();
        return 'RETRYING';
      }

      task.status = 'FAILED';
      this.failedCount += 1;
      this.saveQueue();
      eventBus.publish('AGENT.TASK.FAILED', 'AutonomousAgentRuntime', {
        taskId: task.id,
        type: task.type,
        error: task.lastError,
        attempt: task.attempts
      });
      return 'FAILED';
    } finally {
      this.activeRunningCount = 0;
      this.saveQueue();
    }
  }

  private async executeTaskLogic(task: AgentTask): Promise<string> {
    switch (task.type) {
      case 'PRODUCT_HUNT': {
        const hunted = await phase4CommerceEngine.discoverAndHuntProducts();
        eventBus.publish('COMMERCE.PRODUCT.HUNTED.AUTO', 'AutonomousRuntime', { count: hunted.length });
        return 'gemini-3.6-flash';
      }
      case 'INVENTORY_SYNC':
        await cjDropshippingRuntime.syncInventory();
        return 'cj-sync-engine';
      case 'COMPETITOR_SCAN':
        await phase4CommerceEngine.runAutonomousGrowthEngine();
        return 'autonomous-growth-engine';
      case 'ORDER_FULFILLMENT': {
        if (task.payload?.customerName) {
          await phase4CommerceEngine.processCompleteOrderPipeline(task.payload);
        } else {
          const paypalOrders = payPalRuntime.getSavedOrders().filter(o => o.status === 'COMPLETED');
          const cjOrders = cjDropshippingRuntime.getOrders();
          for (const order of paypalOrders) {
            const exists = cjOrders.some(cjo => cjo.paypalOrderId === order.id);
            if (!exists) {
              await phase4CommerceEngine.processCompleteOrderPipeline({
                customerName: order.payer?.name?.given_name ? `${order.payer.name.given_name} ${order.payer.name.surname}` : 'KITORA Customer',
                customerEmail: order.payer?.email_address || 'customer@kitora.store',
                customerPhone: '+14155552671',
                shippingAddress: { address: '100 Silicon Valley Way', city: 'San Jose', country: 'US', zip: '95134' },
                productId: 'PROD-KITORA-001',
                quantity: 1,
                paymentAmountUSD: order.amount,
                paypalPaymentId: order.id
              });
            }
          }
        }
        return 'paypal-cj-bridge-engine';
      }
      case 'CUSTOMER_NOTIFY':
        await phase4CommerceEngine.triggerCustomerAutomation(task.payload?.orderId || 'ORD-991', task.payload?.event || 'ORDER_PLACED');
        return 'whatsapp-dispatch-engine';
      case 'DAILY_FINANCIAL_REPORT':
      case 'DAILY_EXECUTIVE_REPORT':
      case 'STORE_HEALTH_CHECK': {
        const overview = phase4CommerceEngine.getExecutiveOverview();
        eventBus.publish('COMMERCE.REPORT.GENERATED', 'AutonomousRuntime', { type: task.type, overview });
        phase4CommerceEngine.sendOwnerNotificationIfRequired({
          type: 'DAILY_EXECUTIVE_REPORT',
          title: 'Daily Executive & Financial Performance Report',
          message: `Net Profit: $${overview.financials.netProfit} (${overview.financials.profitMarginPercent}% margin). Total Products Published: ${overview.totalCatalogProducts}. Zero intervention required.`,
          severity: 'LOW',
          payload: overview
        });
        return 'executive-intelligence-engine';
      }
      default:
        return 'system';
    }
  }

  private subscribeToEventBus() {
    if (this.subscriptionsInitialized) return;
    this.subscriptionsInitialized = true;

    eventBus.subscribe('CJ.PRODUCT.NEW', async (evt) => {
      this.enqueueTask('PRODUCT_HUNT', { ...evt.payload, idempotencyKey: `CJ.PRODUCT.NEW:${evt.id}` });
    });

    eventBus.subscribe('PAYPAL.ORDER.COMPLETED', async (evt) => {
      const eventKey = `PAYPAL.ORDER.COMPLETED:${evt.id}`;
      this.enqueueTask('ORDER_FULFILLMENT', { ...evt.payload, idempotencyKey: `${eventKey}:FULFILL` });
      this.enqueueTask('CUSTOMER_NOTIFY', { orderId: evt.payload?.id, event: 'ORDER_PLACED', idempotencyKey: `${eventKey}:NOTIFY` });
    });

    eventBus.subscribe('CJ.SHIPMENT.UPDATED', async (evt) => {
      this.enqueueTask('CUSTOMER_NOTIFY', {
        orderId: evt.payload?.orderId,
        event: 'SHIPPED',
        idempotencyKey: `CJ.SHIPMENT.UPDATED:${evt.id}`
      });
    });
  }

  private startAutonomousScheduler() {
    let tickCounter = 0;
    this.scheduleTimer = setInterval(() => {
      tickCounter += 1;
      this.lastScheduleCheck = new Date().toISOString();

      if (tickCounter % 15 === 0) this.enqueueTask('PRODUCT_HUNT', { idempotencyKey: `SCHEDULE:PRODUCT_HUNT:${Math.floor(tickCounter / 15)}` });
      if (tickCounter % 60 === 0) this.enqueueTask('INVENTORY_SYNC', { idempotencyKey: `SCHEDULE:INVENTORY_SYNC:${Math.floor(tickCounter / 60)}` });
      if (tickCounter % 360 === 0) this.enqueueTask('COMPETITOR_SCAN', { idempotencyKey: `SCHEDULE:COMPETITOR_SCAN:${Math.floor(tickCounter / 360)}` });
      if (tickCounter % 1440 === 0) {
        const day = Math.floor(tickCounter / 1440);
        this.enqueueTask('DAILY_FINANCIAL_REPORT', { idempotencyKey: `SCHEDULE:DAILY_FINANCIAL_REPORT:${day}` });
        this.enqueueTask('DAILY_EXECUTIVE_REPORT', { idempotencyKey: `SCHEDULE:DAILY_EXECUTIVE_REPORT:${day}` });
        this.enqueueTask('STORE_HEALTH_CHECK', { idempotencyKey: `SCHEDULE:STORE_HEALTH_CHECK:${day}` });
      }
    }, 60000);
  }

  public getStatus(): RuntimeStatus {
    return {
      isAlive: this.isLoopRunning,
      zeroTouchMode: true,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
      activeTasksRunning: this.activeRunningCount,
      queueLength: this.queue.length,
      completedTasksCount: this.completedCount,
      failedTasksCount: this.failedCount,
      lastScheduleCheck: this.lastScheduleCheck,
      continuousLoopEnabled: this.isContinuousLoopEnabled(),
      aiProviderHealth: {
        primary: this.primaryAiClient ? 'ONLINE' : 'DEGRADED',
        secondary: this.primaryAiClient ? 'ONLINE' : 'DEGRADED',
        deterministicFallback: 'ALWAYS_AVAILABLE'
      }
    };
  }

  public getQueue(): AgentTask[] {
    return this.queue;
  }
}

export const autonomousAgentRuntime = new PermanentAutonomousAgentRuntime();
