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
  source: 'live-provider';
  providerRequestId: string;
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
  source: 'live-provider';
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
    if (!this.isConfigured()) {
      throw new Error('CJ production credentials are missing; refusing synthetic catalog data');
    }

    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/product/list?pageNum=1&pageSize=${limit}&keywords=${encodeURIComponent(keyword)}`, {
      method: 'GET',
      headers: { 'CJ-Access-Token': token }
    });
    const data = await res.json().catch(() => null);
    if (!res.ok || !Array.isArray(data?.data?.list)) {
      throw new Error(`CJ product sync failed (${res.status}): ${data?.message || 'No provider catalog returned'}`);
    }

    const providerRequestId = String(data.requestId || res.headers.get('x-request-id') || '').trim();
    if (!providerRequestId) throw new Error('CJ product sync returned no provider request ID');
    const syncedAt = new Date().toISOString();
    const products: CJProduct[] = data.data.list.map((item: any) => {
      const requiredFields = ['pid', 'productNameEn', 'productSku', 'sellPrice', 'costPrice', 'inventory'];
      if (requiredFields.some((field) => item?.[field] === undefined || item?.[field] === null || String(item[field]).trim() === '')) {
        throw new Error('CJ product sync returned incomplete provider product data');
      }
      const variants = Array.isArray(item.variants) ? item.variants : [];
      if (variants.length === 0) throw new Error(`CJ product ${item.pid} returned no provider variants`);
      const sellPrice = Number(item.sellPrice);
      const costPrice = Number(item.costPrice);
      if (!Number.isFinite(sellPrice) || !Number.isFinite(costPrice) || sellPrice <= 0 || costPrice < 0) {
        throw new Error(`CJ product ${item.pid} returned invalid pricing`);
      }
      const margin = ((sellPrice - costPrice) / sellPrice) * 100;
      return {
        pid: String(item.pid),
        productName: String(item.productNameEn || item.productName),
        productSku: String(item.productSku),
        categoryName: String(item.categoryName || ''),
        productImage: String(item.productImage || ''),
        sellPrice,
        costPrice,
        netMarginPercentage: Number(margin.toFixed(2)),
        inventoryCount: Number(item.inventory),
        supplierRiskScore: Number(item.supplierRiskScore || 0),
        variants: variants.map((variant: any) => ({
          vid: String(variant.vid),
          variantSku: String(variant.variantSku),
          variantName: String(variant.variantName),
          variantPrice: Number(variant.variantPrice),
          stock: Number(variant.stock),
        })),
        syncedAt,
        source: 'live-provider',
        providerRequestId,
      };
    });
    if (products.length === 0) throw new Error('CJ provider returned no catalog products; refusing synthetic catalog data');

    dbRuntime.set('cjProducts', products);
    eventBus.publish('CJ.PRODUCTS.SYNCED', 'CJDropshippingRuntime', { count: products.length, source: 'live-provider', providerRequestId });
    return products;
  }

  public async syncInventory(): Promise<{ totalSkus: number; totalUnits: number; updatedAt: string }> {
    let products = (dbRuntime.get('cjProducts') || []).filter((product: CJProduct) => product?.source === 'live-provider');
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

    const products = (dbRuntime.get('cjProducts') || []).filter((product: CJProduct) => product?.source === 'live-provider');
    const resolvedProducts = req.products.map((item) => {
      const match = products.find((p: CJProduct) => p.pid === item.pid);
      if (!match) throw new Error(`Product ${item.pid} is not backed by a live CJ catalog response`);
      const vid = item.vid || match.variants?.[0]?.vid;
      if (!vid) throw new Error(`No CJ variant ID available for product ${item.pid}`);
      return { ...item, vid, match };
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

    const providerRequestId = String(data.requestId || res.headers.get('x-request-id') || '').trim();
    if (!providerRequestId) throw new Error('CJ createOrderV2 returned no provider request ID');
    const totalCost = resolvedProducts.reduce((sum, item) => sum + item.match.costPrice * item.quantity, 0);

    const cjOrderId = String(data.data.orderId);
    const orderRecord: CJOrderRecord = {
      orderId: cjOrderId,
      cjOrderId,
      status: data.data.orderStatus === 'SHIPPED' ? 'DISPATCHED' : 'SUBMITTED',
      shippingName: req.shippingName,
      shippingCountry: req.shippingCountry,
      totalCost: parseFloat(totalCost.toFixed(2)),
      paypalOrderId: req.paypalOrderId,
      providerRequestId,
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      source: 'live-provider'
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
      providerRequestId: String(data.requestId || res.headers.get('x-request-id') || current.providerRequestId || '').trim(),
      updatedAt: new Date().toISOString(),
      source: 'live-provider'
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
    return (dbRuntime.get('cjProducts') || []).filter((product: CJProduct) => product?.source === 'live-provider');
  }

  public getOrders(): CJOrderRecord[] {
    return dbRuntime.get('cjOrders') || [];
  }
}

export const cjDropshippingRuntime = new CJDropshippingRuntime();
