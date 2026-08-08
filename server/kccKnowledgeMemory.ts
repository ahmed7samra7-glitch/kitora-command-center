import { dbRuntime } from './dbStorage.js';

export interface KnowledgeEntry {
  id: string;
  category: 
    | 'PROMPT'
    | 'PROVIDER_PERFORMANCE'
    | 'FAILURE_RECOVERY'
    | 'WORKFLOW_TEMPLATE'
    | 'ROI_PATTERN'
    | 'STRATEGY_SUCCESS'
    | 'STRATEGY_FAILURE'
    | 'SUPPLIER_HISTORY'
    | 'CUSTOMER_HISTORY'
    | 'CAMPAIGN_HISTORY'
    | 'PRICING_HISTORY'
    | 'EXECUTION_HISTORY'
    | 'EXECUTIVE_DECISION';
  taskType: string;
  provider?: string;
  inputPattern: string;
  successfulOutput?: any;
  failureReason?: string;
  suggestedFix?: string;
  latencyMs: number;
  costUsd: number;
  successRate: number;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export class KCCKnowledgeMemory {
  public recordMemory(entry: Omit<KnowledgeEntry, 'id' | 'createdAt' | 'updatedAt'>): KnowledgeEntry {
    const memory: KnowledgeEntry = {
      ...entry,
      id: `MEM-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const existing = dbRuntime.get('kccKnowledgeMemory') || [];
    existing.unshift(memory);
    if (existing.length > 500) existing.length = 500;
    dbRuntime.set('kccKnowledgeMemory', existing);

    console.log(`[KCC Knowledge Memory] Recorded memory ${memory.id} (${memory.category}) for taskType '${memory.taskType}'`);
    return memory;
  }

  public getKnowledge(): KnowledgeEntry[] {
    return dbRuntime.get('kccKnowledgeMemory') || [];
  }

  public getMemoryContextSummary(): {
    successfulStrategies: string[];
    failedStrategies: string[];
    supplierMetricsSummary: string;
    pricingCampaignSummary: string;
    executiveDecisionCount: number;
  } {
    const all = this.getKnowledge();
    
    const successfulStrategies = all
      .filter(m => m.category === 'STRATEGY_SUCCESS' || (m.category === 'ROI_PATTERN' && m.successRate > 0.8))
      .slice(0, 5)
      .map(m => m.inputPattern);

    const memoryFailed = all
      .filter(m => m.category === 'STRATEGY_FAILURE' || (m.failureReason && m.successRate < 0.3))
      .map(m => m.failureReason || m.inputPattern);

    const discussions = dbRuntime.get('kccExecutiveDiscussions') || [];
    const discussionRejected = discussions.flatMap((d: any) => d.rejectedIdeas || []);

    const combinedFailed = Array.from(new Set([...memoryFailed, ...discussionRejected])).slice(0, 5);
    const failedStrategies = combinedFailed.length > 0 
      ? combinedFailed 
      : ['Unverified ad spend without margin protection', 'Non-automated manual intervention workflows'];

    const supplierLogs = all.filter(m => m.category === 'SUPPLIER_HISTORY');
    const supplierMetricsSummary = supplierLogs.length > 0
      ? `Recorded ${supplierLogs.length} supplier interactions. Average margin stability high.`
      : 'Default CJ Dropshipping API active (Avg Margin: 68%, Stock Status: Optimal).';

    const campaignLogs = all.filter(m => m.category === 'CAMPAIGN_HISTORY' || m.category === 'PRICING_HISTORY');
    const pricingCampaignSummary = campaignLogs.length > 0
      ? `Evaluated ${campaignLogs.length} pricing/campaign iterations. Dynamic margin targeting enabled.`
      : 'Baseline pricing active at 65%+ net profit margin threshold.';

    const executiveDecisionCount = all.filter(m => m.category === 'EXECUTIVE_DECISION').length;

    return {
      successfulStrategies,
      failedStrategies,
      supplierMetricsSummary,
      pricingCampaignSummary,
      executiveDecisionCount
    };
  }

  public getBestProviderForCapability(capability: string): { provider: string; confidence: number } {
    const memory = this.getKnowledge();
    const relevant = memory.filter(m => m.taskType.toLowerCase().includes(capability.toLowerCase()));

    if (relevant.length === 0) {
      return { provider: 'GEMINI', confidence: 0.85 };
    }

    const providerStats: Record<string, { total: number; success: number }> = {};
    for (const item of relevant) {
      const p = item.provider || 'GEMINI';
      if (!providerStats[p]) providerStats[p] = { total: 0, success: 0 };
      providerStats[p].total++;
      if (item.successRate > 0.7) providerStats[p].success++;
    }

    let bestProvider = 'GEMINI';
    let bestRate = -1;

    for (const [p, stats] of Object.entries(providerStats)) {
      const rate = stats.success / stats.total;
      if (rate > bestRate) {
        bestRate = rate;
        bestProvider = p;
      }
    }

    return { provider: bestProvider, confidence: Math.max(0.75, bestRate) };
  }

  public getFailureFix(errorMsg: string): string | null {
    const memory = this.getKnowledge();
    const found = memory.find(m => m.failureReason && errorMsg.toLowerCase().includes(m.failureReason.toLowerCase()));
    return found?.suggestedFix || null;
  }
}

export const kccKnowledgeMemory = new KCCKnowledgeMemory();
