import fs from 'fs';
import path from 'path';

const DATA_DIR = process.env.KCC_DB_DIR?.trim()
  ? path.resolve(process.env.KCC_DB_DIR)
  : path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

export interface DatabaseSchema {
  policies: any;
  agentRuntimes: Record<string, any>;
  tasks: any[];
  taskQueue: any[];
  workflows: any[];
  auditLogs: any[];
  paypalOrders: any[];
  cjOrders: any[];
  cjProducts: any[];
  storeCatalog: any[];
  liveOrders: any[];
  fulfillmentReservations?: Record<string, any>;
  ownerNotifications: any[];
  scheduledJobs: any[];
  eventLogs: any[];
  kccPromptRegistry?: Record<string, any>;
  kccMissionControlState?: Record<string, any>;
  kccIndependenceTest?: Record<string, any>;
  dailyCeoReports?: any[];
  kccAiJobs?: any[];
  kccChainedPipelines?: any[];
  kccAiExecutionLogs?: any[];
  kccProviderHealthHistory?: any[];
  kccSelfImprovementTasks?: any[];
  kccImprovementMemory?: any[];
  kccSelfDevLoopStats?: Record<string, any>;
  kccChangeJournal?: any[];
  kccPendingApprovals?: any[];
  kccWorkers?: any[];
  kccWorkerTasks?: any[];
  kccMissions?: any[];
  kccKnowledgeMemory?: any[];
  kccBusinessKPIs?: any;
  kccScheduledMissions?: any[];
  kccNegotiationHistory?: any[];
  kccDeadLetterQueue?: any[];
  kccOrchestrationAuditTrail?: any[];
  kccConversations?: any[];
  kccConsensusDecisions?: any[];
  kccExecutiveDiscussions?: any[];
  kccProviderEvidence?: any[];
  updatedAt: string;
}

const DEFAULT_DB_DATA: DatabaseSchema = {
  policies: null,
  agentRuntimes: {},
  tasks: [],
  taskQueue: [],
  workflows: [],
  auditLogs: [],
  paypalOrders: [],
  cjOrders: [],
  cjProducts: [],
  storeCatalog: [],
  liveOrders: [],
  fulfillmentReservations: {},
  ownerNotifications: [],
  scheduledJobs: [],
  eventLogs: [],
  kccPromptRegistry: {},
  kccMissionControlState: {},
  kccIndependenceTest: {},
  dailyCeoReports: [],
  kccAiJobs: [],
  kccChainedPipelines: [],
  kccAiExecutionLogs: [],
  kccProviderHealthHistory: [],
  kccSelfImprovementTasks: [],
  kccImprovementMemory: [],
  kccSelfDevLoopStats: {},
  kccChangeJournal: [],
  kccPendingApprovals: [],
  kccWorkers: [],
  kccWorkerTasks: [],
  kccMissions: [],
  kccDeadLetterQueue: [],
  kccOrchestrationAuditTrail: [],
  kccConversations: [],
  kccConsensusDecisions: [],
  updatedAt: new Date().toISOString()
};

class PersistentDatabaseRuntime {
  private memoryDb: DatabaseSchema;

  constructor() {
    this.memoryDb = { ...DEFAULT_DB_DATA };
    this.ensureDataDir();
    this.loadFromDisk();
  }

  private ensureDataDir() {
    try {
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }
    } catch (e) {
      console.error('[DB Runtime] Error creating data directory:', e);
    }
  }

  public loadFromDisk(): DatabaseSchema {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        const parsed = JSON.parse(raw);
        this.memoryDb = { ...DEFAULT_DB_DATA, ...parsed };
        console.log(`[DB Runtime] Persistent DB loaded successfully from ${DB_FILE}`);
      } else {
        this.saveToDisk();
      }
    } catch (e) {
      console.error('[DB Runtime] Failed to load DB from disk, initializing fresh:', e);
      this.saveToDisk();
    }
    return this.memoryDb;
  }

  public saveToDisk() {
    try {
      this.ensureDataDir();
      this.memoryDb.updatedAt = new Date().toISOString();
      fs.writeFileSync(DB_FILE, JSON.stringify(this.memoryDb, null, 2), 'utf-8');
    } catch (e) {
      console.error('[DB Runtime] Error writing DB to disk:', e);
    }
  }

  public get(key: keyof DatabaseSchema | string): any {
    return (this.memoryDb as any)[key];
  }

  public set(key: keyof DatabaseSchema | string, value: any) {
    (this.memoryDb as any)[key] = value;
    this.saveToDisk();
  }

  public update(updater: (db: DatabaseSchema) => void) {
    updater(this.memoryDb);
    this.saveToDisk();
  }

  public getFullSnapshot(): DatabaseSchema {
    return JSON.parse(JSON.stringify(this.memoryDb));
  }

  public getStatus() {
    return {
      status: 'CONNECTED',
      storage: DB_FILE,
      updatedAt: this.memoryDb.updatedAt || new Date().toISOString()
    };
  }
}

export const dbRuntime = new PersistentDatabaseRuntime();
