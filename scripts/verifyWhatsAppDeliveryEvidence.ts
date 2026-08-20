import crypto from 'crypto';
import { dbRuntime } from '../server/dbStorage.js';
import {
  getConfirmedWhatsAppEvidence,
  recordWhatsAppDeliveryEvidence,
  verifyWhatsAppWebhookSignature,
} from '../server/whatsappDeliveryEvidence.js';

async function main() {
  const previousSecret = process.env.META_WHATSAPP_APP_SECRET;
  process.env.META_WHATSAPP_APP_SECRET = 'verification-secret';

  const rawBody = JSON.stringify({
    entry: [{
      changes: [{
        value: { statuses: [{ id: 'wamid.VERIFY', status: 'delivered', recipient_id: '15550001111', timestamp: '1760000000' }] },
      }],
    }],
  });

  const signature = `sha256=${crypto.createHmac('sha256', process.env.META_WHATSAPP_APP_SECRET)
    .update(rawBody, 'utf8').digest('hex')}`;

  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) throw new Error('Valid WhatsApp webhook signature was rejected');
  if (verifyWhatsAppWebhookSignature(rawBody, `${signature.slice(0, -1)}0`)) throw new Error('Invalid WhatsApp webhook signature was accepted');

  dbRuntime.set('notificationEvidence', [{
    provider: 'WHATSAPP_CLOUD_API',
    providerMessageId: 'wamid.VERIFY',
    providerRequestId: 'req.VERIFY',
    deliveryState: 'PROVIDER_ACCEPTED',
    source: 'provider-send-response',
  }]);

  recordWhatsAppDeliveryEvidence({
    providerMessageId: 'wamid.VERIFY',
    recipientPhone: '15550001111',
    status: 'delivered',
    occurredAt: new Date().toISOString(),
  }, true);

  const confirmed = getConfirmedWhatsAppEvidence('wamid.VERIFY');
  if (!confirmed?.deliveryConfirmed || confirmed.source !== 'whatsapp-webhook') throw new Error('Webhook delivery evidence was not recorded as confirmed');

  let orphanRejected = false;
  try {
    recordWhatsAppDeliveryEvidence({
      providerMessageId: 'wamid.ORPHAN',
      recipientPhone: '15550002222',
      status: 'delivered',
      occurredAt: new Date().toISOString(),
    }, true);
  } catch (error) {
    orphanRejected = String(error).includes('does not match a previously accepted provider send');
  }
  if (!orphanRejected) throw new Error('Orphan delivery evidence was accepted');

  let rejectedUnsigned = false;
  try {
    recordWhatsAppDeliveryEvidence({
      providerMessageId: 'wamid.VERIFY',
      recipientPhone: '15550001111',
      status: 'delivered',
      occurredAt: new Date().toISOString(),
    }, false);
  } catch {
    rejectedUnsigned = true;
  }
  if (!rejectedUnsigned) throw new Error('Unsigned delivery evidence was accepted');

  if (previousSecret === undefined) delete process.env.META_WHATSAPP_APP_SECRET;
  else process.env.META_WHATSAPP_APP_SECRET = previousSecret;

  console.log('WhatsApp delivery evidence verification: PASS');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
