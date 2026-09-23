export type BrainProvider = 'gemini' | 'openai' | 'claude' | 'none';
export type BrainStatus = 'COMPLETED' | 'FAILED' | 'BLOCKED';

interface BrainEnv {
  GEMINI_API_KEY?: string;
  OPENAI_API_KEY?: string;
  CLAUDE_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  KCC_AI_PROVIDER?: string;
  KCC_ALLOW_PAID_AI_FALLBACK?: string;
  GEMINI_MODEL?: string;
  OPENAI_MODEL?: string;
  CLAUDE_MODEL?: string;
}

export interface CloudflareBrainDecision {
  decisionId: string;
  taskId: string;
  agentId: string;
  provider: BrainProvider;
  model: string;
  status: BrainStatus;
  output: unknown;
  requiresOwnerApproval: boolean;
  approvalReason?: string;
  executionTimeMs: number;
  createdAt: string;
  error?: string;
}

const PROMPTS: Record<string, string> = {
  PRODUCT_HUNTER: 'You are KITORA PRODUCT_HUNTER. Evaluate product opportunities from supplied evidence. Return JSON with product ideas, margin assumptions, risks, and next verification actions. Never claim supplier or purchase actions happened.',
  MARKETING_COPYWRITER: 'You are KITORA MARKETING_COPYWRITER. Produce conversion-oriented copy and ad concepts from supplied evidence. Never claim a campaign was launched or delivered.',
  SEO_OPTIMIZER: 'You are KITORA SEO_OPTIMIZER. Produce improved titles, descriptions, keywords, and metadata. Never claim publication occurred.',
  PRICING_ENGINE: 'You are KITORA PRICING_ENGINE. Calculate pricing from supplied costs and constraints, showing formulas and assumptions. Never claim a price was published.',
  CUSTOMER_SERVICE: 'You are KITORA CUSTOMER_SERVICE. Draft accurate customer responses only from supplied order evidence. Never invent tracking, refund, shipment, or delivery facts.',
  EXECUTIVE_AUDITOR: 'You are KITORA EXECUTIVE_AUDITOR. Review supplied business/runtime evidence and return verified facts, blockers, and next safe actions. Separate facts from assumptions.',
  DEFAULT: 'You are KCC Brain, KITORA\'s autonomous reasoning layer. Return structured JSON, preserve uncertainty, and never claim an external action occurred without provider evidence.'
};

function parseOutput(text: string): unknown {
  const value = text.trim();
  if (!value) throw new Error('AI provider returned empty output');
  try { return JSON.parse(value); } catch { return { text: value }; }
}

function approval(input: { sensitivityScore?: number; costUSD?: number }) {
  const sensitivity = Number(input.sensitivityScore || 0);
  const cost = Number(input.costUSD || 0);
  return sensitivity > 0.8 || cost > 100
    ? { requiresOwnerApproval: true, approvalReason: `Sensitivity ${sensitivity} or cost $${cost} exceeds zero-touch threshold.` }
    : { requiresOwnerApproval: false as const };
}

async function callGemini(env: BrainEnv, goal: string, systemPrompt: string, context: unknown, traceId: string): Promise<{ model: string; output: unknown }> {
  const key = env.GEMINI_API_KEY!.trim();
  const configuredModel = (env.GEMINI_MODEL || 'gemini-3.8-flash').trim();
  const models = Array.from(new Set([
    configuredModel,
    'gemini-3.1-flash-lite',
    'gemini-2.5-flash-lite'
  ]));

  const errors: string[] = [];

  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: 'user', parts: [{ text: `[TRACE: ${traceId}] Goal: ${goal}\\nContext: ${JSON.stringify(context ?? {})}` }] }],
        generationConfig: { responseMimeType: 'application/json' }
      })
    });

    const data = await response.json().catch(() => ({})) as any;
    if (response.ok) {
      const text = data?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || '').join('');
      return { model, output: parseOutput(String(text || '')) };
    }

    const detail = String(data?.error?.message || 'request failed');
    const error = `Gemini HTTP ${response.status}: ${detail}`;
    errors.push(`${model}: ${error}`);

    if (![429, 500, 502, 503, 504].includes(response.status)) break;
  }

  throw new Error(errors.join(' | ') || 'Gemini request failed');
}

