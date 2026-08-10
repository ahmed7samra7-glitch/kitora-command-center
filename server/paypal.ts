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
  mode: 'sandbox' | 'live' | 'simulation';
}

class PayPalRuntime {
  private clientId: string;
  private clientSecret: string;
  private mode: 'sandbox' | 'live' | 'simulation';
  private baseUrl: string;
  private accessToken: string | null = null;
  private tokenExpiresAt: number = 0;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID || '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET || '';
    this.mode = (process.env.PAYPAL_MODE as 'sandbox' | 'live' | 'simulation') || 'sandbox';
    this.baseUrl = this.mode === 'live'
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';
  }

  public isConfigured(): boolean {
    return Boolean(this.clientId && this.clientSecret);
  }

  private assertConfiguredForRealPayments(): void {
    if (!this.isConfigured() && this.mode !== 'simulation') {
      throw new Error('PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET, or explicitly set PAYPAL_MODE=simulation for non-payment testing.');
    }
  }

  public async getAccessToken(): Promise<string> {
    if (this.mode === 'simulation') {
      return 'SIMULATED_PAYPAL_ACCESS_TOKEN';
    }

    this.assertConfiguredForRealPayments();

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

    if (this.mode === 'simulation') {
      const orderId = `PP-SIM-ORD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      orderRecord = {
        id: orderId,
        status: 'CREATED',
        amount: req.amount,
        currency,
        description: req.description || 'Kitora E-Commerce Order (Simulation)',
        customId: req.customId,
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        links: [],
        mode: 'simulation'
      };
    } else {
      this.assertConfiguredForRealPayments();
      const token = await this.getAccessToken();
      const body = {
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: req.customId || `REF-${Date.now()}`,
          description: req.description || 'Kitora E-Commerce Order',
          amount: {
            currency_code: currency,
            value: amountStr,
            ...(req.items && req.items.length > 0 ? {
              breakdown: { item_total: { currency_code: currency, value: amountStr } }
            } : {})
          },
          ...(req.items && req.items.length > 0 ? {
            items: req.items.map(item => ({
              name: item.name,
              unit_amount: { currency_code: currency, value: item.unitAmount.toFixed(2) },
              quantity: item.quantity.toString()
            }))
          } : {})
        }]
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
        createTime: data.create_time || new Date().toISOString(),
        updateTime: data.update_time || new Date().toISOString(),
        links: data.links,
        mode: this.mode
      };
    }

    const savedOrders = dbRuntime.get('paypalOrders') || [];
    savedOrders.unshift(orderRecord);
    dbRuntime.set('paypalOrders', savedOrders);
    eventBus.publish('PAYPAL.ORDER.CREATED', 'PayPalRuntime', orderRecord);
    return orderRecord;
  }

  public async captureOrder(orderId: string): Promise<PayPalOrderRecord> {
    const savedOrders = dbRuntime.get('paypalOrders') || [];
    const index = savedOrders.findIndex((o: PayPalOrderRecord) => o.id === orderId);

    if (this.mode === 'simulation') {
      const target = index >= 0 ? savedOrders[index] : {
        id: orderId,
        status: 'CREATED' as const,
        amount: 99.00,
        currency: 'USD',
        description: 'Direct Capture Order (Simulation)',
        createTime: new Date().toISOString(),
        updateTime: new Date().toISOString(),
        mode: 'simulation' as const
      };
      const updatedRecord: PayPalOrderRecord = {
        ...target,
        status: 'COMPLETED',
        captureId: `CAP-SIM-${Date.now()}`,
        updateTime: new Date().toISOString(),
        payer: {
          email_address: 'buyer@kitora-sandbox.com',
          payer_id: 'PAYER-KITORA-SIMULATION',
          name: { given_name: 'Simulation', surname: 'Buyer' }
        }
      };
      if (index >= 0) savedOrders[index] = updatedRecord;
      else savedOrders.unshift(updatedRecord);
      dbRuntime.set('paypalOrders', savedOrders);
      eventBus.publish('PAYPAL.ORDER.CAPTURED', 'PayPalRuntime', updatedRecord);
      return updatedRecord;
    }

    this.assertConfiguredForRealPayments();
    if (index < 0) {
      throw new Error(`PayPal order ${orderId} was not found in persistent order records; refusing synthetic capture.`);
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
    const captureId = data.purchase_units?.[0]?.payments?.captures?.[0]?.id;
    if (!captureId) {
      throw new Error('PayPal capture response did not contain a capture ID; refusing to mark order completed.');
    }

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

  public async processWebhook(headers: any, body: any): Promise<{ processed: boolean; eventType: string }> {
    const eventType = body?.event_type || 'PAYMENT.CAPTURE.COMPLETED';
    const resource = body?.resource || body;

    eventBus.publish(`PAYPAL.WEBHOOK.${eventType}`, 'PayPalWebhookHandler', {
      headers,
      resource,
      receivedAt: new Date().toISOString()
    });

    if (eventType === 'PAYMENT.CAPTURE.COMPLETED' || eventType === 'CHECKOUT.ORDER.APPROVED') {
      const orderId = resource?.supplementary_data?.related_ids?.order_id || resource?.id;
      if (orderId) {
        await this.captureOrder(orderId).catch(() => {});
      }
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
      if (this.mode === 'simulation') {
        pingSuccess = true;
      } else {
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
