export interface StorageAdapter<T extends object = Record<string, unknown>> {
  readonly driver: string;
  readonly durable: boolean;
  get<K extends keyof T>(key: K | string): Promise<T[K] | undefined>;
  set<K extends keyof T>(key: K | string, value: T[K] | unknown): Promise<void>;
  update(mutator: (snapshot: T) => void | T): Promise<T>;
  snapshot(): Promise<T>;
  health(): Promise<{ status: 'CONNECTED' | 'NOT_CONFIGURED' | 'DEGRADED'; driver: string; durable: boolean }>;
}

export interface StorageRuntimeOptions {
  driver: string;
  production: boolean;
}

export function assertProductionStorage(options: StorageRuntimeOptions): void {
  if (!options.production) return;
  if (options.driver === 'local') {
    throw new Error('SECURITY FATAL: local storage is development/test only in production.');
  }
}
