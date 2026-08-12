import { PaymentRouter } from '../server/paymentRouter.js';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(`PAYMENT ROUTER TEST FAIL: ${message}`);
}

const fakePayPal = {
  isConfigured: () => true,
  createOrder: async (input: any) => ({
    id: 'PP-TEST-001',
    status: 'CREATED',
    links: [{ rel: 'approve', href: 'https://example.test/paypal/approve' }],
    ...input
  })
};

const previousStripeKey = process.env.STRIPE_SECRET_KEY;
try {
  delete process.env.STRIPE_SECRET_KEY;
  const withoutStripe = new PaymentRouter(fakePayPal);
  assert(withoutStripe.getAvailableProviders().includes('paypal'), 'PayPal should be available when configured');
  assert(!withoutStripe.getAvailableProviders().includes('stripe'), 'Stripe should stay disabled without a secret');

  process.env.STRIPE_SECRET_KEY = 'test-only-not-a-real-key';
  const withStripe = new PaymentRouter(fakePayPal);
  assert(withStripe.getAvailableProviders().includes('stripe'), 'Stripe should become available when configured');

  const paypalPayment = await withStripe.createPayment('paypal', { amount: 25, currency: 'USD' });
  assert(paypalPayment.provider === 'paypal', 'PayPal route should preserve provider identity');
  assert(paypalPayment.id === 'PP-TEST-001', 'PayPal order id should propagate');

  console.log('PAYMENT ROUTER TEST PASS');
} finally {
  if (previousStripeKey === undefined) delete process.env.STRIPE_SECRET_KEY;
  else process.env.STRIPE_SECRET_KEY = previousStripeKey;
}
