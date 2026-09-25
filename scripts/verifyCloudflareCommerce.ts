import fs from 'node:fs';
import assert from 'node:assert/strict';

const worker = fs.readFileSync(new URL('../worker.ts', import.meta.url), 'utf8');
const commerce = fs.readFileSync(new URL('../server/cloudflareCommerce.ts', import.meta.url), 'utf8');

assert.match(worker, /url\.pathname === '\/api\/paypal\/webhook'/);
assert.match(worker, /url\.pathname === '\/api\/whatsapp\/webhook'/);
assert.match(worker, /url\.pathname === '\/api\/paypal\/orders'/);
assert.match(worker, /KCC_COMMERCE_FULFILL/);
assert.match(worker, /url\.pathname === '\/api\/kcc\/commerce\/products'/);
assert.match(worker, /request\.method === 'POST' && url\.pathname === '\/api\/kcc\/tasks'/);

assert.match(commerce, /PAYMENT\.CAPTURE\.COMPLETED/);
assert.match(commerce, /verification_status === 'SUCCESS'/);
assert.match(commerce, /payType: 2/);
assert.match(commerce, /isSandbox:/);
assert.match(commerce, /KCC_MAX_AUTO_FULFILL_COST_USD/);
assert.match(commerce, /CJ_FULFILLMENT_COST_BLOCKED/);
assert.match(commerce, /REAL-FULFILLMENT-/);
assert.match(commerce, /REAL-NOTIFICATION-/);
assert.match(commerce, /WHATSAPP_WEBHOOK_SIGNATURE_INVALID/);
assert.doesNotMatch(commerce, /process\.env\./);

console.log('Cloudflare commerce bridge source-boundary verification: PASS');
