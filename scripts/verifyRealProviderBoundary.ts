import { cjDropshippingRuntime } from '../server/cjDropshipping.js';

async function main() {
  if (cjDropshippingRuntime.isConfigured()) {
    console.log('CJ production credentials detected; skipping live-provider mutation in verification.');
    return;
  }

  let failedClosed = false;
  try {
    await cjDropshippingRuntime.getAccessToken();
  } catch (error) {
    failedClosed = String(error).includes('refusing simulated access-token generation');
  }

  if (!failedClosed) {
    throw new Error('CJ access-token path did not fail closed when production credentials were absent');
  }

  try {
    await cjDropshippingRuntime.submitOrder({
      shippingName: 'Verification Customer',
      shippingAddress: 'Never Used',
      shippingCity: 'Test City',
      shippingCountry: 'US',
      shippingZip: '00000',
      products: [{ pid: 'NON-PRODUCTION', quantity: 1, unitPrice: 1 }]
    });
    throw new Error('CJ submitOrder did not fail closed when production credentials were absent');
  } catch (error) {
    if (!String(error).includes('refusing to create simulated fulfillment orders')) {
      throw error;
    }
  }

  console.log('Real provider boundary verification: PASS');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
