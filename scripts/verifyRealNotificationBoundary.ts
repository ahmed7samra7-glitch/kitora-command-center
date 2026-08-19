import { isRealWhatsAppConfigured, sendRealWhatsAppText } from '../server/realNotificationProvider.js';

async function main() {
  const configured = isRealWhatsAppConfigured();

  if (!configured) {
    let failedClosed = false;
    try {
      await sendRealWhatsAppText('+10000000000', 'KCC notification boundary verification');
    } catch (error) {
      const message = String(error);
      failedClosed =
        message.includes('META_WHATSAPP_LIVE_BEARER_TOKEN is required') ||
        message.includes('META_WHATSAPP_PHONE_NUMBER_ID is required');
    }

    if (!failedClosed) {
      throw new Error('Real WhatsApp provider did not fail closed when credentials were absent');
    }

    console.log('Real notification boundary verification: PASS (fail-closed without credentials)');
    return;
  }

  console.log('Real WhatsApp credentials detected; verification will not send a live message automatically.');
  console.log('Real notification boundary verification: PASS (configuration recognized; mutation skipped)');
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
