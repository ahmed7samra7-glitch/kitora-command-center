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
    entry: [
      {
        changes: [
          {
            value: {
              statuses: [
                {
                  id: 'wamid.VERIFY',
                  status: 'delivered',
                  recipient_id: '15550001111',
                  timestamp: '1760000000',
                },
              ],
            },
          },
        ],
      },
    ],
  });

  const signature = `sha256=${crypto
    .createHmac('sha256', process.env.META_WHATSAPP_APP_SECRET)
    .update(rawBody, 'utf8')
    .digest('hex')}`;

  if (!verifyWhatsAppWebhookSignature(rawBody, signature)) {
    throw new Error('Valid WhatsApp webhook signature was rejected');
  }

  if (verifyWhatsAppWebhookSignature(rawBody, `${signature.slice(0, -1)}0`)) {
    throw new Error('Invalid WhatsApp webhook signature was accepted');
  }

  dbRuntime.set('notificationEvidence', []);
  recordWhatsAppDeliveryEvidence(
    {
      providerMessageId: 'wamid.VERIFY',
      recipientPhone: '15550001111',
      status: 'delivered',
      occurredAt: new Date().toISOString(),
    },
    true,
  );

  const confirmed = getConfirmedWhatsAppEvidence('wamid.VERIFY');
  if (!confirmed?.deliveryConfirmed || confirmed.source !== 'whatsapp-webhook') {
    throw new Error('Webhook delivery evidence was not recorded as confirmed');
  }

  let rejectedUnsigned = false;
  try {
    recordWhatsAppDeliveryEvidence(
      {
        providerMessageId: 'wamid.UNSIGNED',
        recipientPhone: '15550002222',
        status: 'delivered',
        occurredAt: new Date().toISOString(),
      },
      false,
    );
  } catch {
    rejectedUnsigned = true;
  }

  if (!rejectedUnsigned) {
    throw new Error('Unsigned delivery evidence was accepted');
  }

  if (previousSecret === undefined) delete process.env.META_WHATSAPP_APP_SECRET;
  else process.env.META_WHATSAPP_APP_SECRET = previousSecret;

  console.log('WhatsApp delivery evidence verification: PASS');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
