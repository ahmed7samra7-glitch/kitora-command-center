import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { exec } from 'child_process';
import util from 'util';
import { dbRuntime } from './dbStorage.js';

const execPromise = util.promisify(exec);

// -------------------------------------------------------------
// 1. SAFE FILE LOCKING ENGINE (MUTEX PER FILE)
// -------------------------------------------------------------
export class SafeFileLocking {
  private static locks: Map<string, boolean> = new Map();

  public static async acquireLock(filePath: string, timeoutMs: number = 5000): Promise<boolean> {
    const normalized = path.normalize(filePath);
    const start = Date.now();

    while (this.locks.get(normalized)) {
      if (Date.now() - start > timeoutMs) {
        throw new Error(`[SafeFileLocking] Lock acquisition timeout for file: ${normalized}`);
      }
      await new Promise(res => setTimeout(res, 50));
    }

    this.locks.set(normalized, true);
    return true;
  }

  public static releaseLock(filePath: string) {
    const normalized = path.normalize(filePath);
    this.locks.delete(normalized);
  }
}

// -------------------------------------------------------------
// 2. APPROVAL POLICY ENGINE
// -------------------------------------------------------------
export interface ApprovalPolicyResult {
  requiresApproval: boolean;
  riskLevel: 'LOW' | 'HIGH';
  reason?: string;
}

export class ApprovalPolicy {
  private static HIGH_RISK_PATTERNS = [
    'server.ts',
    '/auth',
    'authentication',
    'payment',
    'paypal',
    'security',
    'deploy',
    'firestore.rules',
    '.env'
  ];

  public static evaluateRisk(filePath: string): ApprovalPolicyResult {
    const normalized = filePath.toLowerCase();
    const isHighRisk = this.HIGH_RISK_PATTERNS.some(pattern => normalized.includes(pattern));

    if (isHighRisk) {
      return {
        requiresApproval: true,
        riskLevel: 'HIGH',
        reason: `Modification of critical system asset '${filePath}' requires explicit Owner approval.`
      };
    }

    return {
      requiresApproval: false,
      riskLevel: 'LOW'
    };
  }
}

// -------------------------------------------------------------
// 3. VERSION MANAGER (SNAPSHOTS & INSTANT ROLLBACK)
// -------------------------------------------------------------
export interface FileSnapshot {
  snapshotId: string;
  filePath: string;
  originalContent: string | null;
  existedBefore: boolean;
  createdAt: string;
}

export class VersionManager {
  private static SNAPSHOT_DIR = path.join(process.cwd(), '.snapshots');

  private static ensureSnapshotDir() {
    if (!fs.existsSync(this.SNAPSHOT_DIR)) {
      fs.mkdirSync(this.SNAPSHOT_DIR, { recursive: true });
    }
  }

