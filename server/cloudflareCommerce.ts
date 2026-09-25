import type { CloudflareD1Database, CloudflareQueue } from './cloudflareStore.js';

export interface CommerceEnv {
  KCC_WORKER_SECRET?: string;
  PAYPAL_CLIENT_ID?: string;
  PAYPAL_CLIENT_SECRET?: string;
  PAYPAL_MODE?: string;
  PAYPAL_WEBHOOK_ID?: string;
  APP_URL?: string;
  CJ_DROPSHIPPING_API_KEY?: string;
  CJ_LOGISTICS_NAME?: string;
  CJ_FROM_COUNTRY_CODE?: string;
  META_WHATSAPP_LIVE_BEARER_TOKEN?: string;
  META_WHATSAPP_PHONE_NUMBER_ID?: string;
  META_WHATSAPP_GRAPH_VERSION?: string;
  KCC_AUTOFULFILL_ENABLED?: string;
  KCC_MAX_AUTO_FULFILL_COST_USD?: string;
  KCC_DB: CloudflareD1Database;
  KCC_TASK_QUEUE?: CloudflareQueue;
}

export interface CommerceCheckoutInput {
  productId: string;
  quantity: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  shippingZip: string;
}

interface PayPalOrderData {
  id: string;
  status: string;
  links?: Array<{ href?: string; rel?: string }>;
  purchase_units?: Array<any>;
  payer?: any;
}

interface CommerceProductRow {
  product_id: string;
  cj_product_id: string;
  cj_variant_id: string;
  price_usd: number;
  cost_usd: number;
  active: number;
}

interface CommerceOrderRow {
  id: string;
  paypal_order_id: string;
  paypal_capture_id?: string | null;
  product_id: string;
  cj_product_id: string;
  cj_variant_id: string;
  quantity: number;
  amount_usd: number;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_address: string;
  shipping_city: string;
  shipping_country: string;
  shipping_zip: string;
  payment_status: string;
  fulfillment_status: string;
  notification_status: string;
  cj_order_id?: string | null;
  cj_provider_request_id?: string | null;
  whatsapp_message_id?: string | null;
  whatsapp_provider_request_id?: string | null;
  created_at: string;
  updated_at: string;
  last_error?: string | null;
}

function required(env: CommerceEnv, name: keyof CommerceEnv): string {
  const value = String(env[name] ?? '').trim();
  if (!value) throw new Error(`${String(name)} is required for commerce execution`);
  return value;
}

function isEnabled(value?: string): boolean {
  return String(value || '').trim().toLowerCase() === 'true';
}

function paypalBase(env: CommerceEnv): string {
  return (env.PAYPAL_MODE || 'sandbox').trim().toLowerCase() === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';
}

async function paypalAccessToken(env: CommerceEnv): Promise<string> {
  const clientId = required(env, 'PAYPAL_CLIENT_ID');
  const secret = required(env, 'PAYPAL_CLIENT_SECRET');
  const credentials = btoa(`${clientId}:${secret}`);
  const response = await fetch(`${paypalBase(env)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: 'grant_type=client_credentials'
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || typeof payload?.access_token !== 'string') {
    throw new Error(`PayPal OAuth failed (${response.status})`);
  }
  return payload.access_token;
}

async function paypalRequest<T>(env: CommerceEnv, path: string, init: RequestInit = {}): Promise<T> {
  const token = await paypalAccessToken(env);
  const response = await fetch(`${paypalBase(env)}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers || {})
    }
  });
  const payload = await response.json().catch(() => null) as T;
  if (!response.ok) throw new Error(`PayPal API failed (${response.status})`);
  return payload;
}

async function ensurePayPalWebhook(env: CommerceEnv): Promise<string> {
  if ((env.PAYPAL_WEBHOOK_ID || '').trim()) return env.PAYPAL_WEBHOOK_ID!.trim();
  const appUrl = required(env, 'APP_URL').replace(/\/$/, '');
  const existing = await paypalRequest<{ webhooks?: Array<{ id?: string; url?: string }> }>(env, '/v1/notifications/webhooks');
  const existingMatch = (existing.webhooks || []).find(item => item.url === `${appUrl}/api/paypal/webhook`);
  if (existingMatch?.id) return existingMatch.id;
  const created = await paypalRequest<{ id?: string }>(env, '/v1/notifications/webhooks', {
    method: 'POST',
    body: JSON.stringify({
      url: `${appUrl}/api/paypal/webhook`,
      event_types: [
        { name: 'PAYMENT.CAPTURE.COMPLETED' },
        { name: 'PAYMENT.CAPTURE.DENIED' }
      ]
    })
  });
  const id = String(created.id || '').trim();
  if (!id) throw new Error('PayPal webhook registration returned no webhook ID');
  return id;
}

