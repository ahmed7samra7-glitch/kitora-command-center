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
  mode: 'sandbox' | 'live' | 'simulation';
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
      return 'SIMULATED_PAYPAL_ACCESS_TOKEN_' + Date.now();
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
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in * 1000);
    
    eventBus.publish('PAYPAL.AUTH.SUCCESS', 'PayPalRuntime', {
      mode: this.mode,
      expiresIn: data.expires_in
    });

    return this.accessToken!;
  }

  public async createOrder(req: PayPalOrderRequest): Promise<PayPalOrderRecord> {
    const currency = req.currency || 'USD';
    const amountStr = req.amount.toFixed(2);

    let orderRecord: PayPalOrderRecord;

    if (this.isConfigured()) {
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
      orderRecord = {
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
    } else {
      // Functional operational sandbox simulation
      const orderId = `PP-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      orderRecord = {
        id: orderId,
        status: 'CREATED',
        amount: req.amount,
        currency,
        description: req.description || 'Kitora E-Commerce Order (Sandbox)',
        customId: req.customId,
        checkoutDetails: req.checkoutDetails,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        links: [
          { href: `${this.baseUrl}/v2/checkout/orders/${orderId}`, rel: 'self', method: 'GET' },
          { href: `https://www.sandbox.paypal.com/checkoutnow?token=${orderId}`, rel: 'approve', method: 'GET' },
          { href: `${this.baseUrl}/v2/checkout/orders/${orderId}/capture`, rel: 'capture', method: 'POST' }
        ],
        mode: 'simulation'
      };
    }

    // Save to persistent storage
    const savedOrders = dbRuntime.get('paypalOrders') || [];
    savedOrders.unshift(orderRecord);
    dbRuntime.set('paypalOrders', savedOrders);

    eventBus.publish('PAYPAL.ORDER.CREATED', 'PayPalRuntime', orderRecord);
    return orderRecord;
  }

  public async captureOrder(orderId: string): Promise<PayPalOrderRecord> {
    const savedOrders = dbRuntime.get('paypalOrders') || [];
    const index = savedOrders.findIndex((o: PayPalOrderRecord) => o.id === orderId);

    let updatedRecord: PayPalOrderRecord;

    if (this.isConfigured() && index >= 0 && savedOrders[index].mode !== 'simulation') {
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
      const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id || `CAP-${Date.now()}`;
      
      updatedRecord = {
        ...savedOrders[index],
        status: 'COMPLETED',
        captureId,
        updateTime: new Date().toISOString(),
        payer: data.payer
      };
    } else {
      // Sandbox / Simulation Capture Execution
      const captureId = `CAP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const target = index >= 0 ? savedOrders[index] : {
        id: orderId,
        status: 'CREATED',
        amount: 99.00,
        currency: 'USD',
        description: 'Direct Capture Order',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        mode: 'simulation'
      };

      updatedRecord = {
        ...target,
        status: 'COMPLETED',
        captureId,
        updateTime: new Date().toISOString(),
        payer: {
          email_address: 'buyer@kitora-sandbox.com',
          payer_id: 'PAYER-KITORA-999',
          name: { given_name: 'Autonomous', surname: 'Buyer' }
        }
      };
    }

    if (index >= 0) {
      savedOrders[index] = updatedRecord;
    } else {
      savedOrders.unshift(updatedRecord);
    }
    dbRuntime.set('paypalOrders', savedOrders);

    eventBus.publish('PAYPAL.ORDER.CAPTURED', 'PayPalRuntime', updatedRecord);
    return updatedRecord;
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

    const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.id;

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      // This event is confirmation that PayPal already captured the order. Re-capturing
      // it can produce ORDER_ALREADY_CAPTURED and cause webhook retries. Reconcile only
      // against a locally completed order with capture evidence.
      const savedOrder = this.getSavedOrders().find((order) => order.id === orderId);
      return {
        processed: Boolean(savedOrder?.status === 'COMPLETED' && savedOrder.captureId),
        eventType,
      };
    }

    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      // Capture only an order that is locally marked APPROVED and has not been captured.
      // Missing or inconsistent local state remains fail-closed.
      const savedOrder = this.getSavedOrders().find((order) => order.id === orderId);
      if (!savedOrder || savedOrder.status !== 'APPROVED' || savedOrder.captureId) {
        return { processed: false, eventType };
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
      } else {
        pingSuccess = true; // Simulation mode active
      }
    } catch (e) {
      pingSuccess = false;
    }

    const orders = dbRuntime.get('paypalOrders') || [];

    return {
      configured: this.isConfigured(),
      mode: this.isConfigured() ? this.mode : 'simulation',
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