  public static async createSnapshot(filePath: string): Promise<FileSnapshot> {
    this.ensureSnapshotDir();
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
    const existedBefore = fs.existsSync(absolutePath);
    let originalContent: string | null = null;

    if (existedBefore) {
      originalContent = fs.readFileSync(absolutePath, 'utf-8');
    }

    const snapshotId = `SNAP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const snapshotPath = path.join(this.SNAPSHOT_DIR, `${snapshotId}.bak`);

    if (originalContent !== null) {
      fs.writeFileSync(snapshotPath, originalContent, 'utf-8');
    }

    return {
      snapshotId,
      filePath: absolutePath,
      originalContent,
      existedBefore,
      createdAt: new Date().toISOString()
    };
  }

  public static async rollback(snapshot: FileSnapshot): Promise<boolean> {
    const absolutePath = snapshot.filePath;
    try {
      if (!snapshot.existedBefore) {
        if (fs.existsSync(absolutePath)) {
          fs.unlinkSync(absolutePath);
        }
      } else if (snapshot.originalContent !== null) {
        fs.writeFileSync(absolutePath, snapshot.originalContent, 'utf-8');
      }
      console.log(`[VersionManager] ⏪ Instant rollback succeeded for ${snapshot.filePath} using snapshot ${snapshot.snapshotId}`);
      return true;
    } catch (err) {
      console.error(`[VersionManager] Rollback failed for ${snapshot.filePath}:`, err);
      return false;
    }
  }
}

// -------------------------------------------------------------
// 4. CHANGE JOURNAL
// -------------------------------------------------------------
export interface JournalEntry {
  journalId: string;
  timestamp: string;
  agentId: string;
  filePath: string;
  operation: string;
  oldHash: string;
  newHash: string;
  traceId: string;
  snapshotId: string;
  verificationPassed: boolean;
}

export class ChangeJournal {
  public static calculateHash(content: string | null): string {
    if (content === null) return 'EMPTY_FILE';
    return crypto.createHash('sha256').update(content).digest('hex');
  }

  public static logChange(entry: JournalEntry) {
    const journal = dbRuntime.get('kccChangeJournal') || [];
    journal.unshift(entry);
    if (journal.length > 500) journal.pop();
    dbRuntime.set('kccChangeJournal', journal);
  }

  public static getEntries(): JournalEntry[] {
    return dbRuntime.get('kccChangeJournal') || [];
  }
}

// -------------------------------------------------------------
// 5. REAL FILESYSTEM EXECUTION LAYER
// -------------------------------------------------------------
export class NativeFilesystemExecutionLayer {
  public static calculateAbsolutePath(filePath: string): string {
    return path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);
  }

  public static async atomicWrite(absolutePath: string, content: string): Promise<void> {
    const dir = path.dirname(absolutePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const tempFile = `${absolutePath}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, content, 'utf-8');
    fs.renameSync(tempFile, absolutePath);
  }

  public static async createFile(filePath: string, content: string): Promise<void> {
    const absolute = this.calculateAbsolutePath(filePath);
    await this.atomicWrite(absolute, content);
  }

  public static async replaceCode(filePath: string, newContent: string): Promise<void> {
    const absolute = this.calculateAbsolutePath(filePath);
    await this.atomicWrite(absolute, newContent);
  }

  public static async editFile(filePath: string, targetContent: string, replacementContent: string): Promise<void> {
    const absolute = this.calculateAbsolutePath(filePath);
    if (!fs.existsSync(absolute)) {
      throw new Error(`File does not exist: ${filePath}`);
    }
    const current = fs.readFileSync(absolute, 'utf-8');
    if (!current.includes(targetContent)) {
      throw new Error(`Target content fragment not found in ${filePath}`);
    }
    const updated = current.replace(targetContent, replacementContent);
    await this.atomicWrite(absolute, updated);
  }

  public static async deleteFile(filePath: string): Promise<void> {
    const absolute = this.calculateAbsolutePath(filePath);
    if (fs.existsSync(absolute)) {
      fs.unlinkSync(absolute);
    }
  }

  public static async renameFile(oldPath: string, newPath: string): Promise<void> {
    const oldAbsolute = this.calculateAbsolutePath(oldPath);
    const newAbsolute = this.calculateAbsolutePath(newPath);
    const newDir = path.dirname(newAbsolute);
    if (!fs.existsSync(newDir)) {
      fs.mkdirSync(newDir, { recursive: true });
    }
    fs.renameSync(oldAbsolute, newAbsolute);
  }

  public static async createFolder(folderPath: string): Promise<void> {
    const absolute = this.calculateAbsolutePath(folderPath);
    if (!fs.existsSync(absolute)) {
      fs.mkdirSync(absolute, { recursive: true });
    }
  }
}

// -------------------------------------------------------------
// 6. PATCH APPLIER WITH AUTOMATIC VERIFICATION & ROLLBACK
// -------------------------------------------------------------
export type CodeOperation = 'CREATE' | 'EDIT' | 'REPLACE' | 'DELETE' | 'RENAME' | 'MKDIR';

export interface CodePatch {
  patchId: string;
  traceId: string;
  agentId: string;
  filePath: string;
  operation: CodeOperation;
  content?: string;
  targetContent?: string;
  replacementContent?: string;
  newFilePath?: string;
  ownerApproved?: boolean;
}

export interface PatchApplyResult {
  success: boolean;
  patchId: string;
  filePath: string;
  snapshotId?: string;
  approvalRequired?: boolean;
  rolledBack?: boolean;
  error?: string;
  journalEntry?: JournalEntry;
}

