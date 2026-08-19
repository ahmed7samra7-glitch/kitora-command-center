import { dbRuntime } from './dbStorage.js';
import { payPalRuntime } from './paypal.js';
import { cjDropshippingRuntime } from './cjDropshipping.js';
import { evaluateKccAlive } from './kccAliveGate.js';

export interface SubsystemStatus {
  subsystem: string;
  category: 'Core Agent Runtime' | 'Data & Persistence' | 'Payment & Checkout' | 'Supplier Fulfillment' | 'Customer Communication' | 'Growth & Intelligence';
  classification: 'FUNCTIONAL' | 'PARTIAL' | 'NOT IMPLEMENTED';
  mockEliminated: boolean;
  autonomouslyVerified: boolean;
  description: string;
  evidenceMissing: string;
  details: Record<string, unknown>;
}

export interface LaunchChecklistItem {
  id: number;
  category: string;
  title: string;
  status: 'READY' | 'NOT READY';
  reason: string;
  whatIsMissing: string;
  verificationMethod: string;
}

export interface ProductionAuditReport {
  timestamp: string;
  overallStatus: 'PRODUCTION_BLOCKED' | 'FUNCTIONAL_PENDING_LIVE_CREDENTIALS';
  mockEliminationSummary: {
    totalSubsystemsAudited: number;
    mockFreeSubsystemsCount: number;
    mockFreePercentage: number;
  };
  subsystems: SubsystemStatus[];
  launchChecklist: LaunchChecklistItem[];
  backlogRecommendations: Array<{ priority: string; title: string; impact: string }>;
  kccAlive: ReturnType<typeof evaluateKccAlive>;
}

function hasWhatsAppEvidence(): boolean {
  const history = dbRuntime.get('notificationEvidence') || [];
  return Array.isArray(history) && history.some((item: any) =>
    item?.provider === 'WHATSAPP_CLOUD_API' &&
    item?.deliveryConfirmed === true &&
    item?.signatureValid === true &&
    item?.source === 'whatsapp-webhook'
  );
}

function hasCJLiveEvidence(): boolean {
  const orders = cjDropshippingRuntime.getOrders();
  return Array.isArray(orders) && orders.some((order: any) =>
    cjDropshippingRuntime.isConfigured() &&
    typeof order?.providerRequestId === 'string' &&
    order.providerRequestId.trim().length > 0 &&
    typeof order?.trackingNumber === 'string' &&
    order.trackingNumber.trim().length > 0 &&
    ['SUBMITTED', 'PROCESSING', 'DISPATCHED', 'DELIVERED'].includes(String(order.status))
  );
}

export class ProductionReadinessAuditEngine {
  public purgeDemoData() {
    const orders = dbRuntime.get('liveOrders') || [];
    const realOrdersOnly = orders.filter((order: any) => {
      const email = String(order?.customer?.email || '').toLowerCase();
      const name = String(order?.customer?.name || '').toLowerCase();
      return !email.includes('test') && !name.includes('audit');
    });
    dbRuntime.set('liveOrders', realOrdersOnly);
    return {
      purgedCount: orders.length - realOrdersOnly.length,
      remainingRealOrdersCount: realOrdersOnly.length,
      timestamp: new Date().toISOString()
    };
  }

