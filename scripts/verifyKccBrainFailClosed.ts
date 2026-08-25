import { kccBrain } from '../server/kccBrain.js';
import { kccRealityVerifier } from '../server/kccRealityVerifier.js';

const providerKeys = ['GEMINI_API_KEY', 'OPENAI_API_KEY', 'CLAUDE_API_KEY', 'ANTHROPIC_API_KEY', 'MANUS_API_KEY'];
const savedKeys = new Map<string, string | undefined>();

for (const key of providerKeys) {
  savedKeys.set(key, process.env[key]);
  delete process.env[key];
}

try {
  const result = await kccBrain.executeAgentTask(
    'SECURITY_TEST',
    'Verify that the KCC Brain fails closed when no live AI provider is configured.',
    { mustNeverBeReturnedAsSuccess: true }
  );

  if (result.status !== 'BLOCKED') {
    throw new Error(`Expected BLOCKED when no live provider is configured, got ${result.status}`);
  }

  if (result.output !== null) {
    throw new Error('Fail-closed Brain result must not contain fallback output.');
  }

  if (!result.auditTrail.some(entry => entry.includes('Deterministic fallback is blocked fail-closed'))) {
    throw new Error('Missing fail-closed audit trail entry.');
  }

  const downstreamProof = kccRealityVerifier.verifyTaskResult(
    { verificationMethod: 'API_CHECK' },
    { success: false, error: 'provider HTTP 503' }
  );
  if (downstreamProof.verified) {
    throw new Error('Downstream reality verification must reject explicit provider failure.');
  }

  const status = kccBrain.getBrainStatus();
  if (status.activeProviders.deterministicFallback !== false || status.failClosedProviderExecution !== true) {
    throw new Error('Brain status does not advertise the fail-closed provider boundary correctly.');
  }

  console.log('KCC Brain fail-closed verification: PASS');
} finally {
  for (const [key, value] of savedKeys) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
