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

export function getWhatsAppWebhookVerifyToken(): string {
  const token = process.env.META_WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim();
  if (!token) throw new Error('META_WHATSAPP_WEBHOOK_VERIFY_TOKEN is required for webhook verification');
  return token;
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

  const history = dbRuntime.get('notificationEvidence') || [];
  const outbound = history.find((item: any) =>
    item?.provider === 'WHATSAPP_CLOUD_API' &&
    item?.providerMessageId === evidence.providerMessageId &&
    item?.source === 'provider-send-response' &&
    item?.deliveryState === 'PROVIDER_ACCEPTED'
  );
  if (!outbound) {
    throw new Error('WhatsApp delivery evidence does not match a previously accepted provider send; refusing orphan evidence');
  }

  const recorded: WhatsAppDeliveryEvidence = {
    ...evidence,
    webhookReceivedAt: new Date().toISOString(),
    signatureValid: true,
  };

  const webhookEntry = {
    provider: 'WHATSAPP_CLOUD_API',
    providerMessageId: recorded.providerMessageId,
    providerRequestId: outbound.providerRequestId,
    recipientPhone: recorded.recipientPhone,
    deliveryConfirmed: true,
    deliveryStatus: recorded.status,
    deliveredAt: recorded.occurredAt,
    observedAt: recorded.occurredAt,
    webhookReceivedAt: recorded.webhookReceivedAt,
    signatureValid: true,
    source: 'whatsapp-webhook',
  };
  dbRuntime.set('notificationEvidence', [webhookEntry, ...history].slice(0, 200));

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