  public getMockEliminationReport() {
    const catalog = dbRuntime.get('storeCatalog') || [];
    const orders = dbRuntime.get('liveOrders') || [];
    const paypalOrders = payPalRuntime.getSavedOrders();
    const cjOrders = cjDropshippingRuntime.getOrders();
    const whatsappConfigured = Boolean(
      process.env.META_WHATSAPP_LIVE_BEARER_TOKEN?.trim() &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
    );

    return {
      timestamp: new Date().toISOString(),
      mockEliminationStatus: 'EVIDENCE_BASED',
      auditResults: [
        {
          workflow: 'Store Catalog Persistence',
          liveRecordCount: catalog.length,
          status: catalog.length > 0 ? 'OBSERVED' : 'MISSING_EVIDENCE',
          verification: 'Persistent storeCatalog records observed in dbStorage'
        },
        {
          workflow: 'Order Pipeline Persistence',
          liveRecordCount: orders.length,
          status: orders.length > 0 ? 'OBSERVED' : 'MISSING_EVIDENCE',
          verification: 'liveOrders records observed in dbStorage'
        },
        {
          workflow: 'PayPal Runtime',
          liveRecordCount: paypalOrders.length,
          status: paypalOrders.length > 0 ? 'OBSERVED' : 'MISSING_EVIDENCE',
          verification: 'Saved PayPal order records observed; live-mode claim requires live provider evidence'
        },
        {
          workflow: 'CJ Fulfillment Runtime',
          liveRecordCount: cjOrders.length,
          status: hasCJLiveEvidence() ? 'LIVE_PROVIDER_EVIDENCE' : 'BLOCKED',
          verification: hasCJLiveEvidence() ? 'Configured CJ runtime with provider-backed request and tracking evidence' : 'No provider-backed CJ fulfillment evidence with request ID and tracking is present'
        },
        {
          workflow: 'WhatsApp Customer Notification',
          status: whatsappConfigured && hasWhatsAppEvidence() ? 'DELIVERY_EVIDENCE_PRESENT' : 'BLOCKED',
          verification: whatsappConfigured && hasWhatsAppEvidence() ? 'Signed webhook delivery evidence observed' : 'Provider configuration and signed delivery evidence are incomplete'
        },
        {
          workflow: 'Autonomous Background Runtime',
          status: 'NOT_SELF_ATTESTING',
          verification: 'Runtime health is reported separately; readiness does not self-certify as production proof'
        }
      ]
    };
  }

  public async verifyExecutionStep(actionType: string, payload: any): Promise<{ verified: boolean; step: string; verificationDetails: unknown }> {
    switch (actionType) {
      case 'PRODUCT_PUBLISHED': {
        const catalog = dbRuntime.get('storeCatalog') || [];
        const found = catalog.find((item: any) => item.id === payload.productId || item.cjProductId === payload.cjProductId);
        const verified = Boolean(found && found.status === 'PUBLISHED_ACTIVE' && found.isPurchasable === true);
        return {
          verified,
          step: 'Store Catalog Persistence Verification',
          verificationDetails: found ? { title: found.title, price: found.priceUSD, status: found.status } : null
        };
      }

      case 'PAYPAL_PAYMENT_CAPTURED': {
        const orders = payPalRuntime.getSavedOrders();
        const found = orders.find((order: any) => order.id === payload.paypalOrderId);
        const verified = Boolean(found && found.status === 'COMPLETED');
        return {
          verified,
          step: 'PayPal Order Record Verification',
          verificationDetails: found ? { amount: found.amount, currency: found.currency, status: found.status } : null
        };
      }

      case 'CJ_ORDER_FULFILLED': {
        const orders = cjDropshippingRuntime.getOrders();
        const found = orders.find((order: any) => order.cjOrderId === payload.cjOrderId || order.orderId === payload.cjOrderId);
        const verified = Boolean(
          found &&
          cjDropshippingRuntime.isConfigured() &&
          typeof found.providerRequestId === 'string' && found.providerRequestId.trim().length > 0 &&
          typeof found.trackingNumber === 'string' && found.trackingNumber.trim().length > 0 &&
          found.status !== 'PENDING_SUBMISSION'
        );
        return {
          verified,
          step: 'CJ Provider Fulfillment Verification',
          verificationDetails: found ? {
            cjOrderId: found.cjOrderId,
            status: found.status,
            providerRequestId: found.providerRequestId,
            trackingNumber: found.trackingNumber
          } : null
        };
      }

      case 'WHATSAPP_DELIVERY_CONFIRMED': {
        const history = dbRuntime.get('notificationEvidence') || [];
        const found = history.find((item: any) =>
          item?.providerMessageId === payload.providerMessageId &&
          item?.deliveryConfirmed === true &&
          item?.signatureValid === true &&
          item?.source === 'whatsapp-webhook'
        );
        return {
          verified: Boolean(found),
          step: 'Signed WhatsApp Delivery Evidence Verification',
          verificationDetails: found || null
        };
      }

      case 'DATABASE_WRITE_PERSISTED': {
        const data = dbRuntime.get(payload.table || 'storeCatalog') || [];
        const verified = Array.isArray(data) && data.length > 0;
        return {
          verified,
          step: 'dbStorage Persistence Verification',
          verificationDetails: { recordCount: data.length, table: payload.table || 'storeCatalog' }
        };
      }

      default:
        return { verified: false, step: 'Unknown Verification Step', verificationDetails: payload };
    }
  }

