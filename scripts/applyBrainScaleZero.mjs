import fs from 'node:fs';

const CHECK_ONLY = process.argv.includes('--check');

function countOccurrences(text, needle) {
  return needle === '' ? 0 : text.split(needle).length - 1;
}

function patch(file, anchor, replacement, label) {
  const text = fs.readFileSync(file, 'utf8');

  if (text.includes(replacement)) {
    console.log(`[KCC Brain patch] ${label}: already applied.`);
    return false;
  }

  const occurrences = countOccurrences(text, anchor);
  if (occurrences !== 1) {
    throw new Error(
      `[KCC Brain patch] ${label}: expected exactly one patch anchor, found ${occurrences}. Refusing ambiguous mutation.`,
    );
  }

  if (CHECK_ONLY) {
    throw new Error(`[KCC Brain patch] ${label}: patch is required but --check forbids mutations.`);
  }

  fs.writeFileSync(file, text.replace(anchor, replacement), 'utf8');
  console.log(`[KCC Brain patch] ${label}: applied.`);
  return true;
}

const changes = [
  {
    file: 'server.ts',
    anchor: `  // Boot 24/7 Zero-Touch Autonomous Agent Runtime & Async Remote AI Worker Daemons\n  try {\n    autonomousAgentRuntime.start();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr);\n  }\n\n  try {\n    asyncWorkerManager.initializeDefaultWorkers();\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr);\n  }\n\n  try {\n    kccMissionLoop.startLoop(3000);\n  } catch (bootErr) {\n    console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr);\n  }`,
    replacement: `  // KCC Brain is logically continuous and stateful 24/7; compute workers are opt-in daemons.\n  if (process.env.ENABLE_CONTINUOUS_LOOP === 'true') {\n    try { autonomousAgentRuntime.start(); } catch (bootErr) { console.error('[KCC Core Runtime] autonomousAgentRuntime boot warning:', bootErr); }\n    try { asyncWorkerManager.initializeDefaultWorkers(); } catch (bootErr) { console.error('[KCC Core Runtime] asyncWorkerManager boot warning:', bootErr); }\n    try { kccMissionLoop.startLoop(3000); } catch (bootErr) { console.error('[KCC Core Runtime] kccMissionLoop boot warning:', bootErr); }\n  } else {\n    console.log('[KCC Core Runtime] Brain OS remains persistent through durable state; execution workers are batch/event-driven.');\n  }`,
    label: 'server continuous boot',
  },
  {
    file: 'server/kccMissionLoop.ts',
    anchor: `    this.isRunning = true;\n\n    console.log('[KCC Mission Loop] Starting Autonomous Business Operating Loop (Observe -> Think -> Plan -> Execute -> Verify -> Learn)...');`,
    replacement: `    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isRunning = false;\n      console.log('[KCC Mission Loop] Continuous daemon disabled; executeMissionTick() is the scale-to-zero execution path.');\n      return;\n    }\n\n    this.isRunning = true;\n\n    console.log('[KCC Mission Loop] Starting Autonomous Business Operating Loop (Observe -> Think -> Plan -> Execute -> Verify -> Learn)...');`,
    label: 'mission loop guard',
  },
  {
    file: 'server/autonomousAgentRuntime.ts',
    anchor: `    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);`,
    replacement: `    if (process.env.ENABLE_CONTINUOUS_LOOP !== 'true') {\n      this.isLoopRunning = false;\n      console.log('[Autonomous Runtime] Continuous daemon disabled; processQueueBatch() is the scale-to-zero execution path.');\n      return;\n    }\n\n    this.isLoopRunning = true;\n    this.loopTimer = setInterval(() => this.processNextQueueTask(), 3000);`,
    label: 'agent runtime guard',
  },
  {
    file: 'server.ts',
    anchor: `  if (dbStatus.status !== 'CONNECTED') {\n    overallStatus = 'UNHEALTHY';\n  } else if (\n    agentRuntimeStatus !== 'RUNNING' ||\n    workerManagerStatus !== 'ACTIVE' ||\n    missionLoopStatus !== 'RUNNING' ||\n    aiOverallStatus !== 'ONLINE'\n  ) {\n    overallStatus = 'DEGRADED';\n  }`,
    replacement: `  const continuousLoopEnabled = process.env.ENABLE_CONTINUOUS_LOOP === 'true';\n\n  if (dbStatus.status !== 'CONNECTED') {\n    overallStatus = 'UNHEALTHY';\n  } else if (aiOverallStatus !== 'ONLINE') {\n    overallStatus = 'DEGRADED';\n  } else if (continuousLoopEnabled && (\n    agentRuntimeStatus !== 'RUNNING' ||\n    workerManagerStatus !== 'ACTIVE' ||\n    missionLoopStatus !== 'RUNNING'\n  )) {\n    overallStatus = 'DEGRADED';\n  }`,
    label: 'scale-zero health status',
  },
];

let applied = 0;
for (const change of changes) {
  if (patch(change.file, change.anchor, change.replacement, change.label)) applied += 1;
}

if (CHECK_ONLY) {
  console.log('[KCC Brain patch] Check completed: all requested guards are already present.');
} else {
  console.log(`[KCC Brain patch] Completed safely; ${applied} mutation(s) applied.`);
}
