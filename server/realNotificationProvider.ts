export type WhatsAppSendResult = {
  provider: 'WHATSAPP_CLOUD_API';
  accepted: true;
  providerMessageId: string;
  providerRequestId: string;
  observedAt: string;
};

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required for real WhatsApp notifications`);
  return value;
}

function graphVersion(): string {
  return process.env.META_WHATSAPP_GRAPH_VERSION?.trim() || 'v21.0';
}

export function isRealWhatsAppConfigured(): boolean {
  return Boolean(
    process.env.META_WHATSAPP_LIVE_BEARER_TOKEN?.trim() &&
    process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim()
  );
}

export async function sendRealWhatsAppText(
  recipientPhone: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const token = required('META_WHATSAPP_LIVE_BEARER_TOKEN');
  const phoneNumberId = required('META_WHATSAPP_PHONE_NUMBER_ID');
  const to = recipientPhone.trim();
  if (!to) throw new Error('recipientPhone is required for real WhatsApp notifications');
  if (!body.trim()) throw new Error('body is required for real WhatsApp notifications');

  const response = await fetch(
    `https://graph.facebook.com/${graphVersion()}/${encodeURIComponent(phoneNumberId)}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to,
        type: 'text',
        text: { body },
      }),
    },
  );

  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`WhatsApp Cloud API send failed (${response.status}): ${JSON.stringify(payload)}`);
  }

  const providerMessageId = payload?.messages?.[0]?.id;
  if (typeof providerMessageId !== 'string' || !providerMessageId.trim()) {
    throw new Error('WhatsApp Cloud API returned no provider message ID');
  }

  return {
    provider: 'WHATSAPP_CLOUD_API',
    accepted: true,
    providerMessageId,
    providerRequestId: String(response.headers.get('x-fb-request-id') || providerMessageId),
    observedAt: new Date().toISOString(),
  };
}
