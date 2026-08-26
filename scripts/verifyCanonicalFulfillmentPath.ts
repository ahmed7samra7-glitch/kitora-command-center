import { dbRuntime } from '../server/dbStorage.js';
import { payPalRuntime } from '../server/paypal.js';
import { cjDropshippingRuntime } from '../server/cjDropshipping.js';
import { phase4CommerceEngine } from '../server/phase4AutonomousCommerce.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const snapshot = dbRuntime.getFullSnapshot();
  const originalCaptureOrder = payPalRuntime.captureOrder;
  const originalSubmitOrder = cjDropshippingRuntime.submitOrder;
  const originalTriggerCustomerAutomation = phase4CommerceEngine.triggerCustomerAutomation;

  try {
    dbRuntime.set('paypalOrders', [{
      id: 'PP-CAPTURED-1',
      status: 'COMPLETED',
      amount: 10,
      currency: 'USD',
      description: 'verification',
      createTime: new Date().toISOString(),
      updateTime: new Date().toISOString(),
      captureId: 'CAPTURE-1',
      mode: 'live',
    }]);

    let captureCalled = false;
    (payPalRuntime as any).captureOrder = async () => {
      captureCalled = true;
      throw new Error('captureOrder must not be called for PAYMENT.CAPTURE.COMPLETED');
    };
    const webhookResult = await payPalRuntime.processWebhook({}, {
      event_type: 'PAYMENT.CAPTURE.COMPLETED',
      resource: { supplementary_data: { related_ids: { order_id: 'PP-CAPTURED-1' } } },
    });
    assert(webhookResult.processed === true, 'Completed capture webhook should reconcile known completed evidence');
    assert(captureCalled === false, 'Completed capture webhook must not call captureOrder');

    dbRuntime.set('storeCatalog', [{ id: 'PROD-1', isPurchasable: true, cjProductId: 'CJ-1' }]);
    dbRuntime.set('cjProducts', [{ pid: 'CJ-1', costPrice: 2, variants: [{ vid: 'VID-1' }], source: 'live-provider' }]);
    // WhatsApp delivery is an external production boundary; keep this deterministic
    // test focused on the canonical order/reservation path.
    (phase4CommerceEngine as any).triggerCustomerAutomation = async (orderId: string, event: string) => ({
      orderId,
      event,
      deliveryState: 'PROVIDER_DISPATCH_PENDING',
      deliveryConfirmed: false,
      providerEvidenceRequired: true,
    });
    (cjDropshippingRuntime as any).submitOrder = async (request: any) => ({
      orderId: 'CJ-ORDER-1',
      cjOrderId: 'CJ-ORDER-1',
      status: 'SUBMITTED',
      shippingName: request.shippingName,
      shippingCountry: request.shippingCountry,
      totalCost: 2,
      paypalOrderId: request.paypalOrderId,
      providerRequestId: 'CJ-REQUEST-1',
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'live-provider',
    });

    const input = {
      customerName: 'Verification Customer',
      customerEmail: 'verification@example.com',
      customerPhone: '+10000000000',
      shippingAddress: { address: '1 Test Way', city: 'Test City', country: 'US', zip: '00000' },
      productId: 'PROD-1',
      quantity: 1,
      paymentAmountUSD: 10,
      paypalPaymentId: 'PP-CAPTURED-1',
    };
    await phase4CommerceEngine.processCompleteOrderPipeline(input);
    let duplicateBlocked = false;
    try {
      await phase4CommerceEngine.processCompleteOrderPipeline(input);
    } catch {
      duplicateBlocked = true;
    }
    assert(duplicateBlocked, 'A second fulfillment attempt must be blocked by the persisted reservation/order');
    console.log('Canonical fulfillment path verification: PASS');
  } finally {
    (payPalRuntime as any).captureOrder = originalCaptureOrder;
    (cjDropshippingRuntime as any).submitOrder = originalSubmitOrder;
    (phase4CommerceEngine as any).triggerCustomerAutomation = originalTriggerCustomerAutomation;
    for (const [key, value] of Object.entries(snapshot)) dbRuntime.set(key, value);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});