async function verifyPayPalWebhook(env: CommerceEnv, headers: Headers, webhookEvent: unknown): Promise<boolean> {
  const webhookId = await ensurePayPalWebhook(env);
  const transmissionId = headers.get('paypal-transmission-id') || '';
  const transmissionTime = headers.get('paypal-transmission-time') || '';
  const certUrl = headers.get('paypal-cert-url') || '';
  const authAlgo = headers.get('paypal-auth-algo') || '';
  const transmissionSig = headers.get('paypal-transmission-sig') || '';
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) return false;

  const result = await paypalRequest<{ verification_status?: string }>(
    env,
    '/v1/notifications/verify-webhook-signature',
    {
      method: 'POST',
      body: JSON.stringify({
        auth_algo: authAlgo,
        cert_url: certUrl,
        transmission_id: transmissionId,
        transmission_sig: transmissionSig,
        transmission_time: transmissionTime,
        webhook_id: webhookId,
        webhook_event: webhookEvent
      })
    }
  );
  return result.verification_status === 'SUCCESS';
}

function checkoutDetailsFromPayPal(data: PayPalOrderData): Partial<CommerceCheckoutInput> {
  const unit = Array.isArray(data.purchase_units) ? data.purchase_units[0] : undefined;
  const shipping = unit?.shipping;
  const address = shipping?.address || {};
  return {
    customerName: String(shipping?.name?.full_name || '').trim(),
    shippingAddress: String(address.address_line_1 || '').trim(),
    shippingCity: String(address.admin_area_2 || '').trim(),
    shippingCountry: String(address.country_code || '').trim(),
    shippingZip: String(address.postal_code || '').trim(),
    customerEmail: String(data.payer?.email_address || '').trim()
  };
}

export async function ensureCommerceSchema(db: CloudflareD1Database): Promise<void> {
  await db.prepare(`CREATE TABLE IF NOT EXISTS kcc_commerce_products (
    product_id TEXT PRIMARY KEY,
    cj_product_id TEXT NOT NULL,
    cj_variant_id TEXT NOT NULL,
    price_usd REAL NOT NULL,
    cost_usd REAL NOT NULL CHECK (cost_usd >= 0),
    active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0,1)),
    created_at TEXT NOT NULL DEFAULT '',
    updated_at TEXT NOT NULL DEFAULT ''
  )`).run();
  await db.prepare(`CREATE TABLE IF NOT EXISTS kcc_commerce_orders (
    id TEXT PRIMARY KEY,
    paypal_order_id TEXT NOT NULL UNIQUE,
    paypal_capture_id TEXT UNIQUE,
    product_id TEXT NOT NULL,
    cj_product_id TEXT NOT NULL,
    cj_variant_id TEXT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    amount_usd REAL NOT NULL CHECK (amount_usd > 0),
    customer_name TEXT NOT NULL,
    customer_email TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    shipping_address TEXT NOT NULL,
    shipping_city TEXT NOT NULL,
    shipping_country TEXT NOT NULL,
    shipping_zip TEXT NOT NULL,
    payment_status TEXT NOT NULL,
    fulfillment_status TEXT NOT NULL,
    notification_status TEXT NOT NULL,
    cj_order_id TEXT,
    cj_provider_request_id TEXT,
    whatsapp_message_id TEXT,
    whatsapp_provider_request_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    last_error TEXT
  `).run();
}

