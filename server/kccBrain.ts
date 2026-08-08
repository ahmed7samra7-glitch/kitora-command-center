import { GoogleGenAI } from '@google/genai';
import { dbRuntime } from './dbStorage.js';
import { providerSelectionEngine, UniversalTask } from './aiConnector.js';

export interface PromptRegistryEntry {
  agentId: string;
  name: string;
  systemPrompt: string;
  targetModel: 'gemini-3.6-flash' | 'gemini-3.1-pro-preview' | 'gpt-4o' | 'claude-3-5-sonnet' | 'auto';
  version: number;
  updatedAt: string;
}

export interface BrainDecisionResult {
  decisionId: string;
  agentId: string;
  selectedProvider: 'gemini' | 'openai' | 'claude' | 'deterministic';
  selectedModel: string;
  requiresOwnerApproval: boolean;
  approvalReason?: string;
  shouldRetry: boolean;
  output: any;
  executionTimeMs: number;
  quotaCooloffActive: boolean;
  auditTrail: string[];
}

export class KCCBrain {
  private primaryGeminiClient: GoogleGenAI | null = null;
  private quotaCooloffUntil: Record<string, number> = {};
  private decisionLogs: BrainDecisionResult[] = [];

  constructor() {
    this.initProviders();
    this.seedPromptRegistry();
  }

  private initProviders() {
    const key = process.env.GEMINI_API_KEY;
    if (key) {
      try {
        this.primaryGeminiClient = new GoogleGenAI({ apiKey: key });
      } catch (err) {
        console.warn('[KCC Brain] Gemini client init warning:', err);
      }
    }
  }

