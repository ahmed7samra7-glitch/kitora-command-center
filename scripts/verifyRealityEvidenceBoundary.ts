import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const isolatedDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'kcc-reality-proof-'));
process.env.KCC_DB_DIR = isolatedDataDir;
process.env.KCC_PROVIDER_EVIDENCE_SECRET = 'test-only-provider-evidence-secret';

const { dbRuntime } = await import('../server/dbStorage.js');
const {
  issueProviderEvidenceReceipt
} = await import('../server/providerEvidenceLedger.js');
const { KCCRealityVerifier } = await import('../server/kccRealityVerifier.js');

dbRuntime.set('kccProviderEvidence', []);
dbRuntime.set('paypalOrders', []);

const verifier = new KCCRealityVerifier();
const inspectedAt = new Date().toISOString();

const receipt = issueProviderEvidenceReceipt({
  provider: 'KITORA_STORE',
  operation: 'STORE_INSPECTION',
  resourceId: 'https://kitora.ai.studio/',
  observedAt: inspectedAt,
  metadata: {
    liveHttpAccessible: true,
    httpStatusCode: 200,
    checkoutStatus: 'HEALTHY',
    title: 'KITORA'
  }
});

const forgedApi = verifier.verifyTaskResult(
  { id: 'TASK-API-FORGED', verificationMethod: 'API_CHECK' },
  {
    success: true,
    kitoraInspection: {
      providerReceiptId: 'PRE-FORGED',
      storeUrl: 'https://kitora.ai.studio/',
      inspectedAt,
      liveHttpAccessible: true,
      httpStatusCode: 200,
      checkoutStatus: 'HEALTHY',
      title: 'KITORA'
    }
  }
);
assert.equal(forgedApi.verified, false);
assert.equal(forgedApi.confidenceScore, 0);
assert.match(forgedApi.evidence.join('\n'), /signed provider evidence receipt/);

const tamperedApi = verifier.verifyTaskResult(
  { id: 'TASK-API-TAMPERED', verificationMethod: 'API_CHECK' },
  {
    success: true,
    kitoraInspection: {
      providerReceiptId: receipt.receiptId,
      storeUrl: 'https://kitora.ai.studio/',
      inspectedAt,
      liveHttpAccessible: true,
      httpStatusCode: 500,
      checkoutStatus: 'HEALTHY',
      title: 'KITORA'
    }
  }
);
assert.equal(tamperedApi.verified, false);
assert.equal(tamperedApi.confidenceScore, 0);

const validApi = verifier.verifyTaskResult(
  { id: 'TASK-API-VALID', verificationMethod: 'API_CHECK' },
  {
    success: true,
    kitoraInspection: {
      providerReceiptId: receipt.receiptId,
      storeUrl: 'https://kitora.ai.studio/',
      inspectedAt,
      liveHttpAccessible: true,
      httpStatusCode: 200,
      checkoutStatus: 'HEALTHY',
      title: 'KITORA'
    }
  }
);
assert.equal(validApi.verified, true);

dbRuntime.set('paypalOrders', [{
  id: 'PAY-REAL-1',
  status: 'COMPLETED',
  amount: 25,
  currency: 'USD',
  description: 'KITORA test',
  createTime: inspectedAt,
  updateTime: inspectedAt,
  captureId: 'CAP-REAL-1',
  mode: 'live'
}]);

const forgedPayPal = verifier.verifyTaskResult(
  {
    id: 'TASK-PAY-FORGED',
    verificationMethod: 'PAYMENT_STATE',
    payload: { paypalOrderId: 'PAY-REAL-1' }
  },
  {
    success: true,
    paymentEvidence: {
      provider: 'PAYPAL',
      status: 'COMPLETED',
      orderId: 'PAY-REAL-1',
      captureId: 'CAP-FORGED'
    }
  }
);
assert.equal(forgedPayPal.verified, false);
assert.equal(forgedPayPal.confidenceScore, 0);

dbRuntime.set('paypalOrders', [{
  id: 'PAY-REAL-1',
  status: 'COMPLETED',
  amount: 25,
  currency: 'USD',
  description: 'KITORA test',
  createTime: inspectedAt,
  updateTime: inspectedAt,
  captureId: 'CAP-REAL-1',
  mode: 'sandbox'
}]);

const sandboxPayPal = verifier.verifyTaskResult(
  {
    id: 'TASK-PAY-SANDBOX',
    verificationMethod: 'PAYMENT_STATE',
    payload: { paypalOrderId: 'PAY-REAL-1' }
  },
  {
    success: true,
    paymentEvidence: {
      provider: 'PAYPAL',
      status: 'COMPLETED',
      orderId: 'PAY-REAL-1',
      captureId: 'CAP-REAL-1'
    }
  }
);
assert.equal(sandboxPayPal.verified, false);

dbRuntime.set('paypalOrders', [{
  id: 'PAY-REAL-1',
  status: 'COMPLETED',
  amount: 25,
  currency: 'USD',
  description: 'KITORA test',
  createTime: inspectedAt,
  updateTime: inspectedAt,
  captureId: 'CAP-REAL-1',
  mode: 'live'
}]);

const validPayPal = verifier.verifyTaskResult(
  {
    id: 'TASK-PAY-VALID',
    verificationMethod: 'PAYMENT_STATE',
    payload: { paypalOrderId: 'PAY-REAL-1' }
  },
  {
    success: true,
    paymentEvidence: {
      provider: 'PAYPAL',
      status: 'COMPLETED',
      orderId: 'PAY-REAL-1',
      captureId: 'CAP-REAL-1'
    }
  }
);
assert.equal(validPayPal.verified, true);

console.log('Reality evidence boundary proof passed: forged API inspection and PayPal capture fields cannot establish verification without fresh signed/persisted provider-backed evidence.');
fs.rmSync(isolatedDataDir, { recursive: true, force: true });
