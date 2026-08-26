import { spawn } from 'node:child_process';

const port = 3217;
const child = spawn(process.execPath, ['dist/server.cjs'], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: String(port),
    META_WHATSAPP_WEBHOOK_VERIFY_TOKEN: '',
    META_WHATSAPP_APP_SECRET: '',
    META_WHATSAPP_LIVE_BEARER_TOKEN: '',
    META_WHATSAPP_PHONE_NUMBER_ID: '',
    KCC_WORKER_SECRET: 'runtime-verification-worker-secret',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
});

let output = '';
child.stdout.on('data', (chunk) => { output += chunk.toString(); });
child.stderr.on('data', (chunk) => { output += chunk.toString(); });

async function waitForHealth(timeoutMs = 15000): Promise<Response> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      return await fetch(`http://127.0.0.1:${port}/api/health`);
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }
  throw new Error(`server did not become reachable within ${timeoutMs}ms\n${output}`);
}

async function main() {
  try {
    const health = await waitForHealth();
    if (health.status !== 200) {
      throw new Error(`expected degraded-but-live health to remain HTTP 200, received ${health.status}`);
    }
    const healthPayload = await health.json() as { status?: string; productionReadiness?: { kccAlive?: boolean } };
    if (healthPayload.productionReadiness?.kccAlive !== false) {
      throw new Error('expected KCC ALIVE to remain false without real fulfillment and WhatsApp evidence');
    }

    const live = await fetch(`http://127.0.0.1:${port}/api/live`);
    if (live.status !== 200) {
      throw new Error(`expected process liveness status 200, received ${live.status}`);
    }
    const livePayload = await live.json() as { status?: string };
    if (livePayload.status !== 'LIVE') {
      throw new Error(`unexpected liveness payload ${JSON.stringify(livePayload)}`);
    }

    const webhook = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=bad&hub.challenge=test`);
    if (webhook.status !== 503 && webhook.status !== 403) {
      throw new Error(`unexpected webhook verification status ${webhook.status}`);
    }

    const unsignedWebhook = await fetch(`http://127.0.0.1:${port}/api/whatsapp/webhook`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ entry: [] }),
    });
    if (![400, 401, 503].includes(unsignedWebhook.status)) {
      throw new Error(`unexpected unsigned webhook status ${unsignedWebhook.status}`);
    }

    console.log('Server entrypoint runtime verification: PASS');
  } finally {
    child.kill('SIGTERM');
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        child.kill('SIGKILL');
        resolve();
      }, 3000);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

void main().catch((error) => {
  console.error(error);
  console.error(output);
  process.exit(1);
});
