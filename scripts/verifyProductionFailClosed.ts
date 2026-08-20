import assert from 'node:assert/strict';

const savedEnv = { ...process.env };
try {
  delete process.env.CJ_DROPSHIPPING_EMAIL;
  delete process.env.CJ_DROPSHIPPING_API_KEY;
  delete process.env.CJ_LOGISTICS_NAME;
  delete process.env.META_WHATSAPP_LIVE_BEARER_TOKEN;
  delete process.env.META_WHATSAPP_PHONE_NUMBER_ID;
  delete process.env.META_WHATSAPP_APP_SECRET;
  delete process.env.KCC_ALIVE_ATTESTATION_SECRET;
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;

  const { cjDropshippingRuntime } = await import('../server/cjDropshipping.js');
  const { diagnosticsCenter } = await import('../server/diagnostics.js');
  const { productionReadinessAuditEngine } = await import('../server/productionReadinessAudit.js');
  const { phase4CommerceEngine } = await import('../server/phase4AutonomousCommerce.js');

  await assert.rejects(() => cjDropshippingRuntime.syncProducts(), /refusing synthetic catalog data/);
  const audit = productionReadinessAuditEngine.getProductionReadinessAudit();
  assert.equal(audit.kccAlive.kccAlive, false);
  assert.equal(audit.overallStatus, 'PRODUCTION_BLOCKED');
  assert.ok(audit.kccAlive.blockers.some((blocker) => blocker.includes('real fulfillment evidence is missing')));

  const readiness = diagnosticsCenter.getProductionReadiness();
  assert.equal(readiness.kccAlive, false);
  assert.equal(readiness.overallScore, 0);
  assert.equal(readiness.overallStatus, 'PRODUCTION_BLOCKED');
  assert.ok(readiness.subsystems.every((subsystem) => !subsystem.evidence.some((item) => /fallback|mock|complete fulfillment/i.test(item))));
  assert.ok(diagnosticsCenter.getCredentialStatus().every((credential) => credential.status !== 'WARNING_MOCK'));

  await assert.rejects(() => phase4CommerceEngine.processCompleteOrderPipeline({
    customerName: 'Adversarial Test', customerEmail: 'test@example.invalid', customerPhone: '+10000000000',
    shippingAddress: { address: 'Nowhere', city: 'Nowhere', country: 'US', zip: '00000' },
    productId: 'PROD-NONEXISTENT', quantity: 1, paymentAmountUSD: 10,
  }), /Production commerce is blocked|Verified PayPal capture evidence is required/);

  console.log('Production fail-closed proof passed: missing credentials, synthetic catalog, unverified payment/order, and legacy readiness optimism remain blocked.');
} finally {
  for (const key of Object.keys(process.env)) if (!(key in savedEnv)) delete process.env[key];
  Object.assign(process.env, savedEnv);
}
process.exit(0);
