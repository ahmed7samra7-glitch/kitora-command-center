import type { StorageAdapter } from './storageAdapter.js';

type JsonObject = Record<string, unknown>;

interface SupabaseRow {
  singleton_id: string;
  state: JsonObject;
  version: number;
  updated_at: string;
}

export class SupabaseStorageAdapter implements StorageAdapter<JsonObject> {
  public readonly driver = 'supabase';
  public readonly durable = true;

  private readonly url: string;
  private readonly serviceRoleKey: string;
  private state: JsonObject = {};
  private version = 0;

  constructor(
    url = process.env.SUPABASE_URL || '',
    serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''
  ) {
    this.url = url.replace(/\/$/, '');
    this.serviceRoleKey = serviceRoleKey;
  }

  private assertConfigured() {
    if (!this.url || !this.serviceRoleKey) {
      throw new Error('Supabase storage is not configured: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
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

  public async initialize(): Promise<void> {
    this.assertConfigured();
    const response = await fetch(`${this.url}/rest/v1/kcc_runtime_state?singleton_id=eq.singleton`, {
      headers: this.headers()
    });

    if (!response.ok) {
      throw new Error(`Supabase state read failed (${response.status}).`);
    }

    const rows = (await response.json()) as SupabaseRow[];
    if (rows.length === 0) {
      await this.persist(this.state, 0);
      return;
    }

    this.state = rows[0].state || {};
    this.version = Number(rows[0].version || 0);
  }

  private async persist(nextState: JsonObject, expectedVersion: number): Promise<void> {
    this.assertConfigured();

    const rpcResponse = await fetch(`${this.url}/rest/v1/rpc/kcc_replace_runtime_state`, {
      method: 'POST',
      headers: this.headers(),
      body: JSON.stringify({
        p_singleton_id: 'singleton',
        p_expected_version: expectedVersion,
        p_state: nextState
      })
    });

    if (!rpcResponse.ok) {
      const detail = await rpcResponse.text().catch(() => '');
      throw new Error(`Supabase state update failed (${rpcResponse.status}). ${detail}`.trim());
    }

    const result = (await rpcResponse.json()) as Array<{ version: number }>;
    if (!Array.isArray(result) || result.length !== 1) {
      throw new Error('Supabase state update returned an invalid result.');
    }

    this.version = Number(result[0].version);
    this.state = structuredClone(nextState);
  }

  public async get<K extends string>(key: K): Promise<unknown> {
    return this.state[key];
  }

  public async set<K extends string>(key: K, value: unknown): Promise<void> {
    const next = structuredClone(this.state);
    next[key] = value;
    await this.persist(next, this.version);
  }

  public async update(mutator: (snapshot: JsonObject) => void | JsonObject): Promise<JsonObject> {
    const snapshot = structuredClone(this.state);
    const result = mutator(snapshot);
    const next = (result && typeof result === 'object' ? result : snapshot) as JsonObject;
    await this.persist(next, this.version);
    return structuredClone(this.state);
  }

  public async snapshot(): Promise<JsonObject> {
    return structuredClone(this.state);
  }

  public async health() {
    if (!this.url || !this.serviceRoleKey) {
      return { status: 'NOT_CONFIGURED' as const, driver: this.driver, durable: this.durable };
    }

    try {
      const response = await fetch(`${this.url}/rest/v1/kcc_runtime_state?select=singleton_id&singleton_id=eq.singleton`, {
        headers: this.headers()
      });
      return {
        status: response.ok ? 'CONNECTED' as const : 'DEGRADED' as const,
        driver: this.driver,
        durable: this.durable
      };
    } catch {
      return { status: 'DEGRADED' as const, driver: this.driver, durable: this.durable };
    }
  }
}
