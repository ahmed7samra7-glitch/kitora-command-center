import { dbRuntime } from './dbStorage.js';
import { eventBus } from './eventBus.js';

// =============================================================
// 1. EXPONENTIAL BACKOFF WITH JITTER
// =============================================================

export interface BackoffContext {
  missionId?: string;
  taskId?: string;
  commandId?: string;
  idempotencyKey?: string;
  operationId?: string;
}

export interface BackoffOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  jitterFactor?: number; // e.g. 0.2 = ±20%
  context?: BackoffContext;
}

const RETRYABLE_HTTP_STATUSES = new Set([429, 408, 500, 502, 503, 504]);
const RETRYABLE_ERROR_STRINGS = [
  '429', '408', '500', '502', '503', '504',
  'RATE_LIMIT', 'RESOURCE_EXHAUSTED', 'QUOTA_EXCEEDED',
  'TIMEOUT', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'SOCKETTIMEOUT'
];

export function isRetryableError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.statusCode || err.response?.status;
  if (status && RETRYABLE_HTTP_STATUSES.has(status)) return true;

  const msg = String(err.message || err.code || err).toUpperCase();
  return RETRYABLE_ERROR_STRINGS.some(s => msg.includes(s));
}

export async function executeWithExponentialBackoff<T>(
  fn: () => Promise<T>,
  options: BackoffOptions = {}
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelay = options.initialDelayMs ?? 200;
  const maxDelay = options.maxDelayMs ?? 4000;
  const factor = options.backoffFactor ?? 2;
  const jitter = options.jitterFactor ?? 0.2;
  const ctx = options.context || {};

  let attempt = 0;

  while (true) {
    try {
      attempt++;
      return await fn();
    } catch (err: any) {
      const retryable = isRetryableError(err);
      if (!retryable || attempt > maxRetries) {
        if (ctx.taskId || ctx.missionId) {
          console.warn(`[Backoff Engine] Non-retryable error or max retries reached (attempt ${attempt}/${maxRetries}) for task ${ctx.taskId || 'N/A'}: ${err.message || err}`);
        }
        throw err;
      }

      // Calculate exponential backoff with jitter
      let delay = Math.min(maxDelay, initialDelay * Math.pow(factor, attempt - 1));
      const jitterDelta = delay * jitter * (Math.random() * 2 - 1);
      delay = Math.max(50, Math.floor(delay + jitterDelta));

      console.warn(`[Backoff Engine] Retryable error encountered (Attempt ${attempt}/${maxRetries}). Retrying in ${delay}ms. Context: [mission: ${ctx.missionId || 'N/A'}, task: ${ctx.taskId || 'N/A'}, idempotencyKey: ${ctx.idempotencyKey || 'N/A'}]. Error: ${err.message || err}`);

      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// =============================================================
// 2. CIRCUIT BREAKER (CLOSED, OPEN, HALF_OPEN)
// =============================================================

export type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  providerId: string;
  failureThreshold?: number; // Failures before opening circuit
  cooldownMs?: number;       // Time in OPEN state before trying HALF_OPEN
  successThreshold?: number; // Successes in HALF_OPEN before returning to CLOSED
}

export class CircuitBreaker {
  public providerId: string;
  public state: CircuitState = 'CLOSED';
  public failureCount = 0;
  public successCount = 0;
  public lastFailureTime = 0;
  public failureThreshold: number;
  public cooldownMs: number;
  public successThreshold: number;

  constructor(config: CircuitBreakerConfig) {
    this.providerId = config.providerId;
    this.failureThreshold = config.failureThreshold ?? 3;
    this.cooldownMs = config.cooldownMs ?? 10000; // 10s cooldown
    this.successThreshold = config.successThreshold ?? 2;
  }

  public canExecute(): boolean {
    const now = Date.now();

    if (this.state === 'OPEN') {
      if (now - this.lastFailureTime > this.cooldownMs) {
        console.log(`[Circuit Breaker:${this.providerId}] Cooldown elapsed (${this.cooldownMs}ms). Transitioning OPEN -> HALF_OPEN for health probe.`);
        this.state = 'HALF_OPEN';
        this.successCount = 0;
        return true;
      }
      console.warn(`[Circuit Breaker:${this.providerId}] Circuit is OPEN. Request blocked to prevent retry storm.`);
      return false;
    }

    return true; // CLOSED or HALF_OPEN
  }

  public recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      if (this.successCount >= this.successThreshold) {
        console.log(`[Circuit Breaker:${this.providerId}] ${this.successCount} consecutive probe successes. Circuit HALF_OPEN -> CLOSED (Recovered).`);
        this.state = 'CLOSED';
        this.failureCount = 0;
        this.successCount = 0;
      }
    } else if (this.state === 'CLOSED') {
      this.failureCount = 0;
    }
  }

  public recordFailure(err?: any): void {
    this.lastFailureTime = Date.now();
    this.failureCount++;

    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      console.error(`[Circuit Breaker:${this.providerId}] Failure threshold reached (${this.failureCount}/${this.failureThreshold}). Circuit CLOSED -> OPEN. Triggering failover.`);
      this.state = 'OPEN';
      eventBus.emit('circuit:opened', { providerId: this.providerId, failureCount: this.failureCount, error: err?.message || String(err) });
    } else if (this.state === 'HALF_OPEN') {
      console.warn(`[Circuit Breaker:${this.providerId}] Probe failed while HALF_OPEN. Circuit HALF_OPEN -> OPEN.`);
      this.state = 'OPEN';
    }
  }

  public getStatus() {
    return {
      providerId: this.providerId,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime
    };
  }
}