  public getLaunchReadinessChecklist(): LaunchChecklistItem[] {
    const whatsappReady = Boolean(
      process.env.META_WHATSAPP_LIVE_BEARER_TOKEN?.trim() &&
      process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim() &&
      process.env.META_WHATSAPP_APP_SECRET?.trim() &&
      hasWhatsAppEvidence()
    );
    const cjReady = cjDropshippingRuntime.isConfigured() && hasCJLiveEvidence();

    return [
      {
        id: 1,
        category: 'Core Runtime',
        title: 'Background Runtime',
        status: 'NOT READY',
        reason: 'Runtime operation is not equivalent to production-readiness proof.',
        whatIsMissing: 'Independent production execution evidence',
        verificationMethod: 'Independent telemetry and uninterrupted production evidence'
      },
      {
        id: 2,
        category: 'Persistence',
        title: 'Task Queue Persistence',
        status: 'READY',
        reason: 'Persistent queue storage is implemented.',
        whatIsMissing: 'None for implementation-level readiness',
        verificationMethod: 'Inspect persisted taskQueue records and recovery tests'
      },
      {
        id: 3,
        category: 'Store',
        title: 'Catalog Persistence',
        status: 'READY',
        reason: 'Persistent catalog records are available.',
        whatIsMissing: 'None for implementation-level readiness',
        verificationMethod: 'GET /api/phase4/store/catalog'
      },
      {
        id: 4,
        category: 'Checkout',
        title: 'Order Pipeline',
        status: 'NOT READY',
        reason: 'End-to-end production evidence is incomplete.',
        whatIsMissing: 'Live PayPal + CJ + notification evidence',
        verificationMethod: 'Real order trace from payment through notification delivery'
      },
      {
        id: 5,
        category: 'CJ Fulfillment',
        title: 'Real Provider Fulfillment',
        status: cjReady ? 'READY' : 'NOT READY',
        reason: cjReady ? 'Configured provider-backed CJ order evidence exists.' : 'No validated live CJ fulfillment evidence.',
        whatIsMissing: cjReady ? 'None' : 'CJ credentials plus provider-backed fulfillment request and tracking evidence',
        verificationMethod: 'CJ provider response linked to persisted order evidence with request ID and tracking'
      },
      {
        id: 6,
        category: 'Customer Communication',
        title: 'WhatsApp Provider + Delivery Evidence',
        status: whatsappReady ? 'READY' : 'NOT READY',
        reason: whatsappReady ? 'Provider credentials and signed delivery evidence exist.' : 'Provider acceptance and signed delivery webhook evidence are incomplete.',
        whatIsMissing: whatsappReady ? 'None' : 'Meta credentials, webhook secret, signed delivery confirmation',
        verificationMethod: 'Signed Meta webhook -> notificationEvidence -> deliveryConfirmed=true'
      },
      {
        id: 7,
        category: 'Production',
        title: 'KCC ALIVE Gate',
        status: 'NOT READY',
        reason: 'ALIVE remains fail-closed until all required real evidence is present.',
        whatIsMissing: 'Fulfillment and notification evidence accepted by kccAliveGate',
        verificationMethod: 'evaluateKccAlive() returns kccAlive=true with fresh signed evidence'
      },
      {
        id: 8,
        category: 'Infrastructure',
        title: 'Public Production Deployment',
        status: 'NOT READY',
        reason: 'Deployment and external infrastructure evidence are not established by this audit.',
        whatIsMissing: 'Verified production deployment, domain, secrets, and external health evidence',
        verificationMethod: 'Independent production health + deployment verification'
      }
    ];
  }