export async function upsertCommerceProduct(
  db: CloudflareD1Database,
  product: { productId: string; cjProductId: string; cjVariantId: string; priceUsd: number; costUsd: number }
): Promise<void> {
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO kcc_commerce_products
    (product_id,cj_product_id,cj_variant_id,price_usd,cost_usd,active,created_at,updated_at)
    VALUES (?,?,?,?,?,1,?,?)
    ON CONFLICT(product_id) DO UPDATE SET
      cj_product_id=excluded.cj_product_id,
      cj_variant_id=excluded.cj_variant_id,
      price_usd=excluded.price_usd,
      cost_usd=excluded.cost_usd,
      active=1,
      updated_at=excluded.updated_at`)
    .bind(product.productId, product.cjProductId, product.cjVariantId, product.priceUsd, product.costUsd, now, now).run();
}

export async function createPayPalCheckoutOrder(
  env: CommerceEnv,
  input: CommerceCheckoutInput
): Promise<{ id: string; status: string; approvalUrl?: string }> {
  await ensureCommerceSchema(env.KCC_DB);
  await ensurePayPalWebhook(env);
  const quantity = Number(input.quantity);
  if (!Number.isInteger(quantity) || quantity <= 0) throw new Error('quantity must be a positive integer');
  for (const key of ['productId','customerName','customerEmail','customerPhone','shippingAddress','shippingCity','shippingCountry','shippingZip'] as const) {
    if (!String(input[key] || '').trim()) throw new Error(`${key} is required`);
  }

  const product = await env.KCC_DB.prepare(
    'SELECT product_id,cj_product_id,cj_variant_id,price_usd,cost_usd,active FROM kcc_commerce_products WHERE product_id=? AND active=1'
  ).bind(input.productId.trim()).first<CommerceProductRow>();
  if (!product) throw new Error('Product is not mapped to an active CJ provider variant');

  const amount = Number((product.price_usd * quantity).toFixed(2));
  const order = await paypalRequest<PayPalOrderData>(env, '/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': crypto.randomUUID() },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        reference_id: product.product_id,
        custom_id: product.product_id,
        amount: { currency_code: 'USD', value: amount.toFixed(2) },
        shipping: {
          name: { full_name: input.customerName.trim() },
          address: {
            address_line_1: input.shippingAddress.trim(),
            admin_area_2: input.shippingCity.trim(),
            country_code: input.shippingCountry.trim().toUpperCase(),
            postal_code: input.shippingZip.trim()
          }
        },
        items: [{
          name: product.product_id,
          unit_amount: { currency_code: 'USD', value: product.price_usd.toFixed(2) },
          quantity: String(quantity)
        }]
      }],
      application_context: {
        shipping_preference: 'SET_PROVIDED_ADDRESS',
        user_action: 'PAY_NOW'
      }
    })
  });

  const approvalUrl = order.links?.find((link) => link.rel === 'approve')?.href;
  const id = String(order.id || '').trim();
  if (!id) throw new Error('PayPal did not return an order ID');

  const now = new Date().toISOString();
  const customer = input.customerName.trim();
  await env.KCC_DB.prepare(`INSERT INTO kcc_commerce_orders (
    id,paypal_order_id,product_id,cj_product_id,cj_variant_id,quantity,amount_usd,
    customer_name,customer_email,customer_phone,shipping_address,shipping_city,
    shipping_country,shipping_zip,payment_status,fulfillment_status,notification_status,
    created_at,updated_at
  ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'CREATED','PENDING','PENDING',?,?)`)
    .bind(id,id,input.productId.trim(),product.cj_product_id,product.cj_variant_id,quantity,amount,
      customer,input.customerEmail.trim(),input.customerPhone.trim(),input.shippingAddress.trim(),
      input.shippingCity.trim(),input.shippingCountry.trim(),input.shippingZip.trim(),now,now).run();

  return { id, status: String(order.status || 'CREATED'), approvalUrl };
}

export async function capturePayPalCheckoutOrder(
  env: CommerceEnv,
  orderId: string
): Promise<PayPalOrderData> {
  await ensureCommerceSchema(env.KCC_DB);
  const result = await paypalRequest<PayPalOrderData>(env, `/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': orderId }
  });
  const status = String(result.status || '');
  const captures = Array.isArray(result.purchase_units)
    ? result.purchase_units.flatMap((unit: any) => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [])
    : [];
  const capture = captures.find((item: any) => item?.status === 'COMPLETED' && typeof item?.id === 'string');
  if (status !== 'COMPLETED' || !capture) throw new Error('PayPal capture is not provider-confirmed COMPLETED');

  const now = new Date().toISOString();
  const captureId = String(capture.id);
  await env.KCC_DB.prepare(
    `UPDATE kcc_commerce_orders SET paypal_capture_id=?, payment_status='COMPLETED', updated_at=? WHERE paypal_order_id=?`
  ).bind(captureId, now, orderId).run();
  return result;
}