async function callOpenAI(env: BrainEnv, goal: string, systemPrompt: string, context: unknown, traceId: string): Promise<{ model: string; output: unknown }> {
  const model = (env.OPENAI_MODEL || 'gpt-4o').trim();
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${env.OPENAI_API_KEY!.trim()}` },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `[TRACE: ${traceId}] Goal: ${goal}\nContext: ${JSON.stringify(context ?? {})}` }
      ],
      response_format: { type: 'json_object' }
    })
  });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(`OpenAI HTTP ${response.status}: ${data?.error?.message || 'request failed'}`);
  return { model, output: parseOutput(String(data?.choices?.[0]?.message?.content || '')) };
}

async function callClaude(env: BrainEnv, goal: string, systemPrompt: string, context: unknown, traceId: string): Promise<{ model: string; output: unknown }> {
  const model = (env.CLAUDE_MODEL || 'claude-3-5-sonnet-20241022').trim();
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': (env.CLAUDE_API_KEY || env.ANTHROPIC_API_KEY)!.trim(),
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: 'user', content: `[TRACE: ${traceId}] Goal: ${goal}\nContext: ${JSON.stringify(context ?? {})}` }]
    })
  });
  const data = await response.json().catch(() => ({})) as any;
  if (!response.ok) throw new Error(`Claude HTTP ${response.status}: ${data?.error?.message || 'request failed'}`);
  return { model, output: parseOutput(String(data?.content?.[0]?.text || '')) };
}

function configured(env: BrainEnv, provider: BrainProvider): boolean {
  if (provider === 'gemini') return Boolean(env.GEMINI_API_KEY?.trim());
  if (provider === 'openai') return Boolean(env.OPENAI_API_KEY?.trim());
  if (provider === 'claude') return Boolean(env.CLAUDE_API_KEY?.trim() || env.ANTHROPIC_API_KEY?.trim());
  return false;
}

function providerOrder(env: BrainEnv): BrainProvider[] {
  const preferred = (env.KCC_AI_PROVIDER || 'gemini').trim().toLowerCase();
  const paidProvidersAllowed = (env.KCC_ALLOW_PAID_AI_FALLBACK || '').trim().toLowerCase() === 'true';

  // Hard $0 boundary: Gemini is the only provider path when paid providers are not explicitly enabled.
  if (!paidProvidersAllowed) return ['gemini'];

  if (preferred === 'openai') return ['openai', 'gemini', 'claude'];
  if (preferred === 'claude') return ['claude', 'gemini', 'openai'];
  return ['gemini', 'openai', 'claude'];
}

export async function executeCloudflareBrainTask(
  env: BrainEnv,
  input: {
    taskId: string;
    agentId?: string;
    goal: string;
    context?: unknown;
    sensitivityScore?: number;
    costUSD?: number;
  }
): Promise<CloudflareBrainDecision> {
  const started = Date.now();
  const createdAt = new Date().toISOString();
  const decisionId = `CF-DEC-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const traceId = `CF-TRACE-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;
  const agentId = String(input.agentId || 'EXECUTIVE_AUDITOR').trim() || 'EXECUTIVE_AUDITOR';
  const systemPrompt = PROMPTS[agentId] || PROMPTS.DEFAULT;
  const owner = approval(input);
  const errors: string[] = [];

  for (const provider of providerOrder(env)) {
    if (!configured(env, provider)) continue;
    try {
      const result = provider === 'gemini'
        ? await callGemini(env, input.goal, systemPrompt, input.context, traceId)
        : provider === 'openai'
          ? await callOpenAI(env, input.goal, systemPrompt, input.context, traceId)
          : await callClaude(env, input.goal, systemPrompt, input.context, traceId);

      return {
        decisionId,
        taskId: input.taskId,
        agentId,
        provider,
        model: result.model,
        status: 'COMPLETED',
        output: result.output,
        ...owner,
        executionTimeMs: Date.now() - started,
        createdAt
      };
    } catch (error) {
      errors.push(`${provider}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return {
    decisionId,
    taskId: input.taskId,
    agentId,
    provider: 'none',
    model: 'none',
    status: 'BLOCKED',
    output: null,
    ...owner,
    executionTimeMs: Date.now() - started,
    createdAt,
    error: errors.length ? errors.join(' | ') : 'No live AI provider is configured; deterministic fallback is blocked.'
  };
}

export async function persistCloudflareBrainDecision(db: { prepare(query: string): any }, decision: CloudflareBrainDecision): Promise<void> {
  await db.prepare(
    `INSERT INTO kcc_brain_decisions
      (id, task_id, agent_id, provider, model, status, output, requires_owner_approval, approval_reason, execution_time_ms, created_at, error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    decision.decisionId,
    decision.taskId,
    decision.agentId,
    decision.provider,
    decision.model,
    decision.status,
    decision.output === null ? null : JSON.stringify(decision.output),
    decision.requiresOwnerApproval ? 1 : 0,
    decision.approvalReason || null,
    decision.executionTimeMs,
    decision.createdAt,
    decision.error || null
  ).run();
}
