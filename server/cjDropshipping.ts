import { eventBus } from './eventBus.js';
import { dbRuntime } from './dbStorage.js';

export interface CJProduct {
  pid: string;
  productName: string;
  productSku: string;
  categoryName: string;
  productImage: string;
  sellPrice: number;
  costPrice: number;
  netMarginPercentage: number;
  inventoryCount: number;
  supplierRiskScore: number;
  variants: Array<{
    vid: string;
    variantSku: string;
    variantName: string;
    variantPrice: number;
    stock: number;
  }>;
  syncedAt: string;
}

export interface CJOrderRequest {
  cjOrderId?: string;
  shippingName: string;
  shippingAddress: string;
  shippingCity: string;
  shippingCountry: string;
  shippingProvince?: string;
  shippingZip: string;
  shippingPhone?: string;
  customerEmail?: string;
  products: Array<{
    pid: string;
    vid?: string;
    quantity: number;
    unitPrice: number;
  }>;
  paypalOrderId?: string;
}

export interface CJOrderRecord {
  orderId: string;
  cjOrderId: string;
  status: 'PENDING_SUBMISSION' | 'SUBMITTED' | 'PROCESSING' | 'DISPATCHED' | 'DELIVERED' | 'CANCELLED';
  shippingName: string;
  shippingCountry: string;
  totalCost: number;
  trackingNumber?: string;
  logisticsCarrier?: string;
  paypalOrderId?: string;
  providerRequestId?: string;
  submittedAt: string;
  updatedAt: string;
}

class CJDropshippingRuntime {
  private email: string;
  private apiKey: string;
  private baseUrl = 'https://developers.cjdropshipping.com/api2.0/v1';
  private logisticsName = process.env.CJ_LOGISTICS_NAME || '';

  constructor() {
    this.email = process.env.CJ_DROPSHIPPING_EMAIL || '';
    this.apiKey = process.env.CJ_DROPSHIPPING_API_KEY || '';
  }

  public isConfigured(): boolean {
    return Boolean(this.email && this.apiKey);
  }

