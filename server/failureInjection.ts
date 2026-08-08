import { eventBus } from './eventBus.js';
import { dbRuntime } from './dbStorage.js';

export interface FailureConfig {
  paypalOffline: boolean;
  cjOffline: boolean;
  geminiTimeout: boolean;
  dbUnavailable: boolean;
  networkLatencyMs: number;
  expiredCredentials: boolean;
  webhookFailure: boolean;
}

class FailureInjectionEngine {
  private config: FailureConfig = {
    paypalOffline: false,
    cjOffline: false,
    geminiTimeout: false,
    dbUnavailable: false,
    networkLatencyMs: 0,
    expiredCredentials: false,
    webhookFailure: false
  };

  private recoveryAttempts: number = 0;
  private autoRecoveriesCount: number = 0;

  public getConfig(): FailureConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<FailureConfig>): FailureConfig {
    this.config = { ...this.config, ...newConfig };
    eventBus.publish('DIAGNOSTICS.FAILURE_INJECTION.UPDATED', 'FailureInjectionEngine', this.config);
    return this.config;
  }

  public async intercept<T>(serviceName: string, action: () => Promise<T>, fallback?: () => Promise<T>): Promise<T> {
    // 1. Simulated Network Latency
    if (this.config.networkLatencyMs > 0) {
      await new Promise(res => setTimeout(res, this.config.networkLatencyMs));
    }

    // 2. Service Specific Injections
    if (serviceName === 'PayPal' && this.config.paypalOffline) {
      this.recoveryAttempts++;
      eventBus.publish('DIAGNOSTICS.FAILURE.TRIGGERED', 'FailureInjectionEngine', {
        service: 'PayPal',
        error: 'SIMULATED_PAYPAL_503_SERVICE_UNAVAILABLE'
      });
      if (fallback) {
        this.autoRecoveriesCount++;
        eventBus.publish('DIAGNOSTICS.RECOVERY.SUCCESS', 'FailureInjectionEngine', {
          service: 'PayPal',
          strategy: 'Autonomous Fallback to Offline Payment Queue'
        });
        return await fallback();
      }
      throw new Error('[Failure Injection] PayPal Service Unavailable (Simulated)');
    }

    if (serviceName === 'CJDropshipping' && this.config.cjOffline) {
      this.recoveryAttempts++;
      eventBus.publish('DIAGNOSTICS.FAILURE.TRIGGERED', 'FailureInjectionEngine', {
        service: 'CJDropshipping',
        error: 'SIMULATED_CJ_API_CONNECTION_REFUSED'
      });
      if (fallback) {
        this.autoRecoveriesCount++;
        eventBus.publish('DIAGNOSTICS.RECOVERY.SUCCESS', 'FailureInjectionEngine', {
          service: 'CJDropshipping',
          strategy: 'Buffered Local Inventory Match & Queue Retry'
        });
        return await fallback();
      }
      throw new Error('[Failure Injection] CJ Dropshipping API Connection Refused (Simulated)');
    }

    if (serviceName === 'Gemini' && this.config.geminiTimeout) {
      this.recoveryAttempts++;
      eventBus.publish('DIAGNOSTICS.FAILURE.TRIGGERED', 'FailureInjectionEngine', {
        service: 'Gemini',
        error: 'SIMULATED_GEMINI_GATEWAY_TIMEOUT_504'
      });
      if (fallback) {
        this.autoRecoveriesCount++;
        eventBus.publish('DIAGNOSTICS.RECOVERY.SUCCESS', 'FailureInjectionEngine', {
          service: 'Gemini',
          strategy: 'Switched to Dynamic Local Model Fallback'
        });
        return await fallback();
      }
      throw new Error('[Failure Injection] Gemini API Gateway Timeout (Simulated)');
    }

    if (this.config.dbUnavailable) {
      this.recoveryAttempts++;
      eventBus.publish('DIAGNOSTICS.FAILURE.TRIGGERED', 'FailureInjectionEngine', {
        service: 'Database',
        error: 'SIMULATED_DATABASE_LOCK_TIMEOUT'
      });
      if (fallback) {
        this.autoRecoveriesCount++;
        return await fallback();
      }
      throw new Error('[Failure Injection] Persistent DB Locked/Unavailable (Simulated)');
    }

    if (this.config.expiredCredentials) {
      this.recoveryAttempts++;
      eventBus.publish('DIAGNOSTICS.FAILURE.TRIGGERED', 'FailureInjectionEngine', {
        service: serviceName,
        error: 'SIMULATED_401_INVALID_OR_EXPIRED_TOKEN'
      });
      if (fallback) {
        this.autoRecoveriesCount++;
        return await fallback();
      }
      throw new Error(`[Failure Injection] ${serviceName} Credentials Expired (Simulated 401)`);
    }

    // Normal execution
    return await action();
  }

  public getStats() {
    return {
      recoveryAttempts: this.recoveryAttempts,
      autoRecoveriesCount: this.autoRecoveriesCount,
      activeFailuresCount: Object.values(this.config).filter(v => v === true || (typeof v === 'number' && v > 0)).length
    };
  }
}

export const failureInjection = new FailureInjectionEngine();