export async function handlePayPalWebhook(
  env: CommerceEnv,
  headers: Headers,
  body: unknown
): Promise<{ verified: boolean; eventType: string; enqueued: boolean }> {
  const eventType = String((body as any)?.event_type || '');
  const verified = await verifyPayPalWebhook(env, headers, body);
  if (!verified) throw new Error('PAYPAL_WEBHOOK_SIGNATURE_INVALID');
  if (eventType !== 'PAYMENT.CAPTURE.COMPLETED') return { verified: true, eventType, enqueued: false };

  const resource = (body as any)?.resource || {};
  const captureId = String(resource?.id || '').trim();
  const paypalOrderId = String(resource?.supplementary_data?.related_ids?.order_id || '').trim();
  if (!captureId || !paypalOrderId) throw new Error('PAYPAL_WEBHOOK_MISSING_CAPTURE_CORRELATION');

  const order = await env.KCC_DB.prepare(
    'SELECT * FROM kcc_commerce_orders WHERE paypal_order_id=? OR paypal_capture_id=?'
  ).bind(paypalOrderId, captureId).first<CommerceOrderRow>();
  if (!order) return { verified: true, eventType, enqueued: false };

  const paypal = await paypalRequest<PayPalOrderData>(env, `/v2/checkout/orders/${encodeURIComponent(order.paypal_order_id)}`);
  if (paypal.status !== 'COMPLETED') throw new Error('PAYPAL_WEBHOOK_ORDER_NOT_COMPLETED');

  const capture = Array.isArray(paypal.purchase_units)
    ? paypal.purchase_units.flatMap((unit: any) => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : []).find((item: any) => item?.id === captureId && item?.status === 'COMPLETED')
    : null;
  if (!capture) throw new Error('PAYPAL_WEBHOOK_CAPTURE_NOT_CONFIRMED');

  const now = new Date().toISOString();
  await env.KCC_DB.prepare(
    `UPDATE kcc_commerce_orders SET paypal_capture_id=?,payment_status='COMPLETED',updated_at=? WHERE id=?`
  ).bind(captureId, now, order.id).run();

  if (!env.KCC_TASK_QUEUE) throw new Error('KCC_TASK_QUEUE binding is required for commerce fulfillment');
  const taskId = `CF-COMMERCE-${order.id}`;
  const already = await env.KCC_DB.prepare(
    'SELECT id FROM kcc_runtime_tasks WHERE id=?'
  ).bind(taskId).first();
  if (!already) {
    await env.KCC_DB.prepare(
      `INSERT INTO kcc_runtime_tasks (id,type,payload,status,created_at,updated_at,attempts,last_error,result)
       VALUES (?,?,?,'QUEUED',?,?,0,NULL,NULL)`
    ).bind(taskId,'KCC_COMMERCE_FULFILL',JSON.stringify({ orderId: order.id }),now,now).run();
    await env.KCC_TASK_QUEUE.send({ taskId, type: 'KCC_COMMERCE_FULFILL', payload: { orderId: order.id }, enqueuedAt: now });
  }
  return { verified: true, eventType, enqueued: true };
}

async function cjAccessToken(env: CommerceEnv): Promise<string> {
  const apiKey = required(env, 'CJ_DROPSHIPPING_API_KEY');
  const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apiKey })
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.code !== 200 || typeof payload?.data?.accessToken !== 'string') {
    throw new Error(`CJ authentication failed (${response.status})`);
  }
  return payload.data.accessToken;
}

