import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`P0 SMOKE FAIL: ${message}`);
}

const repoRoot = process.cwd();
const dbFile = path.join(repoRoot, 'data', 'db.json');
const originalDb = fs.existsSync(dbFile) ? fs.readFileSync(dbFile, 'utf8') : null;

try {
  // 1. Production must fail closed when local storage is selected.
  const productionGuard = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['tsx', '-e', "await import('./server/dbStorage.ts')"],
    {
      cwd: repoRoot,
      env: { ...process.env, NODE_ENV: 'production', STORAGE_DRIVER: 'local' },
      encoding: 'utf8'
    }
  );
  const productionOutput = `${productionGuard.stdout || ''}\n${productionGuard.stderr || ''}`;
  assert(productionGuard.status !== 0, 'local storage was allowed in production');
  assert(
    /STORAGE_DRIVER=local.*not permitted in production|SECURITY FATAL.*STORAGE_DRIVER=local/i.test(productionOutput),
    'production storage guard did not emit the expected fail-closed signal'
  );

  // 2. Continuous mission/runtime mode must remain disabled by default.
  process.env.NODE_ENV = 'test';
  process.env.STORAGE_DRIVER = 'local';
  process.env.ENABLE_CONTINUOUS_LOOP = 'false';

  const { kccMissionLoop } = await import('../server/kccMissionLoop.js');
  kccMissionLoop.startLoop();
  assert(kccMissionLoop.getStatus().isRunning === false, 'mission loop started while ENABLE_CONTINUOUS_LOOP=false');

  const { autonomousAgentRuntime } = await import('../server/autonomousAgentRuntime.js');
  autonomousAgentRuntime.start();
  assert(autonomousAgentRuntime.getStatus().isAlive === false, 'agent runtime started while ENABLE_CONTINUOUS_LOOP=false');

  // 3. PayPal webhook event IDs must be idempotent.
  const { payPalRuntime } = await import('../server/paypal.js');
  const event = {
    id: 'P0-SMOKE-EVENT-001',
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'P0-SMOKE-ORDER-001' }
  };

  const first = await payPalRuntime.processWebhook({}, event);
  const second = await payPalRuntime.processWebhook({}, event);
  assert(first.processed === true && first.duplicate === false, 'first webhook event was not processed');
  assert(second.processed === false && second.duplicate === true, 'duplicate webhook event was not suppressed');

  console.log('P0 SMOKE PASS: production storage guard, loop guard, and webhook idempotency.');
} finally {
  if (originalDb === null) {
    try { fs.unlinkSync(dbFile); } catch {}
  } else {
    fs.writeFileSync(dbFile, originalDb, 'utf8');
  }
}