  // 1. PROMPT REGISTRY (Persisted in dbStorage)
  public seedPromptRegistry() {
    const existing = dbRuntime.get('kccPromptRegistry');
    if (!existing || Object.keys(existing).length === 0) {
      const defaultPrompts: Record<string, PromptRegistryEntry> = {
        PRODUCT_HUNTER: {
          agentId: 'PRODUCT_HUNTER',
          name: 'Autonomous Product Sourcing Hunter',
          systemPrompt: `You are KITORA's Lead Autonomous Product Sourcing Hunter. Analyze e-commerce viral trends, calculate net profit margins (target >= 40%), evaluate shipping velocity, and return high-demand winning product recommendations.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        },
        MARKETING_COPYWRITER: {
          agentId: 'MARKETING_COPYWRITER',
          name: 'High-Conversion Ads & Copywriting Specialist',
          systemPrompt: `You are KITORA's Direct-Response Marketing Copywriter. Create high-converting Meta and Google ad headlines, primary text, target audience segments, and SEO product descriptions designed to drive immediate conversions.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        },
        SEO_OPTIMIZER: {
          agentId: 'SEO_OPTIMIZER',
          name: 'Store Catalog SEO Optimizer',
          systemPrompt: `You are KITORA's E-Commerce SEO Specialist. Optimize product titles, meta descriptions, image alt tags, and structural JSON-LD metadata for maximum search engine indexation.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        },
        PRICING_ENGINE: {
          agentId: 'PRICING_ENGINE',
          name: 'Dynamic Pricing & Margin Engine',
          systemPrompt: `You are KITORA's Pricing Strategy AI. Calculate retail pricing based on supplier cost, shipping overhead, payment processing fees (PayPal 3.49% + $0.49), and target net margin percentage.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        },
        CUSTOMER_SERVICE: {
          agentId: 'CUSTOMER_SERVICE',
          name: 'WhatsApp & Email Customer Support AI',
          systemPrompt: `You are KITORA's Autonomous Customer Support Representative. Craft empathetic, helpful, and professional responses for order tracking, shipping updates, and customer inquiries.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        },
        EXECUTIVE_AUDITOR: {
          agentId: 'EXECUTIVE_AUDITOR',
          name: 'Autonomous Business Operations Auditor',
          systemPrompt: `You are KCC Brain's Executive Operations Auditor. Monitor store health, inventory levels, order fulfillment speed, and financial net revenue to provide concise daily owner digests.`,
          targetModel: 'auto',
          version: 1,
          updatedAt: new Date().toISOString()
        }
      };
      dbRuntime.set('kccPromptRegistry', defaultPrompts);
    }
  }

  public getPromptRegistry(): Record<string, PromptRegistryEntry> {
    return dbRuntime.get('kccPromptRegistry') || {};
  }

  public getPrompt(agentId: string): PromptRegistryEntry | null {
    const registry = this.getPromptRegistry();
    return registry[agentId] || null;
  }

  public updatePrompt(agentId: string, systemPrompt: string, targetModel?: any): PromptRegistryEntry {
    const registry = this.getPromptRegistry();
    const current = registry[agentId] || {
      agentId,
      name: `${agentId} Agent`,
      systemPrompt: '',
      targetModel: 'auto',
      version: 0,
      updatedAt: new Date().toISOString()
    };

    const updated: PromptRegistryEntry = {
      ...current,
      systemPrompt,
      targetModel: targetModel || current.targetModel,
      version: current.version + 1,
      updatedAt: new Date().toISOString()
    };

    registry[agentId] = updated;
    dbRuntime.set('kccPromptRegistry', registry);
    return updated;
  }

  // 2. AUTONOMOUS DECISION ENGINE & MULTI-PROVIDER GATEWAY
  public async executeAgentTask(
    agentId: string,
    prompt: string,
    fallbackOutput: any,
    contextInfo?: { sensitivityScore?: number; costUSD?: number }
  ): Promise<BrainDecisionResult> {
    const start = Date.now();
    const decisionId = `DEC-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const traceId = `TRACE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const auditTrail: string[] = [];

    // Step A: Load Prompt from Registry
    const promptEntry = this.getPrompt(agentId);
    const systemInstruction = promptEntry ? promptEntry.systemPrompt : `You are an autonomous e-commerce AI assistant for KITORA store.`;
    auditTrail.push(`[KCC Brain] Loaded system prompt for agent '${agentId}' (Version v${promptEntry?.version || 1}) from Registry.`);

    // Step B: Decision Engine Owner Approval Gate
    let requiresOwnerApproval = false;
    let approvalReason: string | undefined;

    if (contextInfo) {
      if ((contextInfo.sensitivityScore && contextInfo.sensitivityScore > 0.8) || (contextInfo.costUSD && contextInfo.costUSD > 100)) {
        requiresOwnerApproval = true;
        approvalReason = `Action sensitivity score (${contextInfo.sensitivityScore || 0}) or cost ($${contextInfo.costUSD || 0}) exceeds autonomous zero-touch threshold.`;
        auditTrail.push(`[Owner Guard] Action requires owner approval: ${approvalReason}`);
      }
    }

    // Step C: Build Universal Task Protocol Object
    const universalTask: UniversalTask = {
      taskId: decisionId,
      traceId,
      agentId,
      priority: contextInfo?.sensitivityScore && contextInfo.sensitivityScore > 0.5 ? 'HIGH' : 'MEDIUM',
      goal: prompt,
      context: {
        systemPrompt: systemInstruction,
        contextInfo
      },
      expectedOutput: fallbackOutput,
      memoryReferences: [`BRAIN_REGISTRY_${agentId}`],
      requiredTools: ['CODE', 'QA', 'SECURITY'].some(kw => agentId.includes(kw)) ? ['code_editor', 'terminal'] : ['web_search'],
      approvalLevel: requiresOwnerApproval ? 'REQUIRES_OWNER' : 'AUTONOMOUS',
      deadline: new Date(Date.now() + 180000).toISOString(),
      status: 'QUEUED',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      auditLogs: [...auditTrail]
    };

    // Step D: Route via Provider Selection Engine
    const selectedAdapter = providerSelectionEngine.selectBestProvider(universalTask);
    auditTrail.push(`[Provider Selection Engine] Routed task to optimal adapter: '${selectedAdapter.providerId}'`);

    const response = await selectedAdapter.executeTask(universalTask);

    let selectedProvider: 'gemini' | 'openai' | 'claude' | 'deterministic' = selectedAdapter.providerId as any;
    let selectedModel = response.modelUsed;
    let output: any = response.output || fallbackOutput;
    let shouldRetry = response.status === 'FAILED';

    if (response.status === 'COMPLETED') {
      auditTrail.push(`[Provider Gateway] Successfully executed task via ${response.modelUsed} (${response.executionTimeMs}ms)`);
    } else {
      auditTrail.push(`[Provider Gateway] Primary selection execution failed (${response.error}). Applied zero-latency deterministic fallback.`);
      selectedProvider = 'deterministic';
      selectedModel = 'deterministic-fallback';
    }

    const result: BrainDecisionResult = {
      decisionId,
      agentId,
      selectedProvider,
      selectedModel,
      requiresOwnerApproval,
      approvalReason,
      shouldRetry,
      output,
      executionTimeMs: Date.now() - start,
      quotaCooloffActive: false,
      auditTrail
    };

    this.decisionLogs.unshift(result);
    if (this.decisionLogs.length > 50) this.decisionLogs.pop();

    return result;
  }

  public getBrainStatus() {
    return {
      name: 'KCC Brain Central Autonomous Decision System',
      activeProviders: {
        gemini: !!this.primaryGeminiClient,
        openAi: !!process.env.OPENAI_API_KEY,
        claude: !!(process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY),
        deterministicFallback: true
      },
      quotaCooloff: {
        geminiActive: Date.now() < (this.quotaCooloffUntil['gemini'] || 0),
        remainingMs: Math.max(0, (this.quotaCooloffUntil['gemini'] || 0) - Date.now())
      },
      promptRegistryCount: Object.keys(this.getPromptRegistry()).length,
      recentDecisionCount: this.decisionLogs.length,
      lastDecision: this.decisionLogs[0] || null
    };
  }

  public getDecisionLogs() {
    return this.decisionLogs;
  }
}

export const kccBrain = new KCCBrain();
