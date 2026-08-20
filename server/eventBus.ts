import { EventEmitter } from 'events';
import { dbRuntime } from './dbStorage.js';
import { isRealWhatsAppConfigured, sendRealWhatsAppText } from './realNotificationProvider.js';

export interface BusEvent {
  id: string;
  topic: string;
  source: string;
  traceId?: string;
  payload: any;
  timestamp: string;
}

export type EventSubscriber = (event: BusEvent) => Promise<void> | void;

function buildNotificationBody(event: BusEvent, trackingNumber?: string): string {
  const orderId = String(event.payload?.orderId || 'UNKNOWN');
  const eventType = String(event.payload?.event || 'ORDER_UPDATE');
  if (eventType === 'SHIPPED' && trackingNumber) {
    return `Your KITORA order #${orderId} has shipped. Tracking: ${trackingNumber}`;
  }
  if (eventType === 'DELIVERED') {
    return `Your KITORA order #${orderId} was delivered.`;
  }
  return `Your KITORA order #${orderId} update: ${eventType}.`;
}

class InternalEventBus {
  private emitter: EventEmitter;
  private history: BusEvent[] = [];

  constructor() {
    this.emitter = new EventEmitter();
    this.emitter.setMaxListeners(100);
    const saved = dbRuntime.get('eventLogs');
    if (Array.isArray(saved)) {
      this.history = saved;
    }
  }

  public emit(topic: string, payload: any) {
    return this.publish(topic, 'SYSTEM', payload);
  }

  public publish(topic: string, source: string, payload: any, traceId?: string): BusEvent {
    if (topic === 'COMMERCE.CUSTOMER.NOTIFIED') {
      if (!isRealWhatsAppConfigured()) {
        throw new Error('Real WhatsApp provider is not configured; refusing simulated customer notification dispatch');
      }

      payload.provider = 'WHATSAPP_CLOUD_API';
      payload.deliveryState = 'PROVIDER_DISPATCH_PENDING';
      payload.providerEvidenceRequired = true;
    }

    const event: BusEvent = {
      id: `EVT-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
      topic,
      source,
      traceId: traceId || `TR-${Math.random().toString(36).substring(2, 8).toUpperCase()}`,
      payload,
      timestamp: new Date().toISOString()
    };

    this.history.unshift(event);
    if (this.history.length > 500) {
      this.history = this.history.slice(0, 500);
    }

    dbRuntime.set('eventLogs', this.history);

    if (topic === 'COMMERCE.CUSTOMER.NOTIFIED') {
      setImmediate(() => {
        void this.dispatchRealCustomerNotification(event);
      });
    }

    setImmediate(() => {
      this.emitter.emit(topic, event);
      this.emitter.emit('*', event);
    });

    console.log(`[Event Bus] [${event.topic}] Published by ${source} (ID: ${event.id})`);
    return event;
  }

  private async dispatchRealCustomerNotification(event: BusEvent): Promise<void> {
    const orderId = String(event.payload?.orderId || '');
    const orders = dbRuntime.get('liveOrders') || [];
    const order = orders.find((candidate: any) => candidate.id === orderId || candidate.orderId === orderId);
    const recipientPhone = String(order?.customer?.phone || order?.customerPhone || '').trim();

    if (!recipientPhone) {
      event.payload.deliveryState = 'BLOCKED_MISSING_RECIPIENT';
      event.payload.providerDispatchError = 'No customer phone number available for real WhatsApp dispatch';
      dbRuntime.set('notificationEvidence', this.buildNotificationEvidence(event));
      return;
    }

    try {
      const result = await sendRealWhatsAppText(
        recipientPhone,
        buildNotificationBody(event, String(event.payload?.trackingNumber || '')),
      );
      event.payload.deliveryState = 'PROVIDER_ACCEPTED';
      event.payload.providerMessageId = result.providerMessageId;
      event.payload.providerRequestId = result.providerRequestId;
      event.payload.providerObservedAt = result.observedAt;
      dbRuntime.set('notificationEvidence', this.buildNotificationEvidence(event));
    } catch (error) {
      event.payload.deliveryState = 'PROVIDER_REJECTED';
      event.payload.providerDispatchError = String(error);
      dbRuntime.set('notificationEvidence', this.buildNotificationEvidence(event));
    }
  }

  private buildNotificationEvidence(event: BusEvent) {
    const history = dbRuntime.get('notificationEvidence') || [];
    const evidence = {
      eventId: event.id,
      orderId: event.payload?.orderId,
      event: event.payload?.event,
      provider: event.payload?.provider || 'WHATSAPP_CLOUD_API',
      deliveryState: event.payload?.deliveryState,
      providerMessageId: event.payload?.providerMessageId,
      providerRequestId: event.payload?.providerRequestId,
      observedAt: event.payload?.providerObservedAt || new Date().toISOString(),
      deliveryConfirmed: false,
      source: 'provider-send-response'
    };
    history.unshift(evidence);
    return history.slice(0, 200);
  }

  public subscribe(topic: string, subscriber: EventSubscriber) {
    this.emitter.on(topic, async (event: BusEvent) => {
      try {
        await subscriber(event);
      } catch (err: any) {
        console.error(`[Event Bus Subscriber Error] Topic: ${topic}, Event: ${event.id}`, err);
      }
    });
  }

  public getHistory(topicFilter?: string, limit = 50): BusEvent[] {
    if (!topicFilter || topicFilter === '*') {
      return this.history.slice(0, limit);
    }
    return this.history.filter(e => e.topic.toLowerCase().includes(topicFilter.toLowerCase())).slice(0, limit);
  }

  public clearHistory() {
    this.history = [];
    dbRuntime.set('eventLogs', []);
  }
}

export const eventBus = new InternalEventBus();