  public getProductionReadinessAudit(): ProductionAuditReport {
    const catalog = dbRuntime.get('storeCatalog') || [];
    const orders = dbRuntime.get('liveOrders') || [];
    const cjLive = hasCJLiveEvidence();
    const whatsappLive = hasWhatsAppEvidence();

    const subsystems: SubsystemStatus[] = [
      {
        subsystem: 'Persistent Store Catalog',
        category: 'Data & Persistence',
        classification: catalog.length > 0 ? 'FUNCTIONAL' : 'PARTIAL',
        mockEliminated: true,
        autonomouslyVerified: catalog.length > 0,
        description: 'Persistent catalog records are observable in dbStorage.',
        evidenceMissing: catalog.length > 0 ? 'No implementation evidence missing.' : 'No catalog records observed.',
        details: { recordCount: catalog.length }
      },
      {
        subsystem: 'Order Persistence',
        category: 'Payment & Checkout',
        classification: orders.length > 0 ? 'FUNCTIONAL' : 'PARTIAL',
        mockEliminated: true,
        autonomouslyVerified: orders.length > 0,
        description: 'Order records are observable in dbStorage.',
        evidenceMissing: orders.length > 0 ? 'Live transaction proof remains external.' : 'No order records observed.',
        details: { recordCount: orders.length }
      },
      {
        subsystem: 'CJ Fulfillment Provider Boundary',
        category: 'Supplier Fulfillment',
        classification: cjLive ? 'FUNCTIONAL' : 'PARTIAL',
        mockEliminated: true,
        autonomouslyVerified: cjLive,
        description: 'CJ production path is fail-closed and only counts provider-backed order evidence with request ID and tracking.',
        evidenceMissing: cjLive ? 'None observed.' : 'CJ credentials plus provider-backed fulfillment evidence with request ID and tracking.',
        details: { configured: cjDropshippingRuntime.isConfigured(), liveEvidence: cjLive }
      },
      {
        subsystem: 'WhatsApp Notification Provider Boundary',
        category: 'Customer Communication',
        classification: whatsappLive ? 'FUNCTIONAL' : 'PARTIAL',
        mockEliminated: true,
        autonomouslyVerified: whatsappLive,
        description: 'WhatsApp acceptance and signed webhook delivery are treated as separate evidence states.',
        evidenceMissing: whatsappLive ? 'None observed.' : 'Signed webhook delivery evidence plus provider configuration.',
        details: { configured: Boolean(process.env.META_WHATSAPP_LIVE_BEARER_TOKEN && process.env.META_WHATSAPP_PHONE_NUMBER_ID), deliveryEvidence: whatsappLive }
      },
      {
        subsystem: 'KCC ALIVE Gate',
        category: 'Core Agent Runtime',
        classification: 'PARTIAL',
        mockEliminated: true,
        autonomouslyVerified: false,
        description: 'Fail-closed readiness gate is active.',
        evidenceMissing: 'Required fresh fulfillment and notification evidence.',
        details: { kccAlive: false }
      }
    ];

    const kccAlive = evaluateKccAlive({ fulfillment: null, notification: null });
    const backlogRecommendations = [
      { priority: 'P0', title: 'Obtain fresh provider-backed CJ fulfillment evidence', impact: 'Required for kccAlive=true.' },
      { priority: 'P0', title: 'Obtain fresh signed WhatsApp delivery evidence', impact: 'Required for kccAlive=true.' },
      { priority: 'P1', title: 'Remove legacy simulated readiness wording outside this audit', impact: 'Prevents stale dashboards from overstating production readiness.' }
    ];

    const mockFreeSubsystemsCount = subsystems.filter((s) => s.mockEliminated && s.autonomouslyVerified).length;
    return {
      timestamp: new Date().toISOString(),
      overallStatus: kccAlive.kccAlive ? 'FUNCTIONAL_PENDING_LIVE_CREDENTIALS' : 'PRODUCTION_BLOCKED',
      mockEliminationSummary: {
        totalSubsystemsAudited: subsystems.length,
        mockFreeSubsystemsCount,
        mockFreePercentage: subsystems.length === 0 ? 0 : Number(((mockFreeSubsystemsCount / subsystems.length) * 100).toFixed(1))
      },
      subsystems,
      launchChecklist: this.getLaunchReadinessChecklist(),
      backlogRecommendations,
      kccAlive
    };
  }
}

export const productionReadinessAuditEngine = new ProductionReadinessAuditEngine();