async function createCJOrder(env: CommerceEnv, order: CommerceOrderRow): Promise<{ cjOrderId: string; providerRequestId: string; status: string }> {
  const token = await cjAccessToken(env);
  const logisticsName = required(env, 'CJ_LOGISTICS_NAME');
  const fromCountryCode = (env.CJ_FROM_COUNTRY_CODE || 'CN').trim().toUpperCase();
  const maxCost = Number(env.KCC_MAX_AUTO_FULFILL_COST_USD || '30');
  const product = await env.KCC_DB.prepare(
    'SELECT cost_usd FROM kcc_commerce_products WHERE product_id=? AND active=1'
  ).bind(order.product_id).first<{ cost_usd:number}>();
  if (!product) throw new Error('CJ product mapping missing for fulfillment');
  const estimatedCost = Number((product.cost_usd * order.quantity).toFixed(2));
  if (!Number.isFinite(estimatedCost) || estimatedCost < 0 || estimatedCost > maxCost) {
    throw new Error(`CJ_FULFILLMENT_COST_BLOCKED:${estimatedCost}:${maxCost}`);
  }

  const response = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2', {
    method: 'POST',
    headers: { 'CJ-Access-Token': token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      orderNumber: `KCC-${order.paypal_order_id}`,
      shippingZip: order.shipping_zip,
      shippingCountryCode: order.shipping_country.toUpperCase(),
      shippingCountry: order.shipping_country,
      shippingProvince: order.shipping_city,
      shippingCity: order.shipping_city,
      shippingAddress: order.shipping_address,
      shippingCustomerName: order.customer_name,
      shippingPhone: order.customer_phone,
      email: order.customer_email,
      remark: `KITORA PayPal order ${order.paypal_order_id}`,
      payType: 2,
      isSandbox: (env.PAYPAL_MODE || 'sandbox').toLowerCase() === 'sandbox' ? 1 : 0,
      logisticName: logisticsName,
      fromCountryCode,
      customOrderType: 1,
      products: [{ vid: order.cj_variant_id, quantity: String(order.quantity) }]
    })
  });
  const payload = await response.json().catch(() => null) as any;
  if (!response.ok || payload?.code !== 200 || !payload?.result) {
    throw new Error(`CJ createOrderV2 failed (${response.status})`);
  }
  const cjOrderId = String(payload?.data?.orderId || payload?.data?.orderCode || '').trim();
  const providerRequestId = String(payload?.requestId || '').trim();
  if (!cjOrderId || !providerRequestId) throw new Error('CJ response lacks provider order/request evidence');
  return {
    cjOrderId,
    providerRequestId,
    status: String(payload?.data?.orderStatus || 'SUBMITTED')
  };
}

async function sendWhatsApp(
  env: CommerceEnv,
  to: string,
  body: string
): Promise<{ messageId: string; providerRequestId: string }> {
  const token = required(env, 'META_WHATSAPP_LIVE_BEARER_TOKEN');
  const phoneNumberId = required(env, 'META_WHATSAPP_PHONE_NUMBER_ID');
  const graphVersion = (env.META_WHATSAPP_GRAPH_VERSION || 'v21.0').trim();
  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${encodeURIComponent(phoneNumberId)}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to,
      type: 'text',
      text: { body }
    })
  });
  const payload = await response.json().catch(() => null) as any;
  const messageId = String(payload?.messages?.[0]?.id || '').trim();
  if (!response.ok || !messageId) throw new Error(`WhatsApp send failed (${response.status})`);
  return {
    messageId,
    providerRequestId: String(response.headers.get('x-fb-request-id') || messageId)
  };
}

export async function executeCommerceFulfillment(env: CommerceEnv, orderId: string): Promise<void> {
  await ensureCommerceSchema(env.KCC_DB);
  if (!isEnabled(env.KCC_AUTOFULFILL_ENABLED)) {
    throw new Error('KCC_AUTOFULFILL_DISABLED');
  }

  const order = await env.KCC_DB.prepare('SELECT * FROM kcc_commerce_orders WHERE id=?').bind(orderId).first<CommerceOrderRow>();
  if (!order) throw new Error('COMMERCE_ORDER_NOT_FOUND');
  if (order.payment_status !== 'COMPLETED') throw new Error('PAYMENT_NOT_PROVIDER_CONFIRMED');
  if (order.fulfillment_status === 'SUBMITTED' && order.cj_order_id) return;

  const fulfillment = await createCJOrder(env, order);
  const sandbox = (env.PAYPAL_MODE || 'sandbox').trim().toLowerCase() !== 'live';
  const now = new Date().toISOString();
  await env.KCC_DB.prepare(
    `UPDATE kcc_commerce_orders
     SET fulfillment_status=?, cj_order_id=?, cj_provider_request_id=?, updated_at=?, last_error=NULL
     WHERE id=?`
  ).bind(sandbox ? 'SANDBOX_SUBMITTED' : 'SUBMITTED', fulfillment.cjOrderId, fulfillment.providerRequestId, now, orderId).run();

  if (!sandbox) {
    await env.KCC_DB.prepare(
      `INSERT INTO kcc_provider_evidence (id,evidence_type,provider_id,provider_verified,external_reference,created_at)
       VALUES (?,?,?,?,?,?)`
    ).bind(
      `REAL-FULFILLMENT-${order.id}`,
      'REAL_FULFILLMENT_EVIDENCE',
      'CJ_DROPSHIPPING',
      1,
      `${fulfillment.cjOrderId}:${fulfillment.providerRequestId}`,
      now
    ).run();
  }

  const text = `KITORA order ${order.paypal_order_id} received and submitted to fulfillment. CJ reference: ${fulfillment.cjOrderId}.`;
  const notice = await sendWhatsApp(env, order.customer_phone, text);
  await env.KCC_DB.prepare(
    `UPDATE kcc_commerce_orders
     SET notification_status='PROVIDER_ACCEPTED',whatsapp_message_id=?,whatsapp_provider_request_id=?,updated_at=?
     WHERE id=?`
  ).bind(notice.messageId, notice.providerRequestId, new Date().toISOString(), orderId).run();
}

