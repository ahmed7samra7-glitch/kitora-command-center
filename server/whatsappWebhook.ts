import type { Request, Response } from 'express';
import {
  recordWhatsAppDeliveryEvidence,
  verifyWhatsAppWebhookSignature,
} from './whatsappDeliveryEvidence.js';

export function handleWhatsAppWebhookVerification(req: Request, res: Response): void {
  const mode = String(req.query['hub.mode'] || '');
  const token = String(req.query['hub.verify_token'] || '');
  const challenge = String(req.query['hub.challenge'] || '');
  const expectedToken = process.env.META_WHATSAPP_VERIFY_TOKEN?.trim() || '';

  if (!expectedToken || mode !== 'subscribe' || token !== expectedToken || !challenge) {
    res.status(403).send('Forbidden');
    return;
  }

  res.status(200).send(challenge);
}

export function handleWhatsAppWebhookEvent(req: Request, res: Response): void {
  const signature = String(req.headers['x-hub-signature-256'] || '');
  const rawBody = typeof (req as any).rawBody === 'string'
    ? (req as any).rawBody
    : JSON.stringify(req.body ?? {});

  let signatureValid = false;
  try {
    signatureValid = verifyWhatsAppWebhookSignature(rawBody, signature);
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    res.status(401).json({ success: false, error: 'Invalid WhatsApp webhook signature' });
    return;
  }

  try {
    const entries = Array.isArray(req.body?.entry) ? req.body.entry : [];
    let recorded = 0;

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const statuses = Array.isArray(change?.value?.statuses) ? change.value.statuses : [];
        for (const status of statuses) {
          const providerMessageId = String(status?.id || '').trim();
          const recipientPhone = String(status?.recipient_id || '').trim();
          const deliveryStatus = String(status?.status || '').trim();
          if (!providerMessageId || !recipientPhone) continue;
          if (deliveryStatus !== 'delivered' && deliveryStatus !== 'read') continue;

          const timestamp = Number(status?.timestamp);
          const occurredAt = Number.isFinite(timestamp) && timestamp > 0
            ? new Date(timestamp * 1000).toISOString()
            : new Date().toISOString();

          recordWhatsAppDeliveryEvidence({
            providerMessageId,
            recipientPhone,
            status: deliveryStatus as 'delivered' | 'read',
            occurredAt,
          }, true);
          recorded += 1;
        }
      }
    }

    res.status(200).json({ success: true, recorded });
  } catch (error) {
    res.status(400).json({ success: false, error: String(error) });
  }
}
