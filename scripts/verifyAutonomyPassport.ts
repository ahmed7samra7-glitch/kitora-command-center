import { admitNextActions, issueAutonomyPassport } from '../server/kccAutonomyPassport.js';

const readOnly = issueAutonomyPassport({
  goal: 'Analyze verified KITORA telemetry and recommend the next safe action.'
});
if (readOnly.mode !== 'READ_ONLY' || readOnly.maxSpendUSD !== 0) {
  throw new Error('Expected safe analysis mission to receive a zero-spend READ_ONLY passport.');
}

const safeAdmission = admitNextActions(readOnly, [
  { agentId: 'EXECUTIVE_AUDITOR', goal: 'Inspect verified runtime telemetry and summarize blockers.' }
]);
if (safeAdmission.admitted.length !== 1 || safeAdmission.rejected.length !== 0) {
  throw new Error('Expected safe analytical next action to be admitted.');
}

const blockedAdmission = admitNextActions(readOnly, [
  { agentId: 'STORE_PUBLISHER', goal: 'Publish the selected product to the live store.' },
  { agentId: 'FULFILLMENT', goal: 'Purchase supplier inventory for the order.' }
]);
if (blockedAdmission.admitted.length !== 0 || blockedAdmission.rejected.length !== 2) {
  throw new Error('Expected external-write next actions to be rejected by the passport.');
}

const blocked = issueAutonomyPassport({
  goal: 'Purchase inventory from the supplier now.',
  costUSD: 10
});
if (blocked.mode !== 'BLOCKED') {
  throw new Error('Expected an external-write mission to be blocked before Brain execution.');
}

const approval = issueAutonomyPassport({
  goal: 'Prepare a financial decision.',
  sensitivityScore: 0.95
});
if (approval.mode !== 'OWNER_APPROVAL') {
  throw new Error('Expected high-sensitivity mission to require owner approval.');
}

console.log('KCC Autonomy Passport verification: PASS');
