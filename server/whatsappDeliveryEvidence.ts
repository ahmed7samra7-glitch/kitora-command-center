import crypto from 'crypto';
import { dbRuntime } from './dbStorage.js';

export interface WhatsAppDeliveryEvidence {
  providerMessageId: string;
  recipientPhone: string;
  status: 'sent' | 'delivered' | 'read' | 'failed';
  occurredAt: string;
  webhookReceivedAt: string;
  signatureValid: boolean;
}

function requireWebhookSecret(): string {
  const secret = process.env.META_WHATSAPP_APP_SECRET?.trim();
  if (!secret) throw new Error('META_WHATSAPP_APP_SECRET is required for webhook evidence verification');
  return secret;
}

export function verifyWhatsAppWebhookSignature(rawBody: string, signatureHeader: string): boolean {
  const secret = requireWebhookSecret();
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody, 'utf8').digest('hex')}`;
  const provided = String(signatureHeader || '');
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function recordWhatsAppDeliveryEvidence(
  evidence: Omit<WhatsAppDeliveryEvidence, 'webhookReceivedAt' | 'signatureValid'>,
  signatureValid: boolean,
): WhatsAppDeliveryEvidence {
  if (!signatureValid) throw new Error('Invalid WhatsApp webhook signature; refusing delivery evidence');
  if (!evidence.providerMessageId.trim()) throw new Error('providerMessageId is required');
  if (!evidence.recipientPhone.trim()) throw new Error('recipientPhone is required');
  if (evidence.status !== 'delivered' && evidence.status !== 'read') {
    throw new Error(`Delivery evidence requires delivered/read status, received ${evidence.status}`);
  }

  const recorded: WhatsAppDeliveryEvidence = {
    ...evidence,
    webhookReceivedAt: new Date().toISOString(),
    signatureValid: true,
  };

  const history = dbRuntime.get('notificationEvidence') || [];
  const updated = history.map((item: any) =>
    item.providerMessageId === recorded.providerMessageId
      ? { ...item, deliveryConfirmed: true, deliveryStatus: recorded.status, deliveredAt: recorded.occurredAt, webhookReceivedAt: recorded.webhookReceivedAt, signatureValid: true, source: 'whatsapp-webhook' }
      : item,
  );
  if (!updated.some((item: any) => item.providerMessageId === recorded.providerMessageId)) {
    updated.unshift({
      provider: 'WHATSAPP_CLOUD_API',
      providerMessageId: recorded.providerMessageId,
      recipientPhone: recorded.recipientPhone,
      deliveryConfirmed: true,
      deliveryStatus: recorded.status,
      deliveredAt: recorded.occurredAt,
      webhookReceivedAt: recorded.webhookReceivedAt,
      signatureValid: true,
      source: 'whatsapp-webhook',
    });
  }
  dbRuntime.set('notificationEvidence', updated.slice(0, 200));

  return recorded;
}

export function getConfirmedWhatsAppEvidence(providerMessageId: string) {
  const history = dbRuntime.get('notificationEvidence') || [];
  return history.find((item: any) =>
    item.providerMessageId === providerMessageId &&
    item.deliveryConfirmed === true &&
    item.signatureValid === true &&
    item.source === 'whatsapp-webhook'
  ) || null;
}
