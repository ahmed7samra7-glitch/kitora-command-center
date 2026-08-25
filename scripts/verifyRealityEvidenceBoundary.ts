import assert from 'node:assert/strict';

const { kccRealityVerifier } = await import('../server/kccRealityVerifier.js');
const { KCCExecutiveReasoningEngine } = await import('../server/kccExecutiveReasoningEngine.js');

const genericApiProof = kccRealityVerifier.verifyTaskResult(
  { verificationMethod: 'API_CHECK' },
  { success: true, provider: 'KITORA_STORE_ADAPTER' },
);
assert.equal(genericApiProof.verified, false);

const genericPaymentProof = kccRealityVerifier.verifyTaskResult(
  { verificationMethod: 'PAYMENT_STATE' },
  { success: true, provider: 'PAYPAL' },
);
assert.equal(genericPaymentProof.verified, false);

const keywordOnlyMission: any = {
  missionId: 'AUDIT-MISSION',
  goal: 'audit',
  tasks: [
    'research', 'supplier catalog', 'store deployment', 'SEO copy optimization',
    'security compliance audit', 'executive launch decision', 'ad campaign funnel',
    'unit economics inventory reservation', 'final launch readiness sign-off',
  ].map((title, index) => ({
    taskId: `TASK-${index}`,
    title,
    status: 'COMPLETED',
    result: { success: true },
  })),
};
const evaluator = new KCCExecutiveReasoningEngine() as any;
evaluator.runExecutiveMeeting = async () => ({ generatedTasks: [] });
const objective = await evaluator.evaluateClosedLoopObjective(keywordOnlyMission);
assert.equal(objective.objectiveAchieved, false);

console.log('Reality evidence boundary proof passed: generic provider labels, local payment state, and keyword-only completed tasks cannot establish verified execution.');
process.exit(0);
