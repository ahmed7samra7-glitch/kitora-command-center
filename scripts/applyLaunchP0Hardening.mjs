import fs from 'node:fs';

const serverPath = 'server.ts';
const missionLoopPath = 'server/kccMissionLoop.ts';
const dbPath = 'server/dbStorage.ts';
const runtimePath = 'server/autonomousAgentRuntime.ts';
const schedulerPath = 'server/scheduler.ts';
const envPath = '.env.example';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value, 'utf8'); }
function replaceOnce(text, pattern, replacement, label) {
  const next = text.replace(pattern, replacement);
  if (next === text) throw new Error(`Patch anchor not found: ${label}`);
  return next;
}

let db = read(dbPath);
db = replaceOnce(db, "const DB_FILE = path.join(DATA_DIR, 'db.json');", "const DB_FILE = path.join(DATA_DIR, 'db.json');\nconst STORAGE_DRIVER = (process.env.STORAGE_DRIVER || 'local').trim().toLowerCase();\n\nif (process.env.NODE_ENV === 'production' && STORAGE_DRIVER === 'local') {\n  throw new Error('SECURITY FATAL: STORAGE_DRIVER=local is not permitted in production. Configure a durable production storage driver before launch.');\n}\n", 'production storage guard');
db = replaceOnce(db, "storage: DB_FILE,", "storage: STORAGE_DRIVER === 'local' ? DB_FILE : STORAGE_DRIVER,\n      driver: STORAGE_DRIVER,", 'storage status metadata');
write(dbPath, db);

let mission = read(missionLoopPath);
mission = replaceOnce(mission, "  public async tick() {", "  public async executeMissionTick(maxMissions: number = Number.parseInt(process.env.MISSION_TICK_MAX_MISSIONS || '3', 10)) {\n    const limit = Number.isFinite(maxMissions) && maxMissions > 0 ? Math.min(Math.floor(maxMissions), 10) : 3;\n    return this.tick(limit);\n  }\n\n  public async tick(maxMissions: number = 10) {", 'explicit mission tick');
const tickStart = mission.indexOf("  public async tick(maxMissions: number = 10) {");
const tickActiveAnchor = "    const activeMissions = missions.filter(m => m.status === 'PLANNING' || m.status === 'ACTIVE');";
const tickActiveIndex = mission.indexOf(tickActiveAnchor, tickStart);
if (tickStart < 0 || tickActiveIndex < 0) throw new Error('Patch anchor not found: bounded mission selection in tick');
mission = mission.slice(0, tickActiveIndex) + "    const activeMissions = missions.filter(m => m.status === 'PLANNING' || m.status === 'ACTIVE').slice(0, Math.max(1, Math.min(maxMissions, 10)));" + mission.slice(tickActiveIndex + tickActiveAnchor.length);
mission = replaceOnce(mission, "    this.intervalId = setInterval(() => {", "    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isRunning = false;\n      console.log('[KCC Mission Loop] Continuous loop disabled; use executeMissionTick() via external trigger.');\n      return;\n    }\n\n    this.intervalId = setInterval(() => {", 'mission loop feature flag');
write(missionLoopPath, mission);

let runtime = read(runtimePath);
runtime = replaceOnce(runtime, "  private async processNextQueueTask() {", "  public async processQueueBatch(maxTasks: number = Number.parseInt(process.env.AGENT_QUEUE_BATCH_SIZE || '3', 10)) {\n    const limit = Number.isFinite(maxTasks) && maxTasks > 0 ? Math.min(Math.floor(maxTasks), 10) : 3;\n    let processed = 0;\n    while (processed < limit) {\n      const before = this.queue.find(t => t.status === 'QUEUED');\n      if (!before) break;\n      await this.processNextQueueTask();\n      processed += 1;\n    }\n    return {\n      processed,\n      queued: this.queue.filter(t => t.status === 'QUEUED').length,\n      running: this.queue.filter(t => t.status === 'RUNNING').length,\n      completed: this.queue.filter(t => t.status === 'COMPLETED').length,\n      failed: this.queue.filter(t => t.status === 'FAILED').length\n    };\n  }\n\n  private async processNextQueueTask() {", 'explicit queue batch API');
runtime = replaceOnce(runtime, "    // Start background processing loop (runs every 3 seconds)\n    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);", "    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isLoopRunning = false;\n      console.log('[Autonomous Runtime] Continuous loop disabled; use processQueueBatch() via external trigger.');\n      return;\n    }\n\n    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);", 'agent runtime feature flag');
write(runtimePath, runtime);

