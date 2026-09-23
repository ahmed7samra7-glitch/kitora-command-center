import {
  collaborateWithA2AWorker,
  discoverPublicAiWorkers,
  rankWorkersForGoal,
  sanitizeDelegationText,
  scoutAiWorkerEcosystem
} from '../server/cloudflareWorkerDiscovery.js';

const originalFetch = globalThis.fetch;
let calls: string[] = [];

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  calls.push(url);
  if (url.startsWith('https://api.a2a-registry.org/public/agents')) {
    return new Response(JSON.stringify({
      agents: [
        {
          identifier: 'worker.research',
          name: 'Research Worker',
          provider: 'Example',
          description: 'Specialist research agent for ecommerce and market analysis',
          protocol: 'A2A',
          endpoint: 'https://example.com/a2a',
          skills: ['research', 'market-analysis']
        },
        {
          identifier: 'worker.copy',
          name: 'Copy Worker',
          provider: 'Example',
          description: 'Marketing copy agent',
          protocol: 'A2A',
          endpoint: 'https://copy.example.com/a2a',
          capabilities: ['marketing', 'copywriting']
        }
      ]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('Unexpected URL in discovery verification');
}) as typeof globalThis.fetch;

try {
  const workers = await discoverPublicAiWorkers('ecommerce market research');
  if (workers.length !== 2) throw new Error('Expected two discovered workers.');
  if (workers[0].protocol !== 'A2A' || workers[0].connectionState !== 'DISCOVERED') {
    throw new Error('Expected an A2A discovered worker with DISCOVERED state.');
  }
  const ranked = rankWorkersForGoal(workers, 'ecommerce market analysis', 1);
  if (ranked.length !== 1 || ranked[0].workerId !== workers[0].workerId) {
    throw new Error('Expected capability-overlap ranking to select the relevant worker.');
  }
  if (calls.length !== 1) throw new Error('Expected exactly one public discovery request.');
} finally {
  globalThis.fetch = originalFetch;
}


// Delegation privacy firewall must reject credential-like material.
let privacyBlocked = false;
try {
  sanitizeDelegationText('Use api_key=SECRET_VALUE to continue', 4000);
} catch (error) {
  privacyBlocked = String(error).includes('WORKER_DELEGATION_SENSITIVE_DATA_BLOCKED');
}
if (!privacyBlocked) throw new Error('Expected sensitive delegation text to be blocked.');

let repairTurns = 0;
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = String(input);
  calls.push(url);
  if (url.includes('/.well-known/agent-card.json')) {
    return new Response(JSON.stringify({
      name: 'Repair Worker',
      version: '1.0.0',
      url: 'https://worker.example/a2a',
      capabilities: [{ name: 'research', description: 'research' }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url === 'https://worker.example/a2a') {
    repairTurns += 1;
    return new Response(JSON.stringify({
      result: {
        message: {
          parts: repairTurns === 1 ? [{ text: 'short' }] : [{ text: 'Evidence: verified research result with enough detail to satisfy the requested criteria.' }]
        }
      }
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('Unexpected URL in collaboration verification');
}) as typeof globalThis.fetch;

try {
  const result = await collaborateWithA2AWorker(
    {
      workerId: 'A2A:repair-worker',
      name: 'Repair Worker',
      provider: 'test',
      description: 'test',
      protocol: 'A2A',
      endpoint: 'https://worker.example/a2a',
      capabilities: ['research'],
      connectionState: 'DISCOVERED',
      discoveredAt: new Date().toISOString(),
      lastCheckedAt: new Date().toISOString(),
      source: 'test'
    },
    {
      workerId: 'A2A:repair-worker',
      task: 'Research verified market evidence.',
      successCriteria: 'Return at least one evidence-backed finding.'
    },
    'TRACE-TEST'
  );
  if (result.status !== 'COMPLETED' || repairTurns !== 2) {
    throw new Error('Expected one initial A2A turn plus one bounded repair turn.');
  }
} finally {
  globalThis.fetch = originalFetch;
}


let scoutCalls = 0;
globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.startsWith('https://api.a2a-registry.org/public/agents')) {
    scoutCalls += 1;
    const q = new URL(url).searchParams.get('q') || '';
    return new Response(JSON.stringify({
      agents: [{
        identifier: q.includes('coding') ? 'shared.worker' : `worker.${scoutCalls}`,
        name: q.includes('coding') ? 'Shared Worker' : `Scout Worker ${scoutCalls}`,
        provider: 'Example',
        description: q,
        protocol: 'A2A',
        endpoint: `https://scout-${scoutCalls}.example/a2a`,
        skills: ['research']
      }]
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  throw new Error('Unexpected URL in scout verification');
}) as typeof globalThis.fetch;

try {
  const scouted = await scoutAiWorkerEcosystem();
  if (scoutCalls !== 5) throw new Error(`Expected 5 specialty discovery searches, got ${scoutCalls}.`);
  if (scouted.length < 2 || scouted.length > 5) throw new Error('Expected deduplicated multi-specialty worker results.');
} finally {
  globalThis.fetch = originalFetch;
}

console.log('KCC AI Worker Discovery verification: PASS');