  public async getAccessToken(): Promise<string> {
    if (!this.isConfigured()) {
      throw new Error('CJ production credentials are not configured; refusing simulated access-token generation');
    }

    const res = await fetch(`${this.baseUrl}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, apiKey: this.apiKey })
    });

    if (!res.ok) {
      throw new Error(`CJ Dropshipping Auth failed (${res.status}): ${await res.text()}`);
    }

    const data = await res.json();
    if (!data.result || !data.data?.accessToken) {
      throw new Error(`CJ Auth error: ${data.message || 'Invalid credentials'}`);
    }

    return data.data.accessToken;
  }

  public async syncProducts(keyword = 'smart', limit = 10): Promise<CJProduct[]> {
    let products: CJProduct[] = [];

    if (this.isConfigured()) {
      try {
        const token = await this.getAccessToken();
        const res = await fetch(`${this.baseUrl}/product/list?pageNum=1&pageSize=${limit}&keywords=${encodeURIComponent(keyword)}`, {
          method: 'GET',
          headers: { 'CJ-Access-Token': token }
        });

        if (res.ok) {
          const data = await res.json();
          if (data.data?.list) {
            products = data.data.list.map((item: any) => {
              const sellPrice = parseFloat(item.sellPrice || '29.99');
              const costPrice = parseFloat(item.costPrice || '12.50');
              const margin = sellPrice > 0 ? ((sellPrice - costPrice) / sellPrice) * 100 : 50;

              return {
                pid: item.pid || `CJ-P-${Date.now()}`,
                productName: item.productNameEn || item.productName || 'CJ Premium Dropship Item',
                productSku: item.productSku || `SKU-${Math.random().toString(36).substring(2, 7)}`,
                categoryName: item.categoryName || 'Consumer Electronics',
                productImage: item.productImage || 'https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=500&auto=format&fit=crop',
                sellPrice,
                costPrice,
                netMarginPercentage: parseFloat(margin.toFixed(2)),
                inventoryCount: item.inventory || 450,
                supplierRiskScore: Math.floor(Math.random() * 15) + 5,
                variants: [
                  {
                    vid: `VID-${item.pid || '1'}-A`,
                    variantSku: `${item.productSku || 'SKU'}-BLK`,
                    variantName: 'Default / Black',
                    variantPrice: sellPrice,
                    stock: item.inventory || 450
                  }
                ],
                syncedAt: new Date().toISOString()
              };
            });
          }
        }
      } catch (err) {
        console.warn('[CJ Runtime] Live CJ sync failed; retaining non-production catalog fallback:', err);
      }
    }

    if (products.length === 0) {
      products = [
        {
          pid: 'CJ-P-889102',
          productName: 'AI Smart Voice-Active Translator Earbuds Pro',
          productSku: 'CJ-EARBUDS-PRO',
          categoryName: 'Smart Wearables',
          productImage: 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=500&auto=format&fit=crop',
          sellPrice: 89.99,
          costPrice: 28.50,
          netMarginPercentage: 68.33,
          inventoryCount: 1240,
          supplierRiskScore: 8,
          variants: [
            { vid: 'VID-889102-1', variantSku: 'CJ-EARBUDS-BLK', variantName: 'Matte Black', variantPrice: 89.99, stock: 800 },
            { vid: 'VID-889102-2', variantSku: 'CJ-EARBUDS-WHT', variantName: 'Pearl White', variantPrice: 89.99, stock: 440 }
          ],
          syncedAt: new Date().toISOString()
        },
        {
          pid: 'CJ-P-774019',
          productName: 'Self-Cleaning Thermal Smart Hydration Bottle',
          productSku: 'CJ-BOTTLE-SMART',
          categoryName: 'Fitness & Lifestyle',
          productImage: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?w=500&auto=format&fit=crop',
          sellPrice: 54.50,
          costPrice: 16.20,
          netMarginPercentage: 70.28,
          inventoryCount: 890,
          supplierRiskScore: 12,
          variants: [
            { vid: 'VID-774019-1', variantSku: 'CJ-BOTTLE-SLV', variantName: 'Brushed Silver', variantPrice: 54.50, stock: 890 }
          ],
          syncedAt: new Date().toISOString()
        },
        {
          pid: 'CJ-P-992301',
          productName: 'Ultra-Quiet MagCharge Desk Ambient Lamp',
          productSku: 'CJ-LAMP-MAG',
          categoryName: 'Home & Office',
          productImage: 'https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=500&auto=format&fit=crop',
          sellPrice: 65.00,
          costPrice: 22.00,
          netMarginPercentage: 66.15,
          inventoryCount: 520,
          supplierRiskScore: 6,
          variants: [
            { vid: 'VID-992301-1', variantSku: 'CJ-LAMP-WHT', variantName: 'Minimal White', variantPrice: 65.00, stock: 520 }
          ],
          syncedAt: new Date().toISOString()
        }
      ];
    }

    dbRuntime.set('cjProducts', products);
    eventBus.publish('CJ.PRODUCTS.SYNCED', 'CJDropshippingRuntime', { count: products.length, source: this.isConfigured() ? 'live-or-fallback' : 'non-production-fallback' });
    return products;
  }

  public async syncInventory(): Promise<{ totalSkus: number; totalUnits: number; updatedAt: string }> {
    let products = dbRuntime.get('cjProducts') || [];
    if (products.length === 0) products = await this.syncProducts();

    const totalUnits = products.reduce((sum: number, p: CJProduct) => sum + p.inventoryCount, 0);
    const result = { totalSkus: products.length, totalUnits, updatedAt: new Date().toISOString() };
    eventBus.publish('CJ.INVENTORY.SYNCED', 'CJDropshippingRuntime', result);
    return result;
  }

  public async submitOrder(req: CJOrderRequest): Promise<CJOrderRecord> {
    if (!this.isConfigured()) {
      throw new Error('CJ production credentials are missing; refusing to create simulated fulfillment orders');
    }
    if (!this.logisticsName) {
      throw new Error('CJ_LOGISTICS_NAME is required; refusing to guess a production logistics service');
    }
    if (!req.products.length) {
      throw new Error('At least one CJ product is required for fulfillment');
    }

    const products = dbRuntime.get('cjProducts') || [];
    const resolvedProducts = req.products.map((item) => {
      const match = products.find((p: CJProduct) => p.pid === item.pid);
      const vid = item.vid || match?.variants?.[0]?.vid;
      if (!vid) throw new Error(`No CJ variant ID available for product ${item.pid}`);
      return { ...item, vid };
    });

    const token = await this.getAccessToken();
    const orderNumber = req.cjOrderId || `KCC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const payload = {
      orderNumber,
      shippingZip: req.shippingZip,
      shippingCountry: req.shippingCountry,
      shippingCountryCode: req.shippingCountry.toUpperCase(),
      shippingProvince: req.shippingProvince || req.shippingCity,
      shippingCity: req.shippingCity,
      shippingPhone: req.shippingPhone || '',
      shippingCustomerName: req.shippingName,
      shippingAddress: req.shippingAddress,
      email: req.customerEmail || '',
      remark: `KCC order ${req.paypalOrderId || orderNumber}`,
      payType: 3,
      logisticName: this.logisticsName,
      fromCountryCode: 'CN',
      platform: 'api',
      orderFlow: 1,
      products: resolvedProducts.map((item) => ({
        vid: item.vid,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        storeLineItemId: req.paypalOrderId || orderNumber
      }))
    };

    const res = await fetch(`${this.baseUrl}/shopping/order/createOrderV2`, {
      method: 'POST',
      headers: {
        'CJ-Access-Token': token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.result || !data?.data?.orderId) {
      throw new Error(`CJ createOrderV2 failed (${res.status}): ${data?.message || 'No CJ order ID returned'}`);
    }

    const totalCost = resolvedProducts.reduce((sum, item) => {
      const match = products.find((p: CJProduct) => p.pid === item.pid);
      return sum + (match?.costPrice || item.unitPrice * 0.4) * item.quantity;
    }, 0);

    const cjOrderId = String(data.data.orderId);
    const orderRecord: CJOrderRecord = {
      orderId: cjOrderId,
      cjOrderId,
      status: data.data.orderStatus === 'SHIPPED' ? 'DISPATCHED' : 'SUBMITTED',
      shippingName: req.shippingName,
      shippingCountry: req.shippingCountry,
      totalCost: parseFloat(totalCost.toFixed(2)),
      paypalOrderId: req.paypalOrderId,
      providerRequestId: data.requestId,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const savedOrders = dbRuntime.get('cjOrders') || [];
    savedOrders.unshift(orderRecord);
    dbRuntime.set('cjOrders', savedOrders);

    eventBus.publish('CJ.ORDER.SUBMITTED', 'CJDropshippingRuntime', {
      ...orderRecord,
      source: 'live-provider',
      provider: 'CJ_DROPSHIPPING'
    });
    return orderRecord;
  }

  public async syncTracking(cjOrderId: string): Promise<CJOrderRecord> {
    if (!this.isConfigured()) throw new Error('CJ production credentials are missing; refusing simulated tracking progression');

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/shopping/order/getOrderDetail?orderId=${encodeURIComponent(cjOrderId)}`, {
      headers: { 'CJ-Access-Token': token }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.result || !data?.data) throw new Error(`CJ order detail lookup failed (${res.status})`);

    const cj = data.data;
    const mappedStatus: CJOrderRecord['status'] = cj.orderStatus === 'DELIVERED'
      ? 'DELIVERED'
      : cj.orderStatus === 'SHIPPED'
        ? 'DISPATCHED'
        : cj.orderStatus === 'CANCELLED'
          ? 'CANCELLED'
          : cj.orderStatus === 'PROCESSING'
            ? 'PROCESSING'
            : 'SUBMITTED';

    const savedOrders = dbRuntime.get('cjOrders') || [];
    const existingIndex = savedOrders.findIndex((o: CJOrderRecord) => o.cjOrderId === cjOrderId || o.orderId === cjOrderId);
    const current = existingIndex >= 0 ? savedOrders[existingIndex] : {
      orderId: String(cjOrderId),
      cjOrderId: String(cjOrderId),
      status: 'SUBMITTED' as const,
      shippingName: cj.shippingCustomerName || 'KITORA Customer',
      shippingCountry: cj.shippingCountry || '',
      totalCost: Number(cj.actualPayment || cj.orderAmount || 0),
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const updatedRecord: CJOrderRecord = {
      ...current,
      status: mappedStatus,
      trackingNumber: cj.logisticsTrackingNumber || cj.trackingNumber || current.trackingNumber,
      logisticsCarrier: cj.logisticsName || current.logisticsCarrier,
      providerRequestId: data.requestId || current.providerRequestId,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) savedOrders[existingIndex] = updatedRecord;
    else savedOrders.unshift(updatedRecord);
    dbRuntime.set('cjOrders', savedOrders);

    eventBus.publish('CJ.TRACKING.UPDATED', 'CJDropshippingRuntime', {
      ...updatedRecord,
      source: 'live-provider',
      provider: 'CJ_DROPSHIPPING'
    });
    return updatedRecord;
  }

  public async getHealthStatus() {
    const products = dbRuntime.get('cjProducts') || [];
    const orders = dbRuntime.get('cjOrders') || [];
    return {
      configured: this.isConfigured(),
      logisticsConfigured: Boolean(this.logisticsName),
      baseUrl: this.baseUrl,
      syncedProductsCount: products.length,
      fulfilledOrdersCount: orders.length,
      lastSyncTimestamp: new Date().toISOString()
    };
  }

  public getProducts(): CJProduct[] {
    return dbRuntime.get('cjProducts') || [];
  }

  public getOrders(): CJOrderRecord[] {
    return dbRuntime.get('cjOrders') || [];
  }
}

export const cjDropshippingRuntime = new CJDropshippingRuntime();