export async function listCommerceOrders(db: CloudflareD1Database): Promise<CommerceOrderRow[]> {
  const rows = await db.prepare('SELECT * FROM kcc_commerce_orders ORDER BY created_at DESC LIMIT 100').all<CommerceOrderRow>();
  return rows.results || [];
}


function normalizePhone(value: string): string {
  return String(value || '').replace(/[^0-9]/g, '');
}

async function verifyWhatsAppSignature(secret: string, rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const provided = String(signatureHeader || '');
  if (!provided.startsWith('sha256=')) return false;
  const expectedBytes = await crypto.subtle.sign(
    'HMAC',
    await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    ),
    new TextEncoder().encode(rawBody)
  );
  const expected = 'sha256=' + Array.from(new Uint8Array(expectedBytes)).map((b) => b.toString(16).padStart(2, '0')).join('');
  if (expected.length !== provided.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= expected.charCodeAt(i) ^ provided.charCodeAt(i);
  return diff === 0;
}

export function whatsappWebhookChallenge(env: CommerceEnv, params: URLSearchParams): Response {
  const mode = params.get('hub.mode');
  const token = params.get('hub.verify_token');
  const challenge = params.get('hub.challenge');
  const expected = String((env as any).META_WHATSAPP_WEBHOOK_VERIFY_TOKEN || '').trim();
  if (mode === 'subscribe' && expected && token === expected && challenge) {
    return new Response(challenge, { status: 200, headers: { 'content-type': 'text/plain' } });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function handleWhatsAppWebhook(
  env: CommerceEnv,
  headers: Headers,
  rawBody: string
): Promise<{ verified: boolean; processed: number }> {
  const secret = String((env as any).META_WHATSAPP_APP_SECRET || '').trim();
  if (!secret) throw new Error('META_WHATSAPP_APP_SECRET is required for WhatsApp webhook verification');
  if (!await verifyWhatsAppSignature(secret, rawBody, headers.get('x-hub-signature-256'))) {
    throw new Error('WHATSAPP_WEBHOOK_SIGNATURE_INVALID');
  }

  const body = JSON.parse(rawBody) as any;
  const statuses = Array.isArray(body?.entry)
    ? body.entry.flatMap((entry: any) =>
        Array.isArray(entry?.changes)
          ? entry.changes.flatMap((change: any) => Array.isArray(change?.value?.statuses) ? change.value.statuses : [])
          : []
      )
    : [];

  let processed = 0;
  for (const status of statuses) {
    const state = String(status?.status || '').trim().toLowerCase();
    if (state !== 'delivered' && state !== 'read') continue;
    const messageId = String(status?.id || '').trim();
    const recipient = normalizePhone(String(status?.recipient_id || '').trim());
    if (!messageId || !recipient) continue;

    const order = await env.KCC_DB.prepare(
      "SELECT * FROM kcc_commerce_orders WHERE whatsapp_message_id=? AND notification_status='PROVIDER_ACCEPTED'"
    ).bind(messageId).first<CommerceOrderRow>();

    if (!order || normalizePhone(order.customer_phone) !== recipient) continue;

    const now = new Date().toISOString();
    const nextStatus = state === 'read' ? 'READ' : 'DELIVERED';
    await env.KCC_DB.prepare(
      "UPDATE kcc_commerce_orders SET notification_status=?,updated_at=? WHERE id=? AND notification_status='PROVIDER_ACCEPTED'"
    ).bind(nextStatus, now, order.id).run();

    await env.KCC_DB.prepare(
      "INSERT OR IGNORE INTO kcc_provider_evidence (id,evidence_type,provider_id,provider_verified,external_reference,created_at) VALUES (?,?,?,?,?,?)"
    ).bind(
      `REAL-NOTIFICATION-${messageId}`,
      'REAL_NOTIFICATION_EVIDENCE',
      'WHATSAPP_CLOUD_API',
      1,
      `${messageId}:${state}`,
      now
    ).run();
    processed += 1;
  }

  return { verified: true, processed };
}
