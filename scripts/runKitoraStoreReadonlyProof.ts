import { kitoraStoreAdapter } from '../server/kitoraStoreAdapter.js';

/**
 * Deterministic, read-only reality proof for the live KITORA store.
 *
 * This test intentionally does NOT create an Executive Brain mission or
 * dispatch AI tasks. Mission orchestration is covered by the dedicated
 * sequence/orchestration tests. Keeping this proof bounded prevents a
 * live-store connectivity check from waiting on unrelated AI providers.
 */
async function runLiveKitoraInspection() {
  const startedAt = Date.now();

  console.log('===================================================');
  console.log('KCC CONNECTING TO LIVE STORE: https://kitora.ai.studio/');
  console.log('===================================================');

  const inspection = await kitoraStoreAdapter.inspectStore();
  console.log('\n[1] DIRECT STORE ADAPTER INSPECTION:');
  console.log(JSON.stringify(inspection, null, 2));

  const deployment = await kitoraStoreAdapter.verifyDeployment();
  console.log('\n[2] DEPLOYMENT & LATENCY PROOF:');
  console.log(JSON.stringify(deployment, null, 2));

  // Explicit read-only assertions.
  if (!deployment.verified) {
    throw new Error('KITORA deployment could not be verified.');
  }

  if (inspection.checkoutStatus !== 'HEALTHY') {
    throw new Error(`KITORA checkout health is ${inspection.checkoutStatus}.`);
  }

  const products = await kitoraStoreAdapter.getProducts();
  const orders = await kitoraStoreAdapter.getOrders();
  const inventory = await kitoraStoreAdapter.getInventory();

  if (!Array.isArray(products)) {
    throw new Error('KITORA product catalog is not readable.');
  }

  if (!Array.isArray(orders)) {
    throw new Error('KITORA order store is not readable.');
  }

  if (typeof inventory !== 'object' || inventory === null || Array.isArray(inventory)) {
    throw new Error('KITORA inventory state is not readable.');
  }

  console.log('\n[3] READ-ONLY STATE ASSERTIONS:');
  console.log(`Products readable: ${products.length}`);
  console.log(`Orders readable: ${orders.length}`);
  console.log(`Inventory entries readable: ${Object.keys(inventory).length}`);
  console.log(`Total proof duration: ${Date.now() - startedAt}ms`);

  console.log('\n===================================================');
  console.log('LIVE KITORA STORE READ-ONLY PROOF PASSED');
  console.log('===================================================');
}

runLiveKitoraInspection().catch(err => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
