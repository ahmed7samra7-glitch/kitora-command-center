import fs from 'node:fs';

function patch(file, anchor, replacement, label) {
  const text = fs.readFileSync(file, 'utf8');
  if (!text.includes(anchor)) throw new Error(`Patch anchor not found: ${label}`);
  fs.writeFileSync(file, text.replace(anchor, replacement), 'utf8');
}

patch(
  'server.ts',
  `  // Boot 24/7 Zero-Touch Autonomous Agent Runtime & Async Remote AI Worker Daemons\n  try {\n    autonomousAgentRuntime.start();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr);\n  }\n\n  try {\n    asyncWorkerManager.initializeDefaultWorkers();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr);\n  }\n\n  try {\n    kccMissionLoop.startLoop(3000);\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr);\n  }`,
  `  // KCC Brain is logically continuous and stateful 24/7; compute workers are opt-in daemons.\n  if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') {\n    try { autonomousAgentRuntime.start(); } catch (bootErr) { console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr); }\n    try { asyncWorkerManager.initializeDefaultWorkers(); } catch (bootErr) { console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr); }\n    try { kccMissionLoop.startLoop(3000); } catch (bootErr) { console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr); }\n  } else {\n    console.log('[KCC Core Runtime] Brain OS remains persistent through durable state; execution workers are batch/event-driven.');\n  }`,
  'server continuous boot'
);

patch(
  'server/kccMissionLoop.ts',
  `  public startLoop(intervalMs = 10000) {`,
  `  public startLoop(intervalMs = 10000) {`,
  'mission start anchor'
);

patch(
  'server/kccMissionLoop.ts',
  `    this.isRunning = true;\n\n    console.log('[KCC Mission Loop] Starting Autonomous Business Operating Loop (Observe -> Think -> Plan -> Execute -> Verify -> Learn)...');`,
  `    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isRunning = false;\n      console.log('[KCC Mission Loop] Continuous daemon disabled; executeMissionTick() is the scale-to-zero execution path.');\n      return;\n    }\n\n    this.isRunning = true;\n\n    console.log('[KCC Mission Loop] Starting Autonomous Business Operating Loop (Observe -> Think -> Plan -> Execute -> Verify -> Learn)...');`,
  'mission loop guard'
);

patch(
  'server/autonomousAgentRuntime.ts',
  `    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);`,
  `    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isLoopRunning = false;\n      console.log('[Autonomous Runtime] Continuous daemon disabled; processQueueBatch() is the scale-to-zero execution path.');\n      return;\n    }\n\n    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);`,
  'agent runtime guard'
);

console.log('KCC Brain scale-to-zero runtime patch applied.');
