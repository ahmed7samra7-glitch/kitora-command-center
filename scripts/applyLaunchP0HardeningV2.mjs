import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value, 'utf8'); }
function replaceRequired(text, pattern, replacement, label) {
  if (!text.includes(pattern)) throw new Error(`Patch anchor not found: ${label}`);
  return text.replace(pattern, replacement);
}
function replaceOptional(text, pattern, replacement) {
  return text.includes(pattern) ? text.replace(pattern, replacement) : text;
}

let mission = read('server/kccMissionLoop.ts');
if (!mission.includes('executeMissionTick(')) {
  mission = replaceRequired(
    mission,
    '  public async tick() {',
    "  public async executeMissionTick(maxMissions: number = Number.parseInt(process.env.MISSION_TICK_MAX_MISSIONS || '3', 10)) {\n    const limit = Number.isFinite(maxMissions) && maxMissions > 0 ? Math.min(Math.floor(maxMissions), 10) : 3;\n    return this.tick(limit);\n  }\n\n  public async tick(maxMissions: number = 10) {",
    'explicit mission tick'
  );
}
if (!mission.includes('.slice(0, Math.max(1, Math.min(maxMissions, 10)))')) {
  const tickStart = mission.indexOf('  public async tick(maxMissions: number = 10) {');
  const anchor = "    const activeMissions = missions.filter(m => m.status === 'PLANNING' || m.status === 'ACTIVE');";
  const activeIndex = mission.indexOf(anchor, tickStart);
  if (tickStart < 0 || activeIndex < 0) throw new Error('Patch anchor not found: bounded mission selection');
  mission = mission.slice(0, activeIndex) + "    const activeMissions = missions.filter(m => m.status === 'PLANNING' || m.status === 'ACTIVE').slice(0, Math.max(1, Math.min(maxMissions, 10)));" + mission.slice(activeIndex + anchor.length);
}
if (!mission.includes("Continuous loop disabled; use executeMissionTick()")) {
  mission = replaceRequired(
    mission,
    '    this.intervalId = setInterval(() => {',
    "    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isRunning = false;\n      console.log('[KCC Mission Loop] Continuous loop disabled; use executeMissionTick() via external trigger.');\n      return;\n    }\n\n    this.intervalId = setInterval(() => {",
    'mission loop feature flag'
  );
}
write('server/kccMissionLoop.ts', mission);

let runtime = read('server/autonomousAgentRuntime.ts');
if (!runtime.includes("import { durableTaskQueue } from './durableTaskQueue.js';")) {
  runtime = replaceRequired(
    runtime,
    "import { kccBrain } from './kccBrain.js';",
    "import { kccBrain } from './kccBrain.js';\nimport { durableTaskQueue } from './durableTaskQueue.js';",
    'durable task queue import'
  );
}
if (!runtime.includes('processQueueBatch(')) {
  runtime = replaceRequired(
    runtime,
    '  private async processNextQueueTask() {',
    "  public async processQueueBatch(maxTasks: number = Number.parseInt(process.env.AGENT_QUEUE_BATCH_SIZE || '3', 10)) {\n    const limit = Number.isFinite(maxTasks) && maxTasks > 0 ? Math.min(Math.floor(maxTasks), 10) : 3;\n    if ((process.env.STORAGE_DRIVER || 'local').trim().toLowerCase() === 'supabase') {\n      return this.processDurableQueueBatch(limit);\n    }\n    let processed = 0;\n    while (processed < limit) {\n      const before = this.queue.find(t => t.status === 'QUEUED');\n      if (!before) break;\n      await this.processNextQueueTask();\n      processed += 1;\n    }\n    return {\n      processed,\n      queued: this.queue.filter(t => t.status === 'QUEUED').length,\n      running: this.queue.filter(t => t.status === 'RUNNING').length,\n      completed: this.queue.filter(t => t.status === 'COMPLETED').length,\n      failed: this.queue.filter(t => t.status === 'FAILED').length\n    };\n  }\n\n  private async processDurableQueueBatch(limit: number) {\n    const claimed = await durableTaskQueue.claimBatch(limit);\n    let completed = 0;\n    let failed = 0;\n    for (const rawTask of claimed) {\n      const task = rawTask as AgentTask;\n      try {\n        const provider = await this.executeTaskLogic(task);\n        await durableTaskQueue.complete(task.id, task.result ?? { status: 'COMPLETED' }, provider);\n        completed += 1;\n        eventBus.publish('AGENT.TASK.COMPLETED', 'AutonomousAgentRuntime', { taskId: task.id, type: task.type, provider });\n      } catch (err: any) {\n        const retry = task.attempts < task.maxRetries;\n        await durableTaskQueue.fail(task.id, err?.message || 'Execution failed', retry);\n        failed += 1;\n        eventBus.publish('AGENT.TASK.FAILED', 'AutonomousAgentRuntime', { taskId: task.id, type: task.type, error: err?.message });\n      }\n    }\n    return { processed: claimed.length, completed, failed, queued: 0, running: 0 };\n  }\n\n  private async processNextQueueTask() {",
    'queue batch API'
  );
}
if (!runtime.includes('durableTaskQueue.enqueue(task)')) {
  runtime = replaceRequired(
    runtime,
    '    eventBus.publish(\'AGENT.TASK.QUEUED\', \'AutonomousAgentRuntime\', { taskId: task.id, type: task.type });',
    "    void durableTaskQueue.enqueue(task).catch((err) => console.error('[Durable Queue] enqueue failed:', err?.message || err));\n    eventBus.publish('AGENT.TASK.QUEUED', 'AutonomousAgentRuntime', { taskId: task.id, type: task.type });",
    'durable queue enqueue'
  );
}
if (!runtime.includes("Continuous loop disabled; use processQueueBatch()")) {
  runtime = replaceRequired(
    runtime,
    '    // Start background processing loop (runs every 3 seconds)\n    this.isLoopRunning = true;',
    "    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isLoopRunning = false;\n      console.log('[Autonomous Runtime] Continuous loop disabled; use processQueueBatch() via external trigger.');\n      return;\n    }\n\n    this.isLoopRunning = true;",
    'runtime loop feature flag'
  );
}
write('server/autonomousAgentRuntime.ts', runtime);

