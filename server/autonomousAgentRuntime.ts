import { GoogleGenAI } from '@google/genai';
import { dbRuntime } from './dbStorage.js';
import { eventBus, BusEvent } from './eventBus.js';
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

export interface RuntimeStatus {
  isAlive: boolean;
  zeroTouchMode: boolean;
  uptimeSeconds: number;
  activeTasksRunning: number;
  queueLength: number;
  completedTasksCount: number;
  failedTasksCount: number;
  lastScheduleCheck: string;
  aiProviderHealth: {
    primary: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    secondary: 'ONLINE' | 'DEGRADED' | 'OFFLINE';
    deterministicFallback: 'BLOCKED';
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

  private primaryAiClient: GoogleGenAI | null = null;
  private quotaCooloffUntil = 0;

  constructor() {
    this.initAiClients();
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

  public start() {
    if (this.isLoopRunning) {
      console.log('[Autonomous Runtime] Background runner is already active 24/7.');
      return;
    }

    console.log('[Autonomous Runtime] 🚀 Booting 24/7 Permanent Autonomous Agent Runtime...');
    const savedQueue = dbRuntime.get('taskQueue');
    if (Array.isArray(savedQueue) && savedQueue.length > 0) {
      this.queue = savedQueue;
      for (const t of this.queue) {
        if (t.status === 'RUNNING' || t.status === 'RETRYING') {
          t.status = 'QUEUED';
        }
      }
      this.saveQueue();
      console.log(`[Autonomous Runtime] Resumed ${this.queue.length} tasks from disk queue.`);
    }

    this.subscribeToEventBus();
    this.isLoopRunning = true;
    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);
    this.startAutonomousScheduler();

    eventBus.publish('RUNTIME.BOOT.SUCCESS', 'AutonomousAgentRuntime', {
      zeroTouchMode: true,
      timestamp: new Date().toISOString()
    });

    console.log('[Autonomous Runtime] ✅ 24/7 Zero-Touch Autonomous Agent Runtime is ACTIVE.');
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
    console.log('[Autonomous Runtime] Stopped 24/7 Permanent Autonomous Agent Runtime.');
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
    if (decision.status !== 'COMPLETED') {
      const error = new Error(`KCC Brain ${decision.status}: autonomous fallback execution cannot continue without a completed provider result.`) as Error & { code?: string; status?: string; shouldRetry?: boolean };
      error.code = 'KCC_BRAIN_BLOCKED';
      error.status = decision.status;
      error.shouldRetry = decision.shouldRetry;
      throw error;
    }
    if (decision.output === null || decision.output === undefined) {
      const error = new Error('KCC Brain COMPLETED result contained no output.') as Error & { code?: string };
      error.code = 'KCC_BRAIN_INVALID_OUTPUT';
      throw error;
    }
    return {
      result: decision.output,
      provider: decision.selectedModel
    };
  }

  public enqueueTask(type: AgentTask['type'], payload: any = {}): AgentTask {
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
    eventBus.publish('AGENT.TASK.QUEUED', 'AutonomousAgentRuntime', { taskId: task.id, type: task.type });
    return task;
  }

  private async processNextQueueTask() {
    if (this.activeRunningCount > 0) return;

    const nextTask = this.queue.find(t => t.status === 'QUEUED');
    if (!nextTask) return;

    nextTask.status = 'RUNNING';
    nextTask.attempts += 1;
    nextTask.updatedAt = new Date().toISOString();
    this.activeRunningCount = 1;
    this.saveQueue();

    eventBus.publish('AGENT.TASK.STARTED', 'AutonomousAgentRuntime', { taskId: nextTask.id, type: nextTask.type });

    try {
      const provider = await this.executeTaskLogic(nextTask);
      nextTask.status = 'COMPLETED';
      nextTask.providerUsed = provider;
      nextTask.updatedAt = new Date().toISOString();
      this.completedCount += 1;

      eventBus.publish('AGENT.TASK.COMPLETED', 'AutonomousAgentRuntime', {
        taskId: nextTask.id,
        type: nextTask.type,
        provider
      });
    } catch (err: any) {
      console.error(`[Autonomous Runtime] Task ${nextTask.id} failed (Attempt ${nextTask.attempts}/${nextTask.maxRetries}):`, err?.message);
      if (nextTask.attempts < nextTask.maxRetries) {
        nextTask.status = 'RETRYING';
        nextTask.lastError = err?.message;
        nextTask.updatedAt = new Date().toISOString();
        setTimeout(() => {
          nextTask.status = 'QUEUED';
          this.saveQueue();
        }, 3000 * nextTask.attempts);
      } else {
        nextTask.status = 'FAILED';
        nextTask.lastError = err?.message;
        nextTask.updatedAt = new Date().toISOString();
        this.failedCount += 1;

        eventBus.publish('AGENT.TASK.FAILED', 'AutonomousAgentRuntime', {
          taskId: nextTask.id,
          type: nextTask.type,
          error: err?.message
        });
      }
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

      case 'INVENTORY_SYNC': {
        await cjDropshippingRuntime.syncInventory();
        return 'cj-sync-engine';
      }

      case 'COMPETITOR_SCAN': {
        await phase4CommerceEngine.runAutonomousGrowthEngine();
        return 'autonomous-growth-engine';
      }

      case 'ORDER_FULFILLMENT': {
        if (!task.payload?.customerName) {
          throw new Error('Canonical fulfillment requires persisted checkout details; refusing synthetic shipping or product data');
        }
        await phase4CommerceEngine.processCompleteOrderPipeline(task.payload);
        return 'paypal-cj-bridge-engine';
      }

      case 'CUSTOMER_NOTIFY': {
        const orderId = task.payload?.orderId;
        const event = task.payload?.event;
        if (!orderId || !event) {
          throw new Error('Canonical customer notification requires persisted orderId and event; refusing synthetic notification data');
        }
        await phase4CommerceEngine.triggerCustomerAutomation(orderId, event);
        return 'whatsapp-dispatch-engine';
      }

      case 'DAILY_FINANCIAL_REPORT':
      case 'DAILY_EXECUTIVE_REPORT':
      case 'STORE_HEALTH_CHECK': {
        const overview = phase4CommerceEngine.getExecutiveOverview();
        eventBus.publish('COMMERCE.REPORT.GENERATED', 'AutonomousRuntime', { type: task.type, overview });

        phase4CommerceEngine.sendOwnerNotificationIfRequired({
          type: 'DAILY_EXECUTIVE_REPORT',
          title: `Daily Executive & Financial Performance Report`,
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
    eventBus.subscribe('CJ.PRODUCT.NEW', async (evt) => {
      console.log('[Event-Driven Runtime] Auto-reacting to new CJ product discovery...');
      this.enqueueTask('PRODUCT_HUNT', evt.payload);
    });

    eventBus.subscribe('PAYPAL.ORDER.CAPTURED', async (evt) => {
      console.log('[Event-Driven Runtime] Payment captured! Auto-submitting CJ order through the canonical pipeline...');
      this.enqueueTask('ORDER_FULFILLMENT', evt.payload);
    });

    eventBus.subscribe('CJ.SHIPMENT.UPDATED', async (evt) => {
      console.log('[Event-Driven Runtime] Shipment update received. Auto-notifying customer...');
      this.enqueueTask('CUSTOMER_NOTIFY', { orderId: evt.payload?.orderId, event: 'SHIPPED' });
    });
  }

  private startAutonomousScheduler() {
    let tickCounter = 0;
    this.scheduleTimer = setInterval(() => {
      tickCounter++;
      this.lastScheduleCheck = new Date().toISOString();

      if (tickCounter % 15 === 0) {
        console.log('[Autonomous Scheduler] [15 Min] Running Product Hunter routine...');
        this.enqueueTask('PRODUCT_HUNT');
      }

      if (tickCounter % 60 === 0) {
        console.log('[Autonomous Scheduler] [1 Hour] Running Inventory Sync routine...');
        this.enqueueTask('INVENTORY_SYNC');
      }

      if (tickCounter % 360 === 0) {
        console.log('[Autonomous Scheduler] [6 Hours] Running Competitor & Price Scan routine...');
        this.enqueueTask('COMPETITOR_SCAN');
      }

      if (tickCounter % 1440 === 0) {
        console.log('[Autonomous Scheduler] [Daily 24h] Running Daily Executive & Financial Reports...');
        this.enqueueTask('DAILY_FINANCIAL_REPORT');
        this.enqueueTask('DAILY_EXECUTIVE_REPORT');
        this.enqueueTask('STORE_HEALTH_CHECK');
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
      aiProviderHealth: {
        primary: this.primaryAiClient ? 'ONLINE' : 'DEGRADED',
        secondary: this.primaryAiClient ? 'ONLINE' : 'DEGRADED',
        deterministicFallback: 'BLOCKED'
      }
    };
  }

  public getQueue(): AgentTask[] {
    return this.queue;
  }
}

export const autonomousAgentRuntime = new PermanentAutonomousAgentRuntime();
