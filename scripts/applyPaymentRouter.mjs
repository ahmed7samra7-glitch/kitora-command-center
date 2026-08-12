import fs from 'node:fs';

function read(file) { return fs.readFileSync(file, 'utf8'); }
function write(file, value) { fs.writeFileSync(file, value, 'utf8'); }
function replaceRequired(text, pattern, replacement, label) {
  if (!text.includes(pattern)) throw new Error(`Payment patch anchor not found: ${label}`);
  return text.replace(pattern, replacement);
}

let server = read('server.ts');

if (!server.includes("import { PaymentRouter } from './server/paymentRouter.js';")) {
  server = replaceRequired(
    server,
    "import { payPalRuntime } from './server/paypal.js';",
    "import { payPalRuntime } from './server/paypal.js';\nimport { PaymentRouter, type PaymentProviderId } from './server/paymentRouter.js';",
    'payment router import'
  );
}

if (!server.includes('const paymentRouter = new PaymentRouter(payPalRuntime);')) {
  server = replaceRequired(
    server,
    'const app = express();',
    "const paymentRouter = new PaymentRouter(payPalRuntime);\n\nconst app = express();",
    'payment router instance'
  );
}

if (!server.includes("app.get('/api/payments/providers'")) {
  server = replaceRequired(
    server,
    "app.get('/api/paypal/health', async (req, res) => {",
    "app.get('/api/payments/providers', requireOwnerAuth, (req, res) => {\n  res.json({ success: true, providers: paymentRouter.getAvailableProviders() });\n});\n\napp.post('/api/payments/create', requireOwnerAuth, async (req, res) => {\n  try {\n    const provider = String(req.body?.provider || 'paypal') as PaymentProviderId;\n    const amount = Number(req.body?.amount);\n    if (!Number.isFinite(amount) || amount <= 0) {\n      return res.status(400).json({ success: false, error: 'A positive amount is required.' });\n    }\n    const result = await paymentRouter.createPayment(provider, {\n      amount,\n      currency: req.body?.currency,\n      description: req.body?.description,\n      returnUrl: req.body?.returnUrl,\n      cancelUrl: req.body?.cancelUrl,\n      metadata: req.body?.metadata || {}\n    });\n    res.json({ success: true, payment: result });\n  } catch (err: any) {\n    res.status(400).json({ success: false, error: err?.message || String(err) });\n  }\n});\n\napp.get('/api/paypal/health', async (req, res) => {",
    'payment routes anchor'
  );
}

write('server.ts', server);
console.log('KCC payment router wiring applied.');