export class PatchApplier {
  public static async applyPatch(patch: CodePatch): Promise<PatchApplyResult> {
    const filePath = patch.filePath;
    const absolutePath = NativeFilesystemExecutionLayer.calculateAbsolutePath(filePath);

    // Step 1: Evaluate Approval Policy
    const risk = ApprovalPolicy.evaluateRisk(filePath);
    if (risk.requiresApproval && !patch.ownerApproved) {
      const pending = dbRuntime.get('kccPendingApprovals') || [];
      pending.unshift({
        patch,
        risk,
        requestedAt: new Date().toISOString()
      });
      dbRuntime.set('kccPendingApprovals', pending);

      return {
        success: false,
        patchId: patch.patchId,
        filePath,
        approvalRequired: true,
        error: risk.reason
      };
    }

    // Step 2: Acquire Safe File Lock
    await SafeFileLocking.acquireLock(filePath);

    let snapshot: FileSnapshot | null = null;
    let oldContent: string | null = null;

    try {
      if (fs.existsSync(absolutePath)) {
        oldContent = fs.readFileSync(absolutePath, 'utf-8');
      }

      // Step 3: Create Version Snapshot
      snapshot = await VersionManager.createSnapshot(filePath);

      // Step 4: Execute Native Filesystem Modification
      switch (patch.operation) {
        case 'CREATE':
          await NativeFilesystemExecutionLayer.createFile(filePath, patch.content || '');
          break;
        case 'REPLACE':
          await NativeFilesystemExecutionLayer.replaceCode(filePath, patch.content || '');
          break;
        case 'EDIT':
          await NativeFilesystemExecutionLayer.editFile(filePath, patch.targetContent || '', patch.replacementContent || '');
          break;
        case 'DELETE':
          await NativeFilesystemExecutionLayer.deleteFile(filePath);
          break;
        case 'RENAME':
          if (!patch.newFilePath) throw new Error('newFilePath is required for RENAME operation');
          await NativeFilesystemExecutionLayer.renameFile(filePath, patch.newFilePath);
          break;
        case 'MKDIR':
          await NativeFilesystemExecutionLayer.createFolder(filePath);
          break;
        default:
          throw new Error(`Unsupported operation: ${patch.operation}`);
      }

      // Step 5: Automatically Execute Type Check / Compilation Verification
      let verificationPassed = true;
      let verificationOutput = '';

      try {
        const tscPath = path.join(process.cwd(), 'node_modules', '.bin', 'tsc');
        const cmd = fs.existsSync(tscPath) ? `"${tscPath}" --noEmit` : 'npm run lint';
        const { stdout, stderr } = await execPromise(cmd, { cwd: process.cwd(), timeout: 25000 });
        if (stderr || stdout.includes('error TS')) {
          verificationPassed = false;
          verificationOutput = stdout || stderr;
        }
      } catch (err: any) {
        const errStr = String(err?.stdout || err?.stderr || err?.message || '');
        if (errStr.includes('error TS')) {
          verificationPassed = false;
          verificationOutput = errStr;
        }
      }

      // Step 6: If compilation failed, restore previous snapshot automatically!
      if (!verificationPassed) {
        console.warn(`[PatchApplier] ❌ Compilation failed after applying patch ${patch.patchId}. Triggering automatic rollback.`);
        await VersionManager.rollback(snapshot);

        SafeFileLocking.releaseLock(filePath);
        return {
          success: false,
          patchId: patch.patchId,
          filePath,
          snapshotId: snapshot.snapshotId,
          rolledBack: true,
          error: `Compilation verification failed after patch: ${verificationOutput.substring(0, 300)}`
        };
      }

      // Step 7: Record Change in ChangeJournal
      let newContent: string | null = null;
      if (fs.existsSync(absolutePath)) {
        newContent = fs.readFileSync(absolutePath, 'utf-8');
      }

      const journalEntry: JournalEntry = {
        journalId: `JRNL-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        timestamp: new Date().toISOString(),
        agentId: patch.agentId,
        filePath,
        operation: patch.operation,
        oldHash: ChangeJournal.calculateHash(oldContent),
        newHash: ChangeJournal.calculateHash(newContent),
        traceId: patch.traceId,
        snapshotId: snapshot.snapshotId,
        verificationPassed: true
      };

      ChangeJournal.logChange(journalEntry);

      SafeFileLocking.releaseLock(filePath);
      return {
        success: true,
        patchId: patch.patchId,
        filePath,
        snapshotId: snapshot.snapshotId,
        journalEntry
      };
    } catch (err: any) {
      if (snapshot) {
        await VersionManager.rollback(snapshot);
      }
      SafeFileLocking.releaseLock(filePath);
      return {
        success: false,
        patchId: patch.patchId,
        filePath,
        error: err?.message || String(err)
      };
    }
  }
}
