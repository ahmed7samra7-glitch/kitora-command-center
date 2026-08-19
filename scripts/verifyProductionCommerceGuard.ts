process.env.NODE_ENV = 'production';

async function main() {
  const { phase4CommerceEngine } = await import('../server/phase4AutonomousCommerce.js');

  let blocked = false;
  try {
    await phase4CommerceEngine.publishProductToLiveStore({
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
    });
  } catch (error) {
    blocked = String(error).includes('[KCC Production Commerce Guard]') &&
      String(error).includes('production readiness is fail-closed');
  }

  if (!blocked) {
    throw new Error('Production commerce guard failed to block autonomous publishing while readiness is blocked');
  }

  console.log('Production commerce guard verification: PASS');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
