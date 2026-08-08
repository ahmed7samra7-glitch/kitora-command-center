import { kitoraStoreAdapter } from '../server/kitoraStoreAdapter.js';
import { kccMissionEngine } from '../server/kccMissionEngine.js';
import { kccMissionLoop } from '../server/kccMissionLoop.js';

async function runLiveKitoraInspection() {
  console.log('===================================================');
  console.log('KCC CONNECTING TO LIVE STORE: https://kitora.ai.studio/');
  console.log('===================================================');

  // Step 1: Direct Store Adapter Inspection
  const inspection = await kitoraStoreAdapter.inspectStore();
  console.log('\n[1] DIRECT STORE ADAPTER INSPECTION:');
  console.log(JSON.stringify(inspection, null, 2));

  // Step 2: Deployment & Latency Proof
  const deployment = await kitoraStoreAdapter.verifyDeployment();
  console.log('\n[2] DEPLOYMENT & LATENCY PROOF:');
  console.log(JSON.stringify(deployment, null, 2));

  // Step 3: Executive Brain Autonomous Mission Connection
  console.log('\n[3] EXECUTIVE BRAIN AUTONOMOUS MISSION CONNECTION:');
  const mission = await kccMissionEngine.createMission(
    "Connect to existing KITORA store (https://kitora.ai.studio/) and perform read-only inspection and reality verification",
    "CRITICAL"
  );
  console.log(`Mission Created ID: ${mission.missionId}`);
  console.log(`Initial Status: ${mission.status}`);
  console.log(`Generated Tasks Count: ${mission.tasks.length}`);

  // Execute Mission Loop
  const processed = await kccMissionLoop.processMission(mission.missionId);
  console.log('\n[4] MISSION EXECUTION COMPLETED:');
  console.log(`Final Status: ${processed?.status}`);
  console.log(`Progress: ${processed?.progressPercentage}%`);
  console.log(`Tasks Results:`);
  processed?.tasks.forEach(t => {
    console.log(` - Task [${t.taskId}] ${t.title} (${t.assignedProvider}): ${t.status}`);
    if (t.result?.kitoraInspection) {
      console.log(`   Kitora Inspection Evidence:`, t.result.kitoraInspection.evidence);
    }
  });

  console.log('\n===================================================');
  console.log('LIVE KITORA STORE READ-ONLY PROOF PASSED');
  console.log('===================================================');
}

runLiveKitoraInspection().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
