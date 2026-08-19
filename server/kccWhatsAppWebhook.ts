import type { Request, Response, Express } from 'express';
import {
  getWhatsAppWebhookVerifyToken,
  recordWhatsAppDeliveryEvidence,
  verifyWhatsAppWebhookSignature,
} from './whatsappDeliveryEvidence.js';

function extractStatuses(body: any): Array<{ id: string; status: string; recipient_id?: string; timestamp?: string }> {
  const statuses: Array<{ id: string; status: string; recipient_id?: string; timestamp?: string }> = [];
  for (const entry of Array.isArray(body?.entry) ? body.entry : []) {
    for (const change of Array.isArray(entry?.changes) ? entry.changes : []) {
      for (const status of Array.isArray(change?.value?.statuses) ? change.value.statuses : []) {
        if (typeof status?.id === 'string' && typeof status?.status === 'string') {
          statuses.push({
            id: status.id,
            status: status.status,
            recipient_id: typeof status.recipient_id === 'string' ? status.recipient_id : undefined,
            timestamp: typeof status.timestamp === 'string' ? status.timestamp : undefined,
          });
        }
      }
    }
  }
  return statuses;
}

export function registerWhatsAppWebhook(app: Express): void {
  app.get('/api/whatsapp/webhook', (req: Request, res: Response) => {
    const mode = String(req.query['hub.mode'] || '');
    const token = String(req.query['hub.verify_token'] || '');
    const challenge = String(req.query['hub.challenge'] || '');

    if (mode !== 'subscribe' || !challenge) {
      res.status(400).send('Invalid webhook verification request');
      return;
    }

    try {
      const expected = getWhatsAppWebhookVerifyToken();
      if (!expected || token !== expected) {
        res.status(403).send('Webhook verification failed');
        return;
      }
      res.status(200).send(challenge);
    } catch {
      res.status(503).send('Webhook verification unavailable');
    }
  });

  app.post('/api/whatsapp/webhook', (req: Request, res: Response) => {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody;
    const signature = String(req.headers['x-hub-signature-256'] || '');

    if (!rawBody) {
      res.status(400).json({ success: false, error: 'Raw webhook body unavailable; refusing unsigned verification' });
      return;
    }

    try {
      if (!verifyWhatsAppWebhookSignature(rawBody.toString('utf8'), signature)) {
        res.status(401).json({ success: false, error: 'Invalid WhatsApp webhook signature' });
        return;
      }

      const statuses = extractStatuses(req.body);
      let confirmedCount = 0;

      for (const status of statuses) {
        if (status.status !== 'delivered' && status.status !== 'read') continue;
        if (!status.recipient_id) continue;

        const occurredAt = status.timestamp && /^\d+$/.test(status.timestamp)
          ? new Date(Number(status.timestamp) * 1000).toISOString()
          : new Date().toISOString();

        recordWhatsAppDeliveryEvidence({
          providerMessageId: status.id,
          recipientPhone: status.recipient_id,
          status: status.status,
          occurredAt,
        }, true);
        confirmedCount += 1;
      }

      res.status(200).json({ success: true, confirmedCount });
    } catch (error) {
      res.status(400).json({ success: false, error: String(error) });
    }
  });
}
