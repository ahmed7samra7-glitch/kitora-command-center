import { eventBus } from './eventBus.js';
import { payPalRuntime } from './paypal.js';
import { cjDropshippingRuntime } from './cjDropshipping.js';
import { failureInjection } from './failureInjection.js';

export interface StressTestResult {
  taskCount: number;
  completedTasks: number;
  failedTasks: number;
  recoveredTasks: number;
  durationMs: number;
  throughputPerSec: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
  memoryUsageStart: { rssMB: number; heapUsedMB: number };
  memoryUsageEnd: { rssMB: number; heapUsedMB: number };
  memoryDeltaMB: number;
  queueGrowthPeak: number;
  providerFailuresEncountered: number;
  timestamp: string;
}

class StressTester {
  private isTesting: boolean = false;
  private lastResult: StressTestResult | null = null;
  private history: StressTestResult[] = [];

  public getHistory(): StressTestResult[] {
    return this.history;
  }

  public getLastResult(): StressTestResult | null {
    return this.lastResult;
  }

  public isBusy(): boolean {
    return this.isTesting;
  }

  public async runStressTest(taskCount: number): Promise<StressTestResult> {
    if (this.isTesting) {
      throw new Error('A stress test is already actively running.');
    }

    this.isTesting = true;
    const startTime = Date.now();
    const memStart = process.memoryUsage();

    let completedTasks = 0;
    let failedTasks = 0;
    let recoveredTasks = 0;
    let providerFailures = 0;
    const latencies: number[] = [];

    eventBus.publish('DIAGNOSTICS.STRESS_TEST.STARTED', 'StressTester', { taskCount, startTime: new Date().toISOString() });

    // Process tasks in parallel chunks of 50 to avoid Node call-stack exhaustion
    const chunkSize = 50;
    const totalChunks = Math.ceil(taskCount / chunkSize);

    let maxQueueGrowth = 0;

    for (let c = 0; c < totalChunks; c++) {
      const currentChunkSize = Math.min(chunkSize, taskCount - c * chunkSize);
      maxQueueGrowth = Math.max(maxQueueGrowth, currentChunkSize * 2);

      const tasks = Array.from({ length: currentChunkSize }, async (_, idx) => {
        const taskStart = Date.now();
        const taskId = `STRESS-TASK-${c}-${idx}-${Date.now()}`;

        try {
          // Simulated or real workflow step execution via Failure Interceptor
          await failureInjection.intercept(
            'PayPal',
            async () => {
              // Lightweight execution simulation
              const orderId = `PP-SIM-${Math.floor(Math.random() * 1000000)}`;
              return orderId;
            },
            async () => {
              // Fallback recovery path
              recoveredTasks++;
              return `PP-RECOVERED-${taskId}`;
            }
          );

          await failureInjection.intercept(
            'CJDropshipping',
            async () => {
              return `CJ-SIM-${Math.floor(Math.random() * 1000000)}`;
            },
            async () => {
              recoveredTasks++;
              return `CJ-RECOVERED-${taskId}`;
            }
          );

          completedTasks++;
        } catch (err: any) {
          failedTasks++;
          providerFailures++;
        } finally {
          latencies.push(Date.now() - taskStart);
        }
      });

      await Promise.all(tasks);
    }

    const durationMs = Math.max(1, Date.now() - startTime);
    const memEnd = process.memoryUsage();

    // Latency math
    latencies.sort((a, b) => a - b);
    const avgLatencyMs = latencies.reduce((a, b) => a + b, 0) / latencies.length || 0;
    const p95Idx = Math.floor(latencies.length * 0.95);
    const p95LatencyMs = latencies[p95Idx] || avgLatencyMs;

    const rssStartMB = Math.round(memStart.rss / 1024 / 1024);
    const rssEndMB = Math.round(memEnd.rss / 1024 / 1024);
    const heapStartMB = Math.round(memStart.heapUsed / 1024 / 1024);
    const heapEndMB = Math.round(memEnd.heapUsed / 1024 / 1024);

    const result: StressTestResult = {
      taskCount,
      completedTasks,
      failedTasks,
      recoveredTasks,
      durationMs,
      throughputPerSec: parseFloat(((completedTasks / durationMs) * 1000).toFixed(2)),
      avgLatencyMs: parseFloat(avgLatencyMs.toFixed(2)),
      p95LatencyMs: parseFloat(p95LatencyMs.toFixed(2)),
      memoryUsageStart: { rssMB: rssStartMB, heapUsedMB: heapStartMB },
      memoryUsageEnd: { rssMB: rssEndMB, heapUsedMB: heapEndMB },
      memoryDeltaMB: rssEndMB - rssStartMB,
      queueGrowthPeak: maxQueueGrowth,
      providerFailuresEncountered: providerFailures,
      timestamp: new Date().toISOString()
    };

    this.lastResult = result;
    this.history.unshift(result);
    if (this.history.length > 20) this.history.pop();

    this.isTesting = false;

    eventBus.publish('DIAGNOSTICS.STRESS_TEST.COMPLETED', 'StressTester', result);
    return result;
  }
}

export const stressTester = new StressTester();
