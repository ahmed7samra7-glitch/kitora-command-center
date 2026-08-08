import { kccMissionEngine } from '../server/kccMissionEngine.js';
import { kccMissionLoop } from '../server/kccMissionLoop.js';
import { dbRuntime } from '../server/dbStorage.js';
import { circuitBreakerRegistry, FINANCIAL_SAFETY_LIMITS } from '../server/resilienceAndSafety.js';
import { kccRealityVerifier } from '../server/kccRealityVerifier.js';

async function main() {
  console.log('================================================================');
  console.log('     KCC CONTROLLED PRODUCTION PILOT EXECUTION RUNTIME');
  console.log('================================================================');

  // 1. Verify Resilience Configuration
  console.log('\n--- 1. RESILIENCE & FINANCIAL BOUNDARY VERIFICATION ---');
  console.log('Financial Safety Policy Limits:', JSON.stringify(FINANCIAL_SAFETY_LIMITS, null, 2));
  console.log('Active Circuit Breakers:', JSON.stringify(circuitBreakerRegistry.getAllStatuses(), null, 2));

  // 2. Create Production Pilot Mission
  const pilotGoal = 'Find the best currently viable product opportunity for my store, validate its market potential, source it, prepare everything required for launch, and continue working autonomously until the objective is either independently verified as achieved, objectively impossible, or requires an explicitly configured human approval.';

  console.log(`\n--- 2. INITIALIZING PRODUCTION PILOT MISSION ---`);
  console.log(`Goal: "${pilotGoal}"`);

  const mission = await kccMissionEngine.createMission(pilotGoal, 'CRITICAL');
  console.log(`\n[Production Pilot] Mission Created! ID: ${mission.missionId}`);
  console.log(`[Production Pilot] Initial Executive Tasks (${mission.tasks.length}):`);
  mission.tasks.forEach((t, i) => console.log(`  ${i + 1}. [${t.assignedProvider}] ${t.title} (${t.status})`));

  // 3. Process Mission through Autonomous Execution Loop
  console.log(`\n--- 3. EXECUTING AUTONOMOUS MISSION LOOP ---`);
  const finalState = await kccMissionLoop.processMission(mission.missionId);

  // 4. Gather Execution Telemetry & Evidence
  console.log(`\n--- 4. PILOT EXECUTION RESULTS ---`);
  if (!finalState) {
    console.error('FAILED: Pilot mission state is null.');
    process.exit(1);
  }

  console.log(`Mission ID: ${finalState.missionId}`);
  console.log(`Final Status: ${finalState.status}`);
  console.log(`Progress: ${finalState.progressPercentage}%`);
  console.log(`Current Step: ${finalState.currentStep}`);
  console.log(`Human Approval Required: ${finalState.ownerApprovalRequired}`);
  if (finalState.approvalReason) {
    console.log(`Approval Reason: ${finalState.approvalReason}`);
  }

  console.log(`\nTask Execution Breakdown (${finalState.tasks.length} total tasks):`);
  finalState.tasks.forEach((t, i) => {
    console.log(`  ${i + 1}. [${t.status}] [${t.assignedProvider}] ${t.title}`);
    if (t.result?.realityVerification) {
      console.log(`     -> Reality Score: ${t.result.realityVerification.confidenceScore}, Verified: ${t.result.realityVerification.verified}`);
    }
  });

  console.log(`\n--- 5. CIRCUIT BREAKER & EVIDENCE SUMMARY ---`);
  console.log('Circuit Breaker Statuses:', JSON.stringify(circuitBreakerRegistry.getAllStatuses(), null, 2));

  const evidenceRecords = kccRealityVerifier.getAuditLog();
  console.log(`Total Reality Evidence Audits Logged: ${evidenceRecords.length}`);

  if (finalState.finalReport) {
    console.log('\nFinal Mission Report:', JSON.stringify(finalState.finalReport, null, 2));
  }

  console.log('\n================================================================');
  console.log('  KCC CONTROLLED PRODUCTION PILOT EXECUTION COMPLETED SUCCESSFULLY');
  console.log('================================================================');
}

main().catch(err => {
  console.error('[Production Pilot] Fatal execution error:', err);
  process.exit(1);
});