class CircuitBreakerRegistry {
  private breakers: Map<string, CircuitBreaker> = new Map();

  public getBreaker(providerId: string): CircuitBreaker {
    const key = providerId.toLowerCase();
    if (!this.breakers.has(key)) {
      this.breakers.set(key, new CircuitBreaker({ providerId: key }));
    }
    return this.breakers.get(key)!;
  }

  public getAllStatuses() {
    const result: Record<string, any> = {};
    for (const [key, breaker] of this.breakers.entries()) {
      result[key] = breaker.getStatus();
    }
    return result;
  }
}

export const circuitBreakerRegistry = new CircuitBreakerRegistry();

// =============================================================
// 3. FINANCIAL SAFETY BOUNDS & HARD LIMITS
// =============================================================

export interface FinancialPolicyConfig {
  MAX_DAILY_AD_SPEND: number;          // Default $500
  MAX_SINGLE_TRANSACTION: number;      // Default $250
  MAX_DAILY_TRANSACTIONS: number;      // Default 20
  MAX_AUTONOMOUS_REFUND: number;       // Default $100
  MAX_AUTONOMOUS_ORDER_VALUE: number;  // Default $1,000
}

export const FINANCIAL_SAFETY_LIMITS: FinancialPolicyConfig = {
  MAX_DAILY_AD_SPEND: Number(process.env.MAX_DAILY_AD_SPEND) || 500,
  MAX_SINGLE_TRANSACTION: Number(process.env.MAX_SINGLE_TRANSACTION) || 250,
  MAX_DAILY_TRANSACTIONS: Number(process.env.MAX_DAILY_TRANSACTIONS) || 20,
  MAX_AUTONOMOUS_REFUND: Number(process.env.MAX_AUTONOMOUS_REFUND) || 100,
  MAX_AUTONOMOUS_ORDER_VALUE: Number(process.env.MAX_AUTONOMOUS_ORDER_VALUE) || 1000
};

export interface FinancialCheckRequest {
  actionType: 'AD_SPEND' | 'TRANSACTION' | 'REFUND' | 'ORDER';
  amountUSD: number;
  missionId?: string;
  taskId?: string;
}

export interface FinancialCheckResult {
  allowed: boolean;
  requiresHumanApproval: boolean;
  reason?: string;
  policyLimit: number;
  requestedAmount: number;
}