let scheduler = read(schedulerPath);
scheduler = replaceOnce(scheduler, "    this.startLoop();", "    if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') this.startLoop();", 'scheduler boot gating');
write(schedulerPath, scheduler);

let server = read(serverPath);
server = replaceOnce(server, "    path.startsWith('/api/phase4/store/catalog') ||\n    path.startsWith('/api/phase4/store/order') ||", "    path.startsWith('/api/phase4/store/catalog') ||", 'protect store order mutation');
server = replaceOnce(server, "export function verifyWorkerAuth(req: Request): { valid: boolean; workerId?: string; error?: string } {", "function requireExecutionSecret(req: Request, res: Response, next: Function) {\n  const configured = (process.env.KCC_EXECUTION_SECRET || '').trim();\n  const provided = String(req.headers['x-kcc-execution-secret'] || '').trim();\n  if (!configured) return res.status(503).json({ success: false, error: 'Execution trigger is not configured.' });\n  if (!provided || provided !== configured) return res.status(401).json({ success: false, error: 'Unauthorized execution trigger.' });\n  next();\n}\n\nexport function verifyWorkerAuth(req: Request): { valid: boolean; workerId?: string; error?: string } {", 'execution secret middleware');
server = replaceOnce(server, "app.post('/api/kcc/events', async (req, res) => {", "app.post('/api/kcc/loop/tick', requireExecutionSecret, async (req, res) => {\n  try {\n    const limit = Number(req.body?.maxMissions) || undefined;\n    const result = await kccMissionLoop.executeMissionTick(limit);\n    res.json({ success: true, mode: 'BATCH', result });\n  } catch (err) {\n    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });\n  }\n});\n\napp.post('/api/kcc/agent/process-queue', requireExecutionSecret, async (req, res) => {\n  try {\n    const limit = Number(req.body?.maxTasks) || undefined;\n    const result = await autonomousAgentRuntime.processQueueBatch(limit);\n    res.json({ success: true, mode: 'BATCH', result });\n  } catch (err) {\n    res.status(500).json({ success: false, error: err instanceof Error ? err.message : String(err) });\n  }\n});\n\napp.post('/api/kcc/events', async (req, res) => {", 'batch execution endpoints');
server = replaceOnce(server, "  // Boot 24/7 Zero-Touch Autonomous Agent Runtime & Async Remote AI Worker Daemons\n  try {\n    autonomousAgentRuntime.start();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr);\n  }\n\n  try {\n    asyncWorkerManager.initializeDefaultWorkers();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr);\n  }\n\n  try {\n    kccMissionLoop.startLoop(3000);\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr);\n  }", "  // Production boot is HTTP/API-only by default. Continuous workers require explicit opt-in.\n  if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') {\n    try { autonomousAgentRuntime.start(); } catch (bootErr) { console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr); }\n    try { asyncWorkerManager.initializeDefaultWorkers(); } catch (bootErr) { console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr); }\n    try { kccMissionLoop.startLoop(3000); } catch (bootErr) { console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr); }\n  } else {\n    console.log('[KCC Core Runtime] Continuous execution disabled; using scale-to-zero batch triggers.');\n  }", 'boot loop gating');
write(serverPath, server);

let env = read(envPath);
if (!env.includes('STORAGE_DRIVER=')) env += '\n# Production must use a durable storage driver; local is development/test only.\nSTORAGE_DRIVER="local"\n';
if (!env.includes('ENABLE_CONTINUOUS_LOOP=')) env += '\n# Production default: false. Set true only for controlled long-running environments.\nENABLE_CONTINUOUS_LOOP="false"\n';
if (!env.includes('MISSION_TICK_MAX_MISSIONS=')) env += '\nMISSION_TICK_MAX_MISSIONS="3"\n';
if (!env.includes('AGENT_QUEUE_BATCH_SIZE=')) env += '\nAGENT_QUEUE_BATCH_SIZE="3"\n';
if (!env.includes('KCC_EXECUTION_SECRET=')) env += '\n# Secret used by trusted external execution triggers. Never expose publicly.\nKCC_EXECUTION_SECRET=""\n';
write(envPath, env);

console.log('KCC P0 hardening patch applied successfully.');
