export type LiveFulfillmentEvidence = {
  source: 'live-provider';
  provider: 'CJ_DROPSHIPPING';
  providerOrderId: string;
  providerRequestId: string;
  trackingNumber: string;
  status: 'SUBMITTED' | 'SHIPPED' | 'DELIVERED';
  observedAt: string;
};

export type LiveNotificationEvidence = {
  source: 'live-provider';
  channel: 'WHATSAPP' | 'EMAIL';
  providerMessageId: string;
  providerRequestId: string;
  status: 'SENT' | 'DELIVERED';
  recipientConfirmed: boolean;
  observedAt: string;
};

export type KccAliveInput = {
  fulfillment?: Partial<LiveFulfillmentEvidence> | null;
  notification?: Partial<LiveNotificationEvidence> | null;
};

export type KccAliveResult = {
  kccAlive: boolean;
  blockers: string[];
  evidence: {
    fulfillment: boolean;
    notification: boolean;
  };
};

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidTimestamp(value: unknown): boolean {
  return hasText(value) && !Number.isNaN(Date.parse(value));
}

function validateFulfillment(evidence: KccAliveInput['fulfillment']): string[] {
  if (!evidence) return ['real fulfillment evidence is missing'];
  const blockers: string[] = [];
  if (evidence.source !== 'live-provider') blockers.push('fulfillment evidence is not marked live-provider');
  if (evidence.provider !== 'CJ_DROPSHIPPING') blockers.push('fulfillment provider is not CJ_DROPSHIPPING');
  if (!hasText(evidence.providerOrderId)) blockers.push('provider fulfillment order ID is missing');
  if (!hasText(evidence.providerRequestId)) blockers.push('provider fulfillment request ID is missing');
  if (!hasText(evidence.trackingNumber)) blockers.push('real tracking number is missing');
  if (!['SUBMITTED', 'SHIPPED', 'DELIVERED'].includes(String(evidence.status))) blockers.push('fulfillment status is not a live-provider status');
  if (!isValidTimestamp(evidence.observedAt)) blockers.push('fulfillment observation timestamp is missing or invalid');
  return blockers;
}

function validateNotification(evidence: KccAliveInput['notification']): string[] {
  if (!evidence) return ['real notification evidence is missing'];
  const blockers: string[] = [];
  if (evidence.source !== 'live-provider') blockers.push('notification evidence is not marked live-provider');
  if (!['WHATSAPP', 'EMAIL'].includes(String(evidence.channel))) blockers.push('notification channel is not supported');
  if (!hasText(evidence.providerMessageId)) blockers.push('provider notification message ID is missing');
  if (!hasText(evidence.providerRequestId)) blockers.push('provider notification request ID is missing');
  if (!['SENT', 'DELIVERED'].includes(String(evidence.status))) blockers.push('notification status is not a live-provider status');
  if (evidence.recipientConfirmed !== true) blockers.push('notification recipient confirmation is missing');
  if (!isValidTimestamp(evidence.observedAt)) blockers.push('notification observation timestamp is missing or invalid');
  return blockers;
}

export function evaluateKccAlive(input: KccAliveInput): KccAliveResult {
  const fulfillmentBlockers = validateFulfillment(input.fulfillment);
  const notificationBlockers = validateNotification(input.notification);
  const blockers = [
    ...fulfillmentBlockers.map((blocker) => `fulfillment: ${blocker}`),
    ...notificationBlockers.map((blocker) => `notification: ${blocker}`),
  ];
  return {
    kccAlive: blockers.length === 0,
    blockers,
    evidence: {
      fulfillment: fulfillmentBlockers.length === 0,
      notification: notificationBlockers.length === 0,
    },
  };
}
