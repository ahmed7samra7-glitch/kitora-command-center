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

const constrainedReadOnly = issueAutonomyPassport({
  goal: 'Research KITORA product opportunities. Do not purchase, spend money, contact suppliers, fulfill orders, or send notifications.'
});
if (constrainedReadOnly.mode !== 'READ_ONLY') {
  throw new Error('Explicitly prohibited external actions must not block a read-only research mission.');
}

const blocked = issueAutonomyPassport({
  goal: 'Purchase inventory from the supplier now.',
  costUSD: 10
});
if (blocked.mode !== 'BLOCKED') {
  throw new Error('Expected an external-write mission to be blocked before Brain execution.');
}

const gerundBlocked = issueAutonomyPassport({
  goal: 'Purchase inventory by spending money from the supplier.'
});
if (gerundBlocked.mode !== 'BLOCKED') {
  throw new Error('Positive purchase/spend request must remain blocked.');
}

const approval = issueAutonomyPassport({
  goal: 'Prepare a financial decision.',
  sensitivityScore: 0.95
});
if (approval.mode !== 'OWNER_APPROVAL') {
  throw new Error('Expected high-sensitivity mission to require owner approval.');
}

const invalidSensitivity = issueAutonomyPassport({
  goal: 'Prepare a financial decision.',
  sensitivityScore: Number.NaN
});
if (invalidSensitivity.mode !== 'OWNER_APPROVAL') {
  throw new Error('Invalid sensitivity input must fail closed to owner approval.');
}

const invalidCost = issueAutonomyPassport({
  goal: 'Prepare a financial decision.',
  costUSD: Number.NaN
});
if (invalidCost.mode !== 'OWNER_APPROVAL') {
  throw new Error('Invalid cost input must fail closed to owner approval.');
}

const negativeCost = issueAutonomyPassport({
  goal: 'Prepare a financial decision.',
  costUSD: -500
});
if (negativeCost.mode !== 'OWNER_APPROVAL') {
  throw new Error('Negative cost input must fail closed to owner approval.');
}

const mixedExternalWrite = issueAutonomyPassport({
  goal: 'Do not purchase inventory. Purchase inventory later only after analysis.'
});
if (mixedExternalWrite.mode !== 'BLOCKED') {
  throw new Error('Any later positive external-write occurrence must fail closed even when an earlier occurrence is negated.');
}

const overrideExternalWrite = issueAutonomyPassport({
  goal: 'Never publish content, but publish the approved campaign now.'
});
if (overrideExternalWrite.mode !== 'BLOCKED') {
  throw new Error('Override phrasing must not bypass the external-write boundary.');
}

const mixedNextActions = admitNextActions(readOnly, [
  { agentId: 'RESEARCH', goal: 'Do not contact suppliers. Contact a supplier for pricing now.' }
]);
if (mixedNextActions.admitted.length !== 0 || mixedNextActions.rejected.length !== 1) {
  throw new Error('Mixed negation and positive side-effect wording must be rejected in next actions.');
}

console.log('KCC Autonomy Passport verification: PASS');
