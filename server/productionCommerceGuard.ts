import { phase4CommerceEngine } from './phase4AutonomousCommerce.js';
import { productionReadinessAuditEngine } from './productionReadinessAudit.js';

const isProduction = process.env.NODE_ENV === 'production';

function assertProductionCommerceReady(operation: string): void {
  if (!isProduction) return;

  const audit = productionReadinessAuditEngine.getProductionReadinessAudit();
  if (audit.overallStatus === 'PRODUCTION_BLOCKED') {
    throw new Error(
      `[KCC Production Commerce Guard] ${operation} blocked: production readiness is fail-closed until fresh provider-backed fulfillment and notification evidence is present`,
    );
  }
}

const originalDiscoverAndHuntProducts = phase4CommerceEngine.discoverAndHuntProducts.bind(phase4CommerceEngine);
phase4CommerceEngine.discoverAndHuntProducts = async function guardedDiscoverAndHuntProducts(...args) {
  assertProductionCommerceReady('discoverAndHuntProducts');
  return originalDiscoverAndHuntProducts(...args);
};

const originalPublishProductToLiveStore = phase4CommerceEngine.publishProductToLiveStore.bind(phase4CommerceEngine);
phase4CommerceEngine.publishProductToLiveStore = async function guardedPublishProductToLiveStore(...args) {
  assertProductionCommerceReady('publishProductToLiveStore');
  return originalPublishProductToLiveStore(...args);
};

const originalRunAutonomousGrowthEngine = phase4CommerceEngine.runAutonomousGrowthEngine.bind(phase4CommerceEngine);
phase4CommerceEngine.runAutonomousGrowthEngine = async function guardedRunAutonomousGrowthEngine(...args) {
  assertProductionCommerceReady('runAutonomousGrowthEngine');
  return originalRunAutonomousGrowthEngine(...args);
};

const originalProcessCompleteOrderPipeline = phase4CommerceEngine.processCompleteOrderPipeline.bind(phase4CommerceEngine);
phase4CommerceEngine.processCompleteOrderPipeline = async function guardedProcessCompleteOrderPipeline(...args) {
  assertProductionCommerceReady('processCompleteOrderPipeline');
  return originalProcessCompleteOrderPipeline(...args);
};

const originalTriggerCustomerAutomation = phase4CommerceEngine.triggerCustomerAutomation.bind(phase4CommerceEngine);
phase4CommerceEngine.triggerCustomerAutomation = async function guardedTriggerCustomerAutomation(...args) {
  assertProductionCommerceReady('triggerCustomerAutomation');
  return originalTriggerCustomerAutomation(...args);
};
