export type PaymentProviderId = 'paypal' | 'stripe';

export interface CreatePaymentInput {
  amount: number;
  currency?: string;
  description?: string;
  returnUrl?: string;
  cancelUrl?: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  provider: PaymentProviderId;
  id: string;
  status: string;
  checkoutUrl?: string;
  raw?: unknown;
}

export interface PaymentProvider {
  readonly id: PaymentProviderId;
  isConfigured(): boolean;
  createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult>;
}

class PayPalPaymentProvider implements PaymentProvider {
  readonly id = 'paypal' as const;

  constructor(private readonly runtime: any) {}

  isConfigured(): boolean {
    return Boolean(this.runtime?.isConfigured?.());
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult> {
    const order = await this.runtime.createOrder({
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customId: input.metadata?.orderId
    });

    const approve = Array.isArray(order.links)
      ? order.links.find((link: any) => link?.rel === 'approve')?.href
      : undefined;

    return {
      provider: this.id,
      id: order.id,
      status: order.status,
      checkoutUrl: approve,
      raw: order
    };
  }
}

class StripePaymentProvider implements PaymentProvider {
  readonly id = 'stripe' as const;

  private readonly secretKey: string;

  constructor(secretKey = process.env.STRIPE_SECRET_KEY || '') {
    this.secretKey = secretKey.trim();
  }

  isConfigured(): boolean {
    return this.secretKey.length > 0;
  }

  async createPayment(input: CreatePaymentInput): Promise<PaymentIntentResult> {
    if (!this.isConfigured()) {
      throw new Error('Stripe payment provider is not configured.');
    }

    const amountMinor = Math.round(input.amount * 100);
    if (!Number.isFinite(amountMinor) || amountMinor <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    const params = new URLSearchParams();
    params.set('amount', String(amountMinor));
    params.set('currency', (input.currency || 'usd').toLowerCase());
    params.set('automatic_payment_methods[enabled]', 'true');
    if (input.description) params.set('description', input.description);

    for (const [key, value] of Object.entries(input.metadata || {})) {
      params.set(`metadata[${key}]`, value);
    }

    const response = await fetch('https://api.stripe.com/v1/payment_intents', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(`Stripe payment creation failed (${response.status}).`);
    }

    return {
      provider: this.id,
      id: String(data.id),
      status: String(data.status || 'requires_payment_method'),
      raw: data
    };
  }
}

export class PaymentRouter {
  private readonly providers = new Map<PaymentProviderId, PaymentProvider>();

  constructor(payPalRuntime: any) {
    this.providers.set('paypal', new PayPalPaymentProvider(payPalRuntime));
    this.providers.set('stripe', new StripePaymentProvider());
  }

  getAvailableProviders(): PaymentProviderId[] {
    return [...this.providers.values()].filter(provider => provider.isConfigured()).map(provider => provider.id);
  }

  getProvider(id: PaymentProviderId): PaymentProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unsupported payment provider: ${id}`);
    return provider;
  }

  async createPayment(providerId: PaymentProviderId, input: CreatePaymentInput): Promise<PaymentIntentResult> {
    return this.getProvider(providerId).createPayment(input);
  }
}
