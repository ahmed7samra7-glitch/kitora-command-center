import { dbRuntime } from '../server/dbStorage.js';
import { productionReadinessAuditEngine } from '../server/productionReadinessAudit.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const previousEvidence = dbRuntime.get('notificationEvidence');
  const previousOrders = dbRuntime.get('cjOrders');

  try {
    dbRuntime.set('notificationEvidence', []);
    dbRuntime.set('cjOrders', []);

    const report = productionReadinessAuditEngine.getProductionReadinessAudit();
    assert(report.overallStatus === 'PRODUCTION_BLOCKED', 'Production audit must remain blocked without provider evidence');
    assert(report.kccAlive.kccAlive === false, 'KCC ALIVE must remain false without live evidence');
    assert(report.mockEliminationSummary.mockFreePercentage < 100, 'Audit must not claim 100% mock-free readiness');

    const whatsappStep = await productionReadinessAuditEngine.verifyExecutionStep('WHATSAPP_DELIVERY_CONFIRMED', {
      providerMessageId: 'wamid.NONEXISTENT'
    });
    assert(whatsappStep.verified === false, 'Unknown WhatsApp delivery evidence must not verify');

    const unknownStep = await productionReadinessAuditEngine.verifyExecutionStep('UNKNOWN_STEP', {});
    assert(unknownStep.verified === false, 'Unknown verification steps must fail closed');

    console.log('Production readiness truth verification: PASS');
  } finally {
    if (previousEvidence === undefined) dbRuntime.set('notificationEvidence', []);
    else dbRuntime.set('notificationEvidence', previousEvidence);
    if (previousOrders === undefined) dbRuntime.set('cjOrders', []);
    else dbRuntime.set('cjOrders', previousOrders);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
