import assert from 'node:assert/strict';

const savedEnv = { ...process.env };
try {
  delete process.env.PAYPAL_CLIENT_ID;
  delete process.env.PAYPAL_CLIENT_SECRET;
  delete process.env.PAYPAL_MODE;

  const { payPalRuntime } = await import('../server/paypal.js');

  await assert.rejects(
    () => payPalRuntime.getAccessToken(),
    /refusing simulated access-token generation/,
  );
  await assert.rejects(
    () => payPalRuntime.createOrder({ amount: 10, currency: 'USD' }),
    /refusing simulated order creation/,
  );
  await assert.rejects(
    () => payPalRuntime.captureOrder('UNTRUSTED-ORDER-ID'),
    /refusing simulated capture/,
  );

  const health = await payPalRuntime.getHealthStatus();
  assert.equal(health.configured, false);
  assert.equal(health.pingSuccess, false);
  assert.equal(health.mode, 'sandbox');

  const webhook = await payPalRuntime.processWebhook({}, {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'UNTRUSTED-ORDER-ID' },
  });
  assert.equal(webhook.processed, false);

  console.log('PayPal fail-closed proof passed.');
} finally {
  for (const key of Object.keys(process.env)) {
    if (!(key in savedEnv)) delete process.env[key];
  }
  Object.assign(process.env, savedEnv);
}
