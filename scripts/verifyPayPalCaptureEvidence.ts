import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kcc-paypal-proof-'));
process.env.KCC_DB_DIR = isolatedDataDir;
process.env.PAYPAL_CLIENT_ID = 'test-client';
process.env.PAYPAL_CLIENT_SECRET = 'test-secret';
process.env.PAYPAL_MODE = 'sandbox';

const { dbRuntime } = await import('../server/dbStorage.js');
const { payPalRuntime } = await import('../server/paypal.js');

const originalFetch = globalThis.fetch;
let captureResponse: any = {
  status: 'COMPLETED',
  purchase_units: [{
    payments: {
      captures: [{ id: 'CAP-VALID', status: 'COMPLETED' }]
    }
  }]
};
let reconciliationResponse: any = {
  status: 'COMPLETED',
  purchase_units: [{
    payments: {
      captures: [{ id: 'CAP-VALID', status: 'COMPLETED' }]
    }
  }]
};

globalThis.fetch = (async (input: RequestInfo | URL) => {
  const url = String(input);
  if (url.endsWith('/v1/oauth2/token')) {
    return new Response(JSON.stringify({
      access_token: 'TEST_ACCESS_TOKEN',
      expires_in: 3600
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.includes('/v2/checkout/orders/ORDER-1/capture')) {
    return new Response(JSON.stringify(captureResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  if (url.endsWith('/v2/checkout/orders/ORDER-1')) {
    return new Response(JSON.stringify(reconciliationResponse), {
      status: 200,
      headers: { 'content-type': 'application/json' }
    });
  }
  throw new Error(`Unexpected test fetch: ${url}`);
}) as typeof fetch;

try {
  dbRuntime.set('paypalOrders', [{
    id: 'ORDER-1',
    status: 'APPROVED',
    amount: 25,
    currency: 'USD',
    description: 'KCC test',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    mode: 'sandbox'
  }]);

  captureResponse = {
    status: 'CREATED',
    purchase_units: [{
      payments: {
        captures: [{ id: 'CAP-INCOMPLETE', status: 'PENDING' }]
      }
    }]
  };
  reconciliationResponse = {
    status: 'PENDING',
    purchase_units: [{
      payments: {
        captures: [{ id: 'CAP-INCOMPLETE', status: 'PENDING' }]
      }
    }]
  };
  await assert.rejects(
    () => payPalRuntime.captureOrder('ORDER-1'),
    /incomplete/,
  );
  assert.equal(dbRuntime.get('paypalOrders')[0].status, 'APPROVED');
  assert.equal(dbRuntime.get('paypalOrders')[0].captureId, 'CAP-INCOMPLETE');

  captureResponse = {
    status: 'COMPLETED',
    purchase_units: [{
      payments: {
        captures: [{ id: 'CAP-VALID', status: 'COMPLETED' }]
      }
    }]
  };
  reconciliationResponse = {
    status: 'COMPLETED',
    purchase_units: [{
      payments: {
        captures: [{ id: 'CAP-VALID', status: 'COMPLETED' }]
      }
    }]
  };
  const completed = await payPalRuntime.captureOrder('ORDER-1');
  assert.equal(completed.status, 'COMPLETED');
  assert.equal(completed.captureId, 'CAP-VALID');
  assert.equal(dbRuntime.get('paypalOrders')[0].captureId, 'CAP-VALID');

  dbRuntime.set('paypalOrders', [{
    id: 'ORDER-1',
    status: 'APPROVED',
    amount: 25,
    currency: 'USD',
    description: 'KCC test',
    createTime: new Date().toISOString(),
    updateTime: new Date().toISOString(),
    mode: 'sandbox'
  }]);
  const approvedWebhook = await payPalRuntime.processWebhook({}, {
    event_type: 'CHECKOUT.ORDER.APPROVED',
    resource: { id: 'ORDER-1' }
  });
  assert.equal(approvedWebhook.processed, true);
  assert.equal(dbRuntime.get('paypalOrders')[0].status, 'COMPLETED');
  assert.equal(dbRuntime.get('paypalOrders')[0].captureId, 'CAP-VALID');

  const completedWebhook = await payPalRuntime.processWebhook({}, {
    event_type: 'PAYMENT.CAPTURE.COMPLETED',
    resource: { id: 'CAP-VALID' }
  });
  assert.equal(completedWebhook.processed, true);

  console.log('PayPal capture evidence proof passed: incomplete responses never persist COMPLETED state, pending captures remain traceable, and webhook order/capture identifiers reconcile correctly.');
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(isolatedDataDir, { recursive: true, force: true });
}
