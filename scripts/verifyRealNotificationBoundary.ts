import { isRealWhatsAppConfigured, sendRealWhatsAppText } from '../server/realNotificationProvider.js';
import { eventBus } from '../server/eventBus.js';

async function main() {
  const configured = isRealWhatsAppConfigured();

  if (!configured) {
    let directFailedClosed = false;
    try {
      await sendRealWhatsAppText('+10000000000', 'KCC notification boundary verification');
    } catch (error) {
      const message = String(error);
      directFailedClosed = message.includes('META_WHATSAPP_LIVE_BEARER_TOKEN is required') ||
        message.includes('META_WHATSAPP_PHONE_NUMBER_ID is required');
    }

    if (!directFailedClosed) {
      throw new Error('Real WhatsApp provider did not fail closed when credentials were absent');
    }

    let eventFailedClosed = false;
    try {
      eventBus.publish('COMMERCE.CUSTOMER.NOTIFIED', 'Verification', {
        orderId: 'VERIFY-NO-LIVE-CREDENTIALS',
        event: 'ORDER_PLACED'
      });
    } catch (error) {
      eventFailedClosed = String(error).includes('refusing simulated customer notification dispatch');
    }

    if (!eventFailedClosed) {
      throw new Error('Notification EventBus boundary did not fail closed without real WhatsApp configuration');
    }

    console.log('Real notification boundary verification: PASS (provider + event bus fail-closed)');
    return;
  }

  console.log('Real WhatsApp credentials detected; no live mutation was sent by this verification.');
  console.log('Real notification boundary verification: PASS (configuration recognized; mutation skipped)');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
