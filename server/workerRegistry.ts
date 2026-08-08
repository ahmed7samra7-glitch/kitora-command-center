import { dbRuntime } from './dbStorage.js';
import { eventBus } from './eventBus.js';

// -------------------------------------------------------------
// TYPES & DATA STRUCTURES
// -------------------------------------------------------------
export type WorkerStatus = 'ONLINE' | 'OFFLINE' | 'BUSY' | 'IDLE';
export type TaskState = 'QUEUED' | 'ASSIGNED' | 'RUNNING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';

export type WorkerType = 'LOCAL_WORKER' | 'REMOTE_AI_WORKER';

export interface WorkerNode {
  workerId: string;
  provider: string;
  capabilities: string[];
  status: WorkerStatus;
  workerType?: WorkerType;
  currentTask: string | null;
  lastHeartbeat: string;
  registeredAt: string;
}

export interface WorkerTask {
  taskId: string;
  traceId: string;
  workerId: string | null;
  provider: string;
  priority: string | number;
  status: TaskState;
  payload?: any;
  result?: any;
  error?: string;
  dependsOn?: string[];
  createdAt: string;
  updatedAt: string;
}

// -------------------------------------------------------------
// WORKER REGISTRY & MESSAGING BUS ENGINE
// -------------------------------------------------------------
export class WorkerRegistryManager {
  private timeoutInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Start background timeout monitor every 10 seconds
    this.startTimeoutMonitor();
  }

  private startTimeoutMonitor() {
    if (this.timeoutInterval) return;
    this.timeoutInterval = setInterval(() => {
      this.checkWorkerTimeouts();
    }, 10000);
  }

  // 1. REGISTER OR UPDATE WORKER
  public registerWorker(data: {
    workerId: string;
    provider: string;
    capabilities?: string[];
    status?: WorkerStatus;
  }): WorkerNode {
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];
    const now = new Date().toISOString();

    const providerLower = (data.provider || 'generic-provider').toLowerCase();
    const workerType = ['gemini', 'openai', 'claude', 'manus'].includes(providerLower) ? 'REMOTE_AI_WORKER' : 'LOCAL_WORKER';

    let worker = workers.find(w => w.workerId === data.workerId);

    if (worker) {
      worker.provider = data.provider || worker.provider;
      worker.capabilities = data.capabilities || worker.capabilities || [];
      worker.status = data.status || 'ONLINE';
      worker.workerType = workerType;
      worker.lastHeartbeat = now;
    } else {
      worker = {
        workerId: data.workerId,
        provider: data.provider || 'generic-provider',
        capabilities: data.capabilities || ['general_execution'],
        status: data.status || 'ONLINE',
        workerType,
        currentTask: null,
        lastHeartbeat: now,
        registeredAt: now
      };
      workers.push(worker);
    }

    dbRuntime.set('kccWorkers', workers);

    eventBus.publish('worker_registered', 'WORKER_REGISTRY', {
      workerId: worker.workerId,
      provider: worker.provider,
      status: worker.status
    });

    return worker;
  }

  // 2. PROCESS HEARTBEAT
  public heartbeat(workerId: string, status?: WorkerStatus): WorkerNode {
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];
    const worker = workers.find(w => w.workerId === workerId);

    if (!worker) {
      // Auto-register if heartbeat received from unlisted worker
      return this.registerWorker({ workerId, provider: 'auto-registered', status: status || 'ONLINE' });
    }

    const now = new Date().toISOString();
    worker.lastHeartbeat = now;

    if (status) {
      worker.status = status;
    } else if (worker.status === 'OFFLINE') {
      worker.status = worker.currentTask ? 'BUSY' : 'ONLINE';
    }

    dbRuntime.set('kccWorkers', workers);

    eventBus.publish('worker_heartbeat', 'WORKER_REGISTRY', {
      workerId: worker.workerId,
      status: worker.status,
      timestamp: now
    });

    return worker;
  }

  // 3. CREATE OR QUEUE TASK
  public createTask(data: {
    taskId?: string;
    traceId?: string;
    workerId?: string | null;
    provider?: string;
    priority?: string | number;
    status?: TaskState;
    payload?: any;
    dependsOn?: string[];
  }): WorkerTask {
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];
    const now = new Date().toISOString();

    const taskId = data.taskId || `TASK-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const traceId = data.traceId || `TRACE-${Date.now()}`;
    const initialStatus = data.status || (data.workerId ? 'ASSIGNED' : 'QUEUED');

    const newTask: WorkerTask = {
      taskId,
      traceId,
      workerId: data.workerId || null,
      provider: data.provider || 'gemini',
      priority: data.priority !== undefined ? data.priority : 'MEDIUM',
      status: initialStatus,
      payload: data.payload || {},
      dependsOn: data.dependsOn || [],
      createdAt: now,
      updatedAt: now
    };

    tasks.unshift(newTask);
    if (tasks.length > 500) tasks.pop();
    dbRuntime.set('kccWorkerTasks', tasks);

    // If assigned to a worker, update worker currentTask & status
    if (data.workerId) {
      this.assignTaskToWorker(taskId, data.workerId);
    }

    eventBus.publish('task_created', 'MESSAGING_BUS', {
      taskId: newTask.taskId,
      traceId: newTask.traceId,
      workerId: newTask.workerId,
      status: newTask.status
    });

    return newTask;
  }

  // 4. ASSIGN TASK TO WORKER
  public assignTaskToWorker(taskId: string, workerId: string): WorkerTask | null {
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];

    const task = tasks.find(t => t.taskId === taskId);
    const worker = workers.find(w => w.workerId === workerId);

    if (!task) return null;

    task.workerId = workerId;
    task.status = 'ASSIGNED';
    task.updatedAt = new Date().toISOString();

    if (worker) {
      worker.currentTask = taskId;
      worker.status = 'BUSY';
      dbRuntime.set('kccWorkers', workers);
    }

    dbRuntime.set('kccWorkerTasks', tasks);

    eventBus.publish('task_assigned', 'MESSAGING_BUS', {
      taskId,
      workerId,
      status: task.status
    });

    return task;
  }

  // 4b. GET NEXT TASK FOR WORKER (PULL-BASED MODEL)
  public getNextTaskForWorker(workerId: string): { task: WorkerTask | null; httpStatus: number } {
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];

    let worker = workers.find(w => w.workerId === workerId);
    if (!worker) {
      return { task: null, httpStatus: 204 };
    }

    const now = new Date().toISOString();
    worker.lastHeartbeat = now;

    // Check if worker already has an active task assigned/running
    if (worker.currentTask) {
      const activeTask = tasks.find(t => t.taskId === worker.currentTask && ['ASSIGNED', 'RUNNING'].includes(t.status));
      if (activeTask) {
        dbRuntime.set('kccWorkers', workers);
        return { task: activeTask, httpStatus: 200 };
      }
    }

    // Filter QUEUED tasks whose dependencies are met
    const queuedTasks = tasks.filter(t => {
      if (t.status !== 'QUEUED') return false;
      if (t.dependsOn && t.dependsOn.length > 0) {
        const allCompleted = t.dependsOn.every(depId => {
          const depTask = tasks.find(dt => dt.taskId === depId);
          return depTask && depTask.status === 'COMPLETED';
        });
        if (!allCompleted) return false;
      }
      return true;
    });

    if (queuedTasks.length === 0) {
      worker.status = 'ONLINE';
      dbRuntime.set('kccWorkers', workers);
      return { task: null, httpStatus: 204 };
    }

    // Capability & Provider matching
    const matchingTask = queuedTasks.find(task => {
      // 1. Explicit workerId assignment
      if (task.workerId && task.workerId === worker.workerId) return true;
      if (task.workerId && task.workerId !== worker.workerId) return false;

      // 2. Capabilities matching
      const reqCaps: string[] = task.payload?.requiredCapabilities || (task.payload?.requiredCapability ? [task.payload.requiredCapability] : []);
      if (reqCaps.length > 0 && worker.capabilities && worker.capabilities.length > 0) {
        const workerCaps = worker.capabilities.map(c => c.toLowerCase());
        const matchesCap = reqCaps.some(rc => workerCaps.includes(rc.toLowerCase()));
        if (matchesCap) return true;
      }

      // 3. Provider match
      if (task.provider && worker.provider && task.provider.toLowerCase() === worker.provider.toLowerCase()) return true;

      // 4. Default fallback if no strict constraints
      if (!task.provider || task.provider === 'generic-provider' || task.provider === 'any') return true;

      return false;
    });

    if (!matchingTask) {
      worker.status = 'ONLINE';
      dbRuntime.set('kccWorkers', workers);
      return { task: null, httpStatus: 204 };
    }

    // Assign to pulling worker
    matchingTask.workerId = worker.workerId;
    matchingTask.status = 'ASSIGNED';
    matchingTask.updatedAt = now;

    worker.currentTask = matchingTask.taskId;
    worker.status = 'BUSY';

    dbRuntime.set('kccWorkers', workers);
    dbRuntime.set('kccWorkerTasks', tasks);

    eventBus.publish('task_pulled', 'WORKER_REGISTRY', {
      taskId: matchingTask.taskId,
      workerId: worker.workerId,
      provider: worker.provider
    });

    return { task: matchingTask, httpStatus: 200 };
  }

  // 5. SUBMIT TASK RESULT / UPDATE STATUS
  public submitTaskResult(data: {
    taskId: string;
    workerId?: string;
    status: TaskState; // e.g. COMPLETED, FAILED, RUNNING, VERIFYING
    result?: any;
    error?: string;
  }): WorkerTask | null {
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];

    const task = tasks.find(t => t.taskId === data.taskId);
    if (!task) return null;

    const now = new Date().toISOString();
    task.status = data.status;
    task.updatedAt = now;
    if (data.result !== undefined) task.result = data.result;
    if (data.error !== undefined) task.error = data.error;

    // Update corresponding worker state
    const targetWorkerId = data.workerId || task.workerId;
    if (targetWorkerId) {
      const worker = workers.find(w => w.workerId === targetWorkerId);
      if (worker) {
        worker.lastHeartbeat = now;
        if (['COMPLETED', 'FAILED'].includes(data.status)) {
          worker.currentTask = null;
          worker.status = 'ONLINE';
        } else if (['RUNNING', 'VERIFYING', 'ASSIGNED'].includes(data.status)) {
          worker.currentTask = task.taskId;
          worker.status = 'BUSY';
        }
        dbRuntime.set('kccWorkers', workers);
      }
    }

    // Check downstream tasks whose dependencies are now met
    const unlockedDownstream: string[] = [];
    if (data.status === 'COMPLETED') {
      for (const t of tasks) {
        if (t.dependsOn && t.dependsOn.includes(task.taskId)) {
          const allCompleted = t.dependsOn.every(depId => {
            const dt = tasks.find(x => x.taskId === depId);
            return dt && dt.status === 'COMPLETED';
          });
          if (allCompleted && ['WAITING', 'QUEUED'].includes(t.status)) {
            t.status = 'QUEUED';
            t.updatedAt = now;
            unlockedDownstream.push(t.taskId);
          }
        }
      }
    }

    dbRuntime.set('kccWorkers', workers);
    dbRuntime.set('kccWorkerTasks', tasks);

    eventBus.publish('task_result_submitted', 'MESSAGING_BUS', {
      taskId: task.taskId,
      status: task.status,
      workerId: targetWorkerId,
      unlockedDownstream
    });

    const resTask = task as any;
    resTask.unlockedDownstream = unlockedDownstream;

    return resTask as WorkerTask;
  }

  // 6. CHECK WORKER TIMEOUTS (>60 SECONDS NO HEARTBEAT)
  public killWorker(workerId: string): { killed: boolean; requeuedTaskId?: string } {
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];

    const worker = workers.find(w => w.workerId === workerId);
    if (!worker) return { killed: false };

    worker.status = 'OFFLINE';
    worker.lastHeartbeat = new Date(Date.now() - 70000).toISOString(); // 70s ago
    const timedOutTaskId = worker.currentTask;
    worker.currentTask = null;

    let requeuedTaskId: string | undefined;

    if (timedOutTaskId) {
      const task = tasks.find(t => t.taskId === timedOutTaskId);
      if (task && ['ASSIGNED', 'RUNNING', 'VERIFYING'].includes(task.status)) {
        task.status = 'QUEUED';
        task.workerId = null;
        task.updatedAt = new Date().toISOString();
        requeuedTaskId = task.taskId;
        console.log(`[WorkerRegistry] 🔄 Task '${task.taskId}' returned to QUEUED due to worker '${workerId}' killed.`);
      }
    }

    dbRuntime.set('kccWorkers', workers);
    dbRuntime.set('kccWorkerTasks', tasks);

    eventBus.publish('worker_killed', 'WORKER_REGISTRY', {
      workerId,
      requeuedTaskId
    });

    return { killed: true, requeuedTaskId };
  }

  public checkWorkerTimeouts() {
    const workers = (dbRuntime.get('kccWorkers') || []) as WorkerNode[];
    const tasks = (dbRuntime.get('kccWorkerTasks') || []) as WorkerTask[];
    const now = Date.now();
    let updated = false;

    for (const worker of workers) {
      if (worker.status === 'OFFLINE') continue;

      const lastHbTime = new Date(worker.lastHeartbeat).getTime();
      const diffSec = (now - lastHbTime) / 1000;

      if (diffSec > 60) {
        console.warn(`[WorkerRegistry] ⚠️ Worker '${worker.workerId}' timed out (${Math.round(diffSec)}s since heartbeat). Marking OFFLINE.`);
        worker.status = 'OFFLINE';
        const timedOutTaskId = worker.currentTask;
        worker.currentTask = null;
        updated = true;

        // Return assigned/running/verifying task back to QUEUED automatically
        if (timedOutTaskId) {
          const task = tasks.find(t => t.taskId === timedOutTaskId);
          if (task && ['ASSIGNED', 'RUNNING', 'VERIFYING'].includes(task.status)) {
            task.status = 'QUEUED';
            task.workerId = null;
            task.updatedAt = new Date().toISOString();
            console.log(`[WorkerRegistry] 🔄 Task '${task.taskId}' returned to QUEUED due to worker timeout.`);

            eventBus.publish('task_requeued_timeout', 'MESSAGING_BUS', {
              taskId: task.taskId,
              previousWorkerId: worker.workerId
            });
          }
        }

        eventBus.publish('worker_offline_timeout', 'WORKER_REGISTRY', {
          workerId: worker.workerId,
          inactiveSeconds: Math.round(diffSec)
        });
      }
    }

    if (updated) {
      dbRuntime.set('kccWorkers', workers);
      dbRuntime.set('kccWorkerTasks', tasks);
    }
  }

  // 7. GET ALL WORKERS (Runs timeout check first)
  public getWorkers(): WorkerNode[] {
    this.checkWorkerTimeouts();
    return dbRuntime.get('kccWorkers') || [];
  }

  // 8. GET ALL TASKS
  public getTasks(): WorkerTask[] {
    return dbRuntime.get('kccWorkerTasks') || [];
  }
}

export const workerRegistryManager = new WorkerRegistryManager();
