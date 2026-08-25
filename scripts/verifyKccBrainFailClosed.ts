import { kccBrain } from '../server/kccBrain.js';
import { kccRealityVerifier } from '../server/kccRealityVerifier.js';
import { requireCompletedBrainOutput } from '../server/phase4AutonomousCommerce.js';

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

  const blockedError = (() => {
    try {
      requireCompletedBrainOutput({ ...result, status: 'BLOCKED', output: null }, 'test product hunting');
      return null;
    } catch (error: any) {
      return error;
    }
  })();
  if (!blockedError || blockedError.code !== 'KCC_BRAIN_BLOCKED' || blockedError.status !== 'BLOCKED') {
    throw new Error('Phase 4 must explicitly propagate BLOCKED/null Brain results without continuing.');
  }

  const failedError = (() => {
    try {
      requireCompletedBrainOutput({ ...result, status: 'FAILED', output: null }, 'test product hunting');
      return null;
    } catch (error: any) {
      return error;
    }
  })();
  if (!failedError || failedError.code !== 'KCC_BRAIN_BLOCKED' || failedError.status !== 'FAILED') {
    throw new Error('Phase 4 must explicitly propagate FAILED/null Brain results.');
  }

  const unexpectedError = (() => {
    try {
      requireCompletedBrainOutput({ ...result, status: 'RUNNING', output: null } as any, 'test product hunting');
      return null;
    } catch (error: any) {
      return error;
    }
  })();
  if (!unexpectedError) {
    throw new Error('Phase 4 must reject unexpected Brain statuses.');
  }

  const validOutput = { viralPotentialScore: 90, competitionLevel: 'LOW' };
  const returnedOutput = requireCompletedBrainOutput({ ...result, status: 'COMPLETED', output: validOutput }, 'test product hunting');
  if (returnedOutput !== validOutput) {
    throw new Error('Phase 4 must preserve valid completed Brain output.');
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
