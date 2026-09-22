import crypto from 'crypto';
import { dbRuntime } from './dbStorage.js';

export interface ProviderEvidenceReceipt {
  receiptId: string;
  provider: string;
  operation: string;
  resourceId?: string;
  providerRequestId?: string;
  observedAt: string;
  metadata: Record<string, unknown>;
  signature?: string;
}

const MAX_AGE_MS = 15 * 60 * 1000;
const MAX_FUTURE_SKEW_MS = 60 * 1000;

function getEvidenceSecret(): string {
  return String(process.env.KCC_PROVIDER_EVIDENCE_SECRET || '').trim();
}

function canonicalPayload(receipt: Omit<ProviderEvidenceReceipt, 'signature'>): string {
  return JSON.stringify({
    receiptId: receipt.receiptId,
    provider: receipt.provider,
    operation: receipt.operation,
    resourceId: receipt.resourceId || null,
    providerRequestId: receipt.providerRequestId || null,
    observedAt: receipt.observedAt,
    metadata: receipt.metadata
  });
}

function signReceipt(receipt: Omit<ProviderEvidenceReceipt, 'signature'>): string | null {
  const secret = getEvidenceSecret();
  if (!secret) return null;
  return crypto.createHmac('sha256', secret).update(canonicalPayload(receipt)).digest('hex');
}

export function issueProviderEvidenceReceipt(input: {
  provider: string;
  operation: string;
  resourceId?: string;
  providerRequestId?: string;
  observedAt?: string;
  metadata?: Record<string, unknown>;
}): ProviderEvidenceReceipt {
  const observedAt = input.observedAt || new Date().toISOString();
  const receiptWithoutSignature: Omit<ProviderEvidenceReceipt, 'signature'> = {
    receiptId: `PRE-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    provider: input.provider,
    operation: input.operation,
    resourceId: input.resourceId,
    providerRequestId: input.providerRequestId,
    observedAt,
    metadata: input.metadata || {}
  };
  const signature = signReceipt(receiptWithoutSignature);
  if (!signature) {
    throw new Error('KCC_PROVIDER_EVIDENCE_SECRET is required to issue provider evidence receipts');
  }
  const receipt: ProviderEvidenceReceipt = { ...receiptWithoutSignature, signature };
  const receipts = dbRuntime.get('kccProviderEvidence') || [];
  receipts.unshift(receipt);
  if (receipts.length > 500) receipts.length = 500;
  dbRuntime.set('kccProviderEvidence', receipts);
  return receipt;
}

export function getProviderEvidenceReceipt(receiptId: string): ProviderEvidenceReceipt | null {
  if (!receiptId.trim()) return null;
  const receipts = dbRuntime.get('kccProviderEvidence') || [];
  return receipts.find((receipt: ProviderEvidenceReceipt) => receipt?.receiptId === receiptId) || null;
}

export function verifyProviderEvidenceReceipt(
  receipt: ProviderEvidenceReceipt | null,
  expected: {
    provider?: string;
    operation?: string;
    resourceId?: string;
    providerRequestId?: string;
    observedAt?: string;
    metadata?: Record<string, unknown>;
  }
): boolean {
  if (!receipt || typeof receipt !== 'object' || typeof receipt.signature !== 'string') return false;

  const now = Date.now();
  const observed = Date.parse(receipt.observedAt);
  if (!Number.isFinite(observed)) return false;
  if (observed > now + MAX_FUTURE_SKEW_MS) return false;
  if (now - observed > MAX_AGE_MS) return false;

  if (expected.provider && receipt.provider !== expected.provider) return false;
  if (expected.operation && receipt.operation !== expected.operation) return false;
  if (expected.resourceId && receipt.resourceId !== expected.resourceId) return false;
  if (expected.providerRequestId && receipt.providerRequestId !== expected.providerRequestId) return false;
  if (expected.observedAt && receipt.observedAt !== expected.observedAt) return false;

  if (expected.metadata) {
    for (const [key, value] of Object.entries(expected.metadata)) {
      if (JSON.stringify(receipt.metadata?.[key]) !== JSON.stringify(value)) return false;
    }
  }

  const secret = getEvidenceSecret();
  if (!secret) return false;

  const expectedSignature = signReceipt({
    receiptId: receipt.receiptId,
    provider: receipt.provider,
    operation: receipt.operation,
    resourceId: receipt.resourceId,
    providerRequestId: receipt.providerRequestId,
    observedAt: receipt.observedAt,
    metadata: receipt.metadata
  });

  if (!expectedSignature || receipt.signature.length !== expectedSignature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(receipt.signature), Buffer.from(expectedSignature));
  } catch {
    return false;
  }
}
