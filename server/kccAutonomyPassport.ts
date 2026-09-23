export type KccAutonomyMode = 'READ_ONLY' | 'OWNER_APPROVAL' | 'BLOCKED';

export interface KccAutonomyPassport {
  version: 'KCC-AUTONOMY-PASSPORT-1';
  passportId: string;
  mode: KccAutonomyMode;
  issuedAt: string;
  expiresAt: string;
  maxSpendUSD: 0;
  allowedCapabilities: string[];
  forbiddenCapabilities: string[];
  requiredEvidence: string[];
  reason?: string;
}

const EXTERNAL_WRITE_PATTERNS = [
  /\bbuy\b/i,
  /\bpurchase\b/i,
  /\bpay(?:ment)?\b/i,
  /\bcharge\b/i,
  /\bspend\b/i,
  /\bplace\s+an?\s+order\b/i,
  /\bfulfill(?:ment)?\b/i,
  /\bsupplier\b/i,
  /\bship(?:ping|ped|ment)?\b/i,
  /\bnotify\b/i,
  /\bwhatsapp\b/i,
  /\bpublish\b/i,
  /\blaunch\s+(?:an?\s+)?ad\b/i,
  /\bad\s+spend\b/i,
  /\bexternal\s+write\b/i,
  /\bdelete\b/i,
  /\bcancel\b/i
];

const ANALYSIS_CAPABILITIES = ['ANALYZE', 'RECOMMEND', 'DRAFT', 'READ_TELEMETRY'];
const FORBIDDEN_CAPABILITIES = ['PURCHASE', 'PAYMENT', 'SUPPLIER_WRITE', 'FULFILLMENT', 'NOTIFICATION', 'PUBLISH', 'AD_SPEND', 'EXTERNAL_WRITE', 'DELETE'];

const NEGATION_CONTEXT = /(?:\bdo\s+not\b|\bdon't\b|\bnever\b|\bmust\s+not\b|\bshould\s+not\b|\bnot\s+to\b|\bwithout\b)\s+[^.!?;:]{0,48}$/i;

function looksLikeExternalWrite(text: string): boolean {
  return EXTERNAL_WRITE_PATTERNS.some((pattern) => {
    const value = String(text || '');
    const match = pattern.exec(value);
    if (!match || typeof match.index !== 'number') return false;
    const prefix = value.slice(Math.max(0, match.index - 64), match.index);
    return !NEGATION_CONTEXT.test(prefix);
  });
}

export function issueAutonomyPassport(input: {
  goal: string;
  sensitivityScore?: number;
  costUSD?: number;
  ttlSeconds?: number;
}): KccAutonomyPassport {
  const issuedAt = new Date();
  const ttlSeconds = Math.max(60, Math.min(3600, Number(input.ttlSeconds || 900)));
  const sensitivity = Number(input.sensitivityScore || 0);
  const cost = Number(input.costUSD || 0);
  const goal = String(input.goal || '').trim();

  let mode: KccAutonomyMode = 'READ_ONLY';
  let reason = 'Analysis-only capability grant. External writes are not admitted by the Cloudflare runtime.';

  if (sensitivity > 0.8 || cost > 100) {
    mode = 'OWNER_APPROVAL';
    reason = 'Owner approval required by KCC zero-touch policy.';
  } else if (looksLikeExternalWrite(goal)) {
    mode = 'BLOCKED';
    reason = 'Requested goal contains an external side effect that is outside the current Cloudflare autonomy boundary.';
  }

  return {
    version: 'KCC-AUTONOMY-PASSPORT-1',
    passportId: `KCC-PASS-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`,
    mode,
    issuedAt: issuedAt.toISOString(),
    expiresAt: new Date(issuedAt.getTime() + ttlSeconds * 1000).toISOString(),
    maxSpendUSD: 0,
    allowedCapabilities: mode === 'READ_ONLY' ? ANALYSIS_CAPABILITIES : [],
    forbiddenCapabilities: FORBIDDEN_CAPABILITIES,
    requiredEvidence: ['VERIFIED_INPUT_EVIDENCE'],
    ...(reason ? { reason } : {})
  };
}

export function admitNextActions(
  passport: KccAutonomyPassport,
  nextActions: unknown
): { admitted: Array<{ agentId?: string; goal: string }>; rejected: Array<{ goal?: string; reason: string }> } {
  const actions = Array.isArray(nextActions) ? nextActions : [];
  const admitted: Array<{ agentId?: string; goal: string }> = [];
  const rejected: Array<{ goal?: string; reason: string }> = [];

  if (passport.mode !== 'READ_ONLY') {
    return {
      admitted: [],
      rejected: actions.map((action) => ({
        goal: typeof (action as any)?.goal === 'string' ? String((action as any).goal).slice(0, 4000) : undefined,
        reason: passport.reason || 'Autonomy passport does not allow autonomous follow-up actions.'
      }))
    };
  }

  const now = Date.now();
  if (Date.parse(passport.expiresAt) <= now) {
    return {
      admitted: [],
      rejected: actions.map((action) => ({
        goal: typeof (action as any)?.goal === 'string' ? String((action as any).goal).slice(0, 4000) : undefined,
        reason: 'Autonomy passport expired.'
      }))
    };
  }

  for (const action of actions.slice(0, 4)) {
    if (!action || typeof action !== 'object') {
      rejected.push({ reason: 'Malformed next action.' });
      continue;
    }
    const goal = typeof (action as any).goal === 'string' ? String((action as any).goal).trim().slice(0, 4000) : '';
    if (!goal) {
      rejected.push({ reason: 'Next action has no goal.' });
      continue;
    }
    if (looksLikeExternalWrite(goal)) {
      rejected.push({ goal, reason: 'Next action requests an external side effect outside the passport.' });
      continue;
    }
    admitted.push({
      agentId: typeof (action as any).agentId === 'string' ? String((action as any).agentId).slice(0, 128) : undefined,
      goal
    });
  }

  return { admitted, rejected };
}
