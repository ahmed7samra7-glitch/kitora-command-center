import { eventBus } from './eventBus.js';
import { dbRuntime } from './dbStorage.js';

export interface PayPalOrderRequest {
  amount: number;
  currency?: string;
  description?: string;
  items?: Array<{
    name: string;
    quantity: number;
    unitAmount: number;
  }>;
  customId?: string;
  checkoutDetails?: PayPalOrderRecord['checkoutDetails'];
}

export interface PayPalOrderRecord {
  id: string;
  status: 'CREATED' | 'SAVED' | 'APPROVED' | 'VOIDED' | 'COMPLETED' | 'PAYER_ACTION_REQUIRED';
  amount: number;
  currency: string;
  description: string;
  customId?: string;
  createTime: string;
  updateTime: string;
  links?: any[];
  captureId?: string;
  payer?: any;
  checkoutDetails?: {
    customerName: string;
    customerEmail: string;
    customerPhone: string;
    shippingAddress: { address: string; city: string; country: string; zip: string };
    productId: string;
    quantity: number;
  };
  mode: 'sandbox' | 'live';
}

class PayPalRuntime {
  private clientId: string;
  private clientSecret: string;
  private mode: 'sandbox' | 'live';
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.mode = (process.env.PAYPAL_MODE as 'sandbox' | 'live') || 'sandbox';
    this.baseUrl = this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  public async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('PayPal credentials are required; refusing simulated access-token generation');
    }

    if (this.accessToken && Date.now() < this.tokenExpiresAt - 30000) {
      return this.accessToken;
    }

    const auth = Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64');
    const response = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`PayPal OAuth failed (${response.status}): ${errText}`);
    }

    const data = await response.json();
    if (typeof data.access_token !== 'string' || !data.access_token.trim()) {
      throw new Error('PayPal OAuth response did not contain a valid access token');
    }
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);

    eventBus.publish('PAYPAL.AUTH.SUCCESS', 'PayPalRuntime', {
      mode: this.mode,
      expiresIn: data.expires_in
    });

    return this.accessToken;
  }

  public async createOrder(req: PayPalOrderRequest): Promise<PayPalOrderRecord> {
    if (!this.isConfigured()) {
      throw new Error('PayPal credentials are required; refusing simulated order creation');
    }

    const currency = req.currency || 'USD';
    const amountStr = req.amount.toFixed(2);
    const token = await this.getAccessToken();
    const body = {
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: req.customId || `REF-${Date.now()}`,
          description: req.description || 'Kitora E-Commerce Order',
          amount: {
            currency_code: currency,
            value: amountStr,
            ...(req.items && req.items.length > 0 ? {
              breakdown: {
                item_total: {
                  currency_code: currency,
                  value: amountStr
                }
              }
            } : {})
          },
          ...(req.items && req.items.length > 0 ? {
            items: req.items.map(item => ({
              name: item.name,
              unit_amount: { currency_code: currency, value: item.unitAmount.toFixed(2) },
              quantity: item.quantity.toString()
            }))
          } : {})
        }
      ]
    };

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal Create Order Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    if (typeof data.id !== 'string' || !data.id.trim()) {
      throw new Error('PayPal Create Order response did not contain a valid order ID');
    }

    const orderRecord: PayPalOrderRecord = {
      id: data.id,
      status: data.status,
      amount: req.amount,
      currency,
      description: req.description || 'Kitora E-Commerce Order',
      customId: req.customId,
      checkoutDetails: req.checkoutDetails,
      createTime: data.create_time || new Date().toISOString(),
      updateTime: data.update_time || new Date().toISOString(),
      links: data.links,
      mode: this.mode
    };

    const savedOrders = dbRuntime.get('paypalOrders') || [];
    savedOrders.unshift(orderRecord);
    dbRuntime.set('paypalOrders', savedOrders);

    eventBus.publish('PAYPAL.ORDER.CREATED', 'PayPalRuntime', orderRecord);
    return orderRecord;
  }

  private async reconcileCapturedOrder(orderId: string, expectedCaptureId?: string): Promise<PayPalOrderRecord | null> {
    const savedOrders = dbRuntime.get('paypalOrders') || [];
    const index = savedOrders.findIndex((o: PayPalOrderRecord) => o.id === orderId);

    if (!this.isConfigured() || index < 0) return null;
    if (savedOrders[index].mode !== this.mode) {
      throw new Error(`PayPal order ${orderId} was created for ${savedOrders[index].mode}, not configured ${this.mode}`);
    }

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${await this.getAccessToken()}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal capture reconciliation failed (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const captures = Array.isArray(data.purchase_units)
      ? data.purchase_units.flatMap((unit: any) => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [])
      : [];
    const completedCapture = captures.find((capture: any) => {
      const id = typeof capture?.id === 'string' ? capture.id.trim() : '';
      return capture?.status === 'COMPLETED' && id && (!expectedCaptureId || id === expectedCaptureId);
    });

    if (data.status !== 'COMPLETED' || !completedCapture) {
      return null;
    }

    const captureId = String(completedCapture.id).trim();
    const updatedRecord: PayPalOrderRecord = {
      ...savedOrders[index],
      status: 'COMPLETED',
      captureId,
      updateTime: new Date().toISOString(),
      payer: data.payer
    };

    savedOrders[index] = updatedRecord;
    dbRuntime.set('paypalOrders', savedOrders);
    eventBus.publish('PAYPAL.ORDER.CAPTURED', 'PayPalRuntime', updatedRecord);
    return updatedRecord;
  }

  public async captureOrder(orderId: string): Promise<PayPalOrderRecord> {
    const savedOrders = dbRuntime.get('paypalOrders') || [];
    const index = savedOrders.findIndex((o: PayPalOrderRecord) => o.id === orderId);

    if (!this.isConfigured()) {
      throw new Error('PayPal credentials are required; refusing simulated capture');
    }
    if (index < 0) {
      throw new Error(`PayPal order ${orderId} is not present in provider-backed local records`);
    }
    if (savedOrders[index].mode !== this.mode) {
      throw new Error(`PayPal order ${orderId} was created for ${savedOrders[index].mode}, not configured ${this.mode}`);
    }
    if (savedOrders[index].status === 'COMPLETED' && savedOrders[index].captureId) {
      throw new Error(`PayPal order ${orderId} is already completed; refusing duplicate capture`);
    }

    if (savedOrders[index].captureId) {
      const reconciled = await this.reconcileCapturedOrder(orderId, savedOrders[index].captureId);
      if (reconciled) return reconciled;
      throw new Error('PayPal capture is already initiated; provider has not yet confirmed completion');
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`PayPal Capture Order Error (${res.status}): ${errText}`);
    }

    const data = await res.json();
    const captures = Array.isArray(data.purchase_units)
      ? data.purchase_units.flatMap((unit: any) => Array.isArray(unit?.payments?.captures) ? unit.payments.captures : [])
      : [];
    const providerCapture = captures.find((capture: any) => {
      const id = typeof capture?.id === 'string' ? capture.id.trim() : '';
      return Boolean(id);
    });

    if (!providerCapture) {
      throw new Error('PayPal capture response was incomplete: a provider capture ID is required');
    }

    const captureId = String(providerCapture.id).trim();
    const pendingRecord: PayPalOrderRecord = {
      ...savedOrders[index],
      captureId,
      updateTime: new Date().toISOString()
    };

    if (data.status !== 'COMPLETED' || providerCapture.status !== 'COMPLETED') {
      savedOrders[index] = pendingRecord;
      dbRuntime.set('paypalOrders', savedOrders);

      const reconciled = await this.reconcileCapturedOrder(orderId, captureId);
      if (reconciled) return reconciled;

      throw new Error('PayPal capture response was incomplete: provider capture is not yet confirmed COMPLETED');
    }

    const completedRecord: PayPalOrderRecord = {
      ...pendingRecord,
      status: 'COMPLETED',
      updateTime: new Date().toISOString(),
      payer: data.payer
    };

    savedOrders[index] = completedRecord;
    dbRuntime.set('paypalOrders', savedOrders);

    eventBus.publish('PAYPAL.ORDER.CAPTURED', 'PayPalRuntime', completedRecord);
    return completedRecord;
  }

  /** Reconciles PayPal webhooks without repeating a completed capture. */
  public async processWebhook(headers: any, body: any): Promise<{ processed: boolean; eventType: string }> {
    const eventType = body?.event_type || 'PAYMENT.CAPTURE.COMPLETED';
    const resource = body?.resource || body;

    eventBus.publish(`PAYPAL.WEBHOOK.${eventType}`, 'PayPalWebhookHandler', {
      headers,
      resource,
      receivedAt: new Date().toISOString()
    });

    const resourceId = typeof resource?.id === 'string' ? resource.id.trim() : '';
    const captureId = eventType === 'PAYMENT.CAPTURE.COMPLETED' ? resourceId : '';
    const orderId = eventType === 'CHECKOUT.ORDER.APPROVED'
      ? resourceId
      : (typeof resource?.supplementary_data?.related_ids?.order_id === 'string'
        ? resource.supplementary_data.related_ids.order_id.trim()
        : '');

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const savedOrder = this.getSavedOrders().find((order) =>
        (orderId && order.id === orderId) ||
        (captureId && order.captureId === captureId)
      );

      if (!savedOrder) {
        return { processed: false, eventType };
      }

      if (
        savedOrder.status === 'COMPLETED' &&
        savedOrder.captureId &&
        (!captureId || savedOrder.captureId === captureId)
      ) {
        return { processed: true, eventType };
      }

      const reconciled = await this.reconcileCapturedOrder(savedOrder.id, captureId || savedOrder.captureId);
      return { processed: Boolean(reconciled), eventType };
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const savedOrder = this.getSavedOrders().find((order) => order.id === orderId);
      if (!savedOrder) {
        return { processed: false, eventType };
      }
      if (savedOrder.status === 'COMPLETED' && savedOrder.captureId) {
        return { processed: true, eventType };
      }
      if (savedOrder.captureId) {
        const reconciled = await this.reconcileCapturedOrder(orderId, savedOrder.captureId);
        return { processed: Boolean(reconciled), eventType };
      }
      await this.captureOrder(orderId);
    }

    return { processed: true, eventType };
  }

  public async getHealthStatus(): Promise<{
    configured: boolean;
    mode: string;
    baseUrl: string;
    pingSuccess: boolean;
    activeOrdersCount: number;
    lastPingTimestamp: string;
  }> {
    let pingSuccess = false;
    try {
      if (this.isConfigured()) {
        await this.getAccessToken();
        pingSuccess = true;
      }
    } catch (e) {
      pingSuccess = false;
    }

    const orders = dbRuntime.get('paypalOrders') || [];

    return {
      configured: this.isConfigured(),
      mode: this.mode,
      baseUrl: this.baseUrl,
      pingSuccess,
      activeOrdersCount: orders.length,
      lastPingTimestamp: new Date().toISOString()
    };
  }

  public getSavedOrders(): PayPalOrderRecord[] {
    return dbRuntime.get('paypalOrders') || [];
  }
}

export const payPalRuntime = new PayPalRuntime();
