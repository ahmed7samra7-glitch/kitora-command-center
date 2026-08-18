import assert from 'node:assert/strict';

const { productionReadinessAuditEngine } = await import('../server/productionReadinessAudit.js');

const report = productionReadinessAuditEngine.getProductionReadinessAudit();

assert.equal(report.kccAlive.kccAlive, false);
assert.equal(report.overallStatus, 'PRODUCTION_BLOCKED');
assert.notEqual(report.overallStatus, 'FUNCTIONAL_PENDING_LIVE_CREDENTIALS');

console.log('Production readiness fail-closed proof passed: KCC ALIVE false yields PRODUCTION_BLOCKED.');

process.exit(0);

export {};

