import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../server/asyncWorkerLoop.ts', import.meta.url), 'utf8');

if (source.includes('Simulated execution for step') || source.includes('simulated: true')) {
  throw new Error('Async worker must not synthesize COMPLETED output when a provider is unavailable.');
}

if (!source.includes("task.status === 'RUNNING' && asyncJobId") || !source.includes('driver.poll(asyncJobId)')) {
  throw new Error('Async worker must poll an existing async job instead of dispatching it repeatedly.');
}

if (!source.includes("driverRes.status === 'COMPLETED' || driverRes.status === 'FAILED' || driverRes.status === 'RUNNING'")) {
  throw new Error('Async worker must preserve trusted driver status instead of collapsing all non-failures into COMPLETED.');
}

if (!source.includes("Provider claimed COMPLETED without output evidence.") || !source.includes('asyncJobId: driverRes.asyncJobId || driverRes.result?.asyncJobId')) {
  throw new Error('Async worker must reject completion without output and preserve the provider async job identity.');
}

if (!source.includes("if (submitStatus === 'COMPLETED') this.tasksCompletedCount++")) {
  throw new Error('Async worker completion counters must only increment for COMPLETED tasks.');
}

console.log('Async worker fail-closed verification: PASS');
