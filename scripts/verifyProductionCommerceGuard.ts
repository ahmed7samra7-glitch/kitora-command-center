process.env.NODE_ENV = 'production';

function isGuardError(error: unknown): boolean {
  const message = String(error);
  return message.includes('[KCC Production Commerce Guard]') &&
    message.includes('production readiness is fail-closed');
}

async function expectBlocked(label: string, operation: () => unknown | Promise<unknown>): Promise<void> {
  try {
    await operation();
  } catch (error) {
    if (isGuardError(error)) return;
    throw new Error(`${label} failed for an unexpected reason: ${String(error)}`);
  }
  throw new Error(`${label} was not blocked while production readiness is blocked`);
}

async function main() {
  await import('../server/productionCommerceGuard.js');
  const { phase4CommerceEngine } = await import('../server/phase4AutonomousCommerce.js');

  await expectBlocked('autonomous product publishing', () => phase4CommerceEngine.publishProductToLiveStore({
    id: 'VERIFY-PROD-GUARD',
    cjProductId: 'VERIFY-CJ',
    title: 'Verification Product',
    category: 'Verification',
    imageUrl: 'https://example.invalid/verification.jpg',
    cjCostUSD: 1,
    shippingUSD: 1,
    calculatedPriceUSD: 5,
    compareAtPriceUSD: 10,
    projectedMarginUSD: 2,
    projectedMarginPercent: 40,
    qualityScore: 90,
    decision: 'APPROVED_AUTO_PUBLISH',
    hunterAnalysis: {
      viralPotentialScore: 90,
      competitionLevel: 'LOW',
      targetAudience: 'Verification',
      keySellingPoint: 'Verification only',
    },
    createdAt: new Date().toISOString(),
  }));

  await expectBlocked('autonomous growth discovery', () => phase4CommerceEngine.discoverAndHuntProducts());
  await expectBlocked('autonomous growth engine', () => phase4CommerceEngine.runAutonomousGrowthEngine());
  await expectBlocked('complete order pipeline', () => phase4CommerceEngine.processCompleteOrderPipeline({
    customerName: 'Verification',
    customerEmail: 'verify@example.invalid',
    customerPhone: '+10000000000',
    shippingAddress: { address: 'Never Used', city: 'Test', country: 'US', zip: '00000' },
    productId: 'VERIFY-CJ',
    quantity: 1,
    paymentAmountUSD: 1,
  }));
  await expectBlocked('customer automation', () => phase4CommerceEngine.triggerCustomerAutomation('VERIFY', 'ORDER_PLACED'));
  await expectBlocked('financial intelligence', () => phase4CommerceEngine.getFinancialIntelligence());
  await expectBlocked('executive overview', () => phase4CommerceEngine.getExecutiveOverview());

  console.log('Production commerce guard verification: PASS');
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
