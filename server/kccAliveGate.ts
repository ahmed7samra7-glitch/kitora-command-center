import { createHmac, timingSafeEqual } from 'node:crypto';

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
  channel: 'WHATSAPP';
  providerMessageId: string;
  providerRequestId: string;
  status: 'SENT' | 'DELIVERED';
  recipientConfirmed: boolean;
  observedAt: string;
};

type EvidenceKind = 'fulfillment' | 'notification';
type AttestedEvidence<T> = {
  kind: EvidenceKind;
  evidence: T;
  signature: string;
};

export type KccAliveInput = {
  fulfillment?: AttestedEvidence<Partial<LiveFulfillmentEvidence>> | null;
  notification?: AttestedEvidence<Partial<LiveNotificationEvidence>> | null;
};

export type KccAliveResult = {
  kccAlive: boolean;
  blockers: string[];
  evidence: {
    fulfillment: boolean;
    notification: boolean;
  };
};

const MAX_EVIDENCE_AGE_MS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function getSecret(): string | null {
  const secret = process.env.KCC_ALIVE_ATTESTATION_SECRET;
  return hasText(secret) ? secret : null;
}

function canonicalize(value: unknown): string {
  return JSON.stringify(value, Object.keys(value as object).sort());
}

function sign(kind: EvidenceKind, evidence: unknown, secret: string): string {
  return createHmac('sha256', secret).update(`${kind}:${canonicalize(evidence)}`).digest('hex');
}

export function createKccAliveAttestation<T>(kind: EvidenceKind, evidence: T, secret = getSecret()): AttestedEvidence<T> {
  if (!secret) throw new Error('KCC_ALIVE_ATTESTATION_SECRET is required to create evidence attestations');
  return { kind, evidence, signature: sign(kind, evidence, secret) };
}

function verifyAttestation<T>(kind: EvidenceKind, attestation: AttestedEvidence<T> | null | undefined): string[] {
  if (!attestation) return [`real ${kind} evidence is missing`];
  const secret = getSecret();
  if (!secret) return ['KCC ALIVE attestation secret is not configured'];
  if (attestation.kind !== kind) return [`${kind} evidence attestation kind is invalid`];
  if (!hasText(attestation.signature)) return [`${kind} evidence attestation signature is missing`];
  let expected: string;
  try {
    expected = sign(kind, attestation.evidence, secret);
  } catch {
    return [`${kind} evidence attestation payload is invalid`];
  }
  const supplied = Buffer.from(attestation.signature, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  if (supplied.length !== expectedBuffer.length || !timingSafeEqual(supplied, expectedBuffer)) {
    return [`${kind} evidence attestation signature is invalid`];
  }
  return [];
}

function isValidTimestamp(value: unknown, referenceTime: Date): boolean {
  if (!hasText(value)) return false;
  const observed = Date.parse(value);
  if (Number.isNaN(observed)) return false;
  const delta = referenceTime.getTime() - observed;
  return delta <= MAX_EVIDENCE_AGE_MS && delta >= -MAX_FUTURE_SKEW_MS;
}

function validateFulfillment(attestation: KccAliveInput['fulfillment'], referenceTime: Date): string[] {
  const blockers = verifyAttestation('fulfillment', attestation);
  if (blockers.length > 0) return blockers;
  const evidence = attestation!.evidence;
  if (evidence.source !== 'live-provider') blockers.push('fulfillment evidence is not marked live-provider');
  if (evidence.provider !== 'CJ_DROPSHIPPING') blockers.push('fulfillment provider is not CJ_DROPSHIPPING');
  if (!hasText(evidence.providerOrderId)) blockers.push('provider fulfillment order ID is missing');
  if (!hasText(evidence.providerRequestId)) blockers.push('provider fulfillment request ID is missing');
  if (!hasText(evidence.trackingNumber)) blockers.push('real tracking number is missing');
  if (!['SUBMITTED', 'SHIPPED', 'DELIVERED'].includes(String(evidence.status))) blockers.push('fulfillment status is not a live-provider status');
  if (!isValidTimestamp(evidence.observedAt, referenceTime)) blockers.push('fulfillment observation timestamp is missing, invalid, stale, or too far in the future');
  return blockers;
}

function validateNotification(attestation: KccAliveInput['notification'], referenceTime: Date): string[] {
  const blockers = verifyAttestation('notification', attestation);
  if (blockers.length > 0) return blockers;
  const evidence = attestation!.evidence;
  if (evidence.source !== 'live-provider') blockers.push('notification evidence is not marked live-provider');
  if (evidence.channel !== 'WHATSAPP') blockers.push('notification channel must be WHATSAPP for KCC ALIVE');
  if (!hasText(evidence.providerMessageId)) blockers.push('provider notification message ID is missing');
  if (!hasText(evidence.providerRequestId)) blockers.push('provider notification request ID is missing');
  if (!['SENT', 'DELIVERED'].includes(String(evidence.status))) blockers.push('notification status is not a live-provider status');
  if (evidence.recipientConfirmed !== true) blockers.push('notification recipient confirmation is missing');
  if (!isValidTimestamp(evidence.observedAt, referenceTime)) blockers.push('notification observation timestamp is missing, invalid, stale, or too far in the future');
  return blockers;
}

export function evaluateKccAlive(input: KccAliveInput): KccAliveResult {
  const referenceTime = new Date();
  const fulfillmentBlockers = validateFulfillment(input.fulfillment, referenceTime);
  const notificationBlockers = validateNotification(input.notification, referenceTime);
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