let server = read('server.ts');
server = replaceOptional(server, "    path.startsWith('/api/phase4/store/order') ||\n", '');
if (!server.includes('function requireExecutionSecret(')) {
  server = replaceRequired(
    server,
    'export function verifyWorkerAuth(req: Request): { valid: boolean; workerId?: string; error?: string } {',
    "function requireExecutionSecret(req: Request, res: Response, next: Function) {\n  const configured = (process.env.KCC_EXECUTION_SECRET || '').trim();\n  const provided = String(req.headers['x-kcc-execution-secret'] || '').trim();\n  if (!configured) return res.status(503).json({ success: false, error: 'Execution trigger is not configured.' });\n  if (!provided || provided !== configured) return res.status(401).json({ success: false, error: 'Unauthorized execution trigger.' });\n  next();\n}\n\nexport function verifyWorkerAuth(req: Request): { valid: boolean; workerId?: string; error?: string } {",
    'execution secret middleware'
  );
}
if (!server.includes("app.post('/api/kcc/loop/tick'")) {
  server = replaceRequired(
    server,
    "app.post('/api/kcc/events', async (req, res) => {",
    "app.post('/api/kcc/loop/tick', requireExecutionSecret, async (req, res) => {\n  try {\n    const limit = Number(req.body?.maxMissions) || undefined;\n    const result = await kccMissionLoop.executeMissionTick(limit);\n    res.json({ success: true, mode: 'BATCH', result });\n  } catch (err) {\n    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });\n  }\n});\n\napp.post('/api/kcc/agent/process-queue', requireExecutionSecret, async (req, res) => {\n  try {\n    const limit = Number(req.body?.maxTasks) || undefined;\n    const result = await autonomousAgentRuntime.processQueueBatch(limit);\n    res.json({ success: true, mode: 'BATCH', result });\n  } catch (err) {\n    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });\n  }\n});\n\napp.post('/api/kcc/events', async (req, res) => {",
    'batch endpoints'
  );
}
if (!server.includes("if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') {\n    try { autonomousAgentRuntime.start();")) {
  const oldBoot = "  // Boot 24/7 Zero-Touch Autonomous Agent Runtime & Async Remote AI Worker Daemons\n  try {\n    autonomousAgentRuntime.start();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr);\n  }\n\n  try {\n    asyncWorkerManager.initializeDefaultWorkers();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr);\n  }\n\n  try {\n    kccMissionLoop.startLoop(3000);\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr);\n  }";
  server = replaceRequired(
    server,
    oldBoot,
    "  if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') {\n    try { autonomousAgentRuntime.start(); } catch (bootErr) { console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr); }\n    try { asyncWorkerManager.initializeDefaultWorkers(); } catch (bootErr) { console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr); }\n    try { kccMissionLoop.startLoop(3000); } catch (bootErr) { console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr); }\n  } else {\n    console.log('[KCC Core Runtime] Continuous execution disabled; using scale-to-zero batch triggers.');\n  }",
    'boot loop gating'
  );
}
write('server.ts', server);

console.log('KCC P0 hardening v2 applied.');
