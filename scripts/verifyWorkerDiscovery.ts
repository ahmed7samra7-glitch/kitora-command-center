import { discoverPublicAiWorkers, rankWorkersForGoal } from '../server/cloudflareWorkerDiscovery.js';

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

console.log('KCC AI Worker Discovery verification: PASS');