export function checkFinancialPolicy(req: FinancialCheckRequest): FinancialCheckResult {
  const { actionType, amountUSD, missionId, taskId } = req;
  const todayKey = `fin_daily_${new Date().toISOString().substring(0, 10)}`;
  const dailyData = dbRuntime.get(todayKey) || { adSpendUSD: 0, txCount: 0, totalSpendUSD: 0 };

  if (actionType === 'AD_SPEND') {
    const projectedDailyAdSpend = dailyData.adSpendUSD + amountUSD;
    if (projectedDailyAdSpend > FINANCIAL_SAFETY_LIMITS.MAX_DAILY_AD_SPEND || amountUSD > FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION) {
      const reason = `Ad spend $${amountUSD} (projected daily: $${projectedDailyAdSpend.toFixed(2)}) exceeds daily policy limit $${FINANCIAL_SAFETY_LIMITS.MAX_DAILY_AD_SPEND} or single transaction limit $${FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION}`;
      console.warn(`[Financial Safety Guard] REQUIRES_HUMAN_APPROVAL: ${reason} for mission ${missionId || 'N/A'}`);
      return {
        allowed: false,
        requiresHumanApproval: true,
        reason,
        policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_DAILY_AD_SPEND,
        requestedAmount: amountUSD
      };
    }
  }

  if (actionType === 'TRANSACTION') {
    if (amountUSD > FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION) {
      const reason = `Transaction amount $${amountUSD} exceeds single transaction safety limit $${FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION}`;
      console.warn(`[Financial Safety Guard] REQUIRES_HUMAN_APPROVAL: ${reason}`);
      return {
        allowed: false,
        requiresHumanApproval: true,
        reason,
        policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION,
        requestedAmount: amountUSD
      };
    }
    if (dailyData.txCount + 1 > FINANCIAL_SAFETY_LIMITS.MAX_DAILY_TRANSACTIONS) {
      const reason = `Daily transaction count (${dailyData.txCount + 1}) exceeds maximum allowed daily transactions (${FINANCIAL_SAFETY_LIMITS.MAX_DAILY_TRANSACTIONS})`;
      return {
        allowed: false,
        requiresHumanApproval: true,
        reason,
        policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_DAILY_TRANSACTIONS,
        requestedAmount: dailyData.txCount + 1
      };
    }
  }

  if (actionType === 'REFUND' && amountUSD > FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_REFUND) {
    const reason = `Autonomous refund $${amountUSD} exceeds limit $${FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_REFUND}`;
    return {
      allowed: false,
      requiresHumanApproval: true,
      reason,
      policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_REFUND,
      requestedAmount: amountUSD
    };
  }

  if (actionType === 'ORDER' && amountUSD > FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_ORDER_VALUE) {
    const reason = `Order value $${amountUSD} exceeds autonomous order threshold $${FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_ORDER_VALUE}`;
    return {
      allowed: false,
      requiresHumanApproval: true,
      reason,
      policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_AUTONOMOUS_ORDER_VALUE,
      requestedAmount: amountUSD
    };
  }

  return {
    allowed: true,
    requiresHumanApproval: false,
    policyLimit: FINANCIAL_SAFETY_LIMITS.MAX_SINGLE_TRANSACTION,
    requestedAmount: amountUSD
  };
}

export function recordFinancialExpenditure(actionType: 'AD_SPEND' | 'TRANSACTION', amountUSD: number) {
  const todayKey = `fin_daily_${new Date().toISOString().substring(0, 10)}`;
  const dailyData = dbRuntime.get(todayKey) || { adSpendUSD: 0, txCount: 0, totalSpendUSD: 0 };

  if (actionType === 'AD_SPEND') dailyData.adSpendUSD += amountUSD;
  dailyData.txCount += 1;
  dailyData.totalSpendUSD += amountUSD;

  dbRuntime.set(todayKey, dailyData);
}
