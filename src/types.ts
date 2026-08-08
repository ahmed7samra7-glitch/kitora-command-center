export type ViewTab = 
  | 'kcc-mission-control'
  | 'phase4-commerce'
  | 'pilot-production'
  | 'diagnostics'
  | 'phase3-ops'
  | 'core-runtime' 
  | 'verification-report'
  | 'orchestrator' 
  | 'workflows' 
  | 'policies' 
  | 'reality-audit' 
  | 'blueprint' 
  | 'agents' 
  | 'live-os' 
  | 'approvals' 
  | 'tasks' 
  | 'audit' 
  | 'integrations';

export type BlueprintSection = 
  | 'architecture' 
  | 'agents-matrix' 
  | 'db-schema' 
  | 'api-design' 
  | 'tech-stack' 
  | 'roadmap' 
  | 'risks' 
  | 'sign-off';

export type ComponentStatus = 
  | 'ARCHITECTURE ONLY' 
  | 'MOCK IMPLEMENTATION' 
  | 'REAL IMPLEMENTATION' 
  | 'VERIFIED PRODUCTION';

export type TaskLifecycleState = 
  | 'CREATED' 
  | 'QUEUED' 
  | 'ASSIGNED' 
  | 'RUNNING' 
  | 'WAITING_FOR_TOOL' 
  | 'WAITING_FOR_APPROVAL' 
  | 'VERIFYING' 
  | 'COMPLETED' 
  | 'FAILED' 
  | 'CANCELLED' 
  | 'RETRYING';

export type AIProviderID = 'gemini' | 'openai' | 'claude';

export type ReasoningLevel = 'FAST_EXECUTION' | 'BALANCED_REASONING' | 'DEEP_ANALYTIC';

export interface ProviderInfo {
  id: AIProviderID;
  name: string;
  status: 'ACTIVE' | 'CONFIGURED_VIA_KEY' | 'SIMULATED_ADAPTER';
  defaultModel: string;
  latencyAvgMs: number;
  costPer1kTokens: number;
  supportsFunctionCalling: boolean;
  requiredKey: string;
  isAvailable: boolean;
}

export interface RoutingDecision {
  taskType: string;
  reasoningLevel: ReasoningLevel;
  selectedProvider: AIProviderID;
  modelUsed: string;
  justification: string;
  policyEnforced: boolean;
}

export interface VerificationCheck {
  rule: string;
  passed: boolean;
  message: string;
}

export interface VerificationResult {
  passed: boolean;
  syntaxValid: boolean;
  policyValid: boolean;
  securityCheckPassed: boolean;
  confidenceScore: number;
  businessRulesPassed: boolean;
  checks: VerificationCheck[];
}

export interface AgentRuntimeState {
  id: string;
  name: string;
  role: string;
  lifecycleState: 'UNINITIALIZED' | 'IDLE' | 'ASSIGNED' | 'EXECUTING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
  healthStatus: 'HEALTHY' | 'DEGRADED' | 'OFFLINE';
  confidenceScore: number;
  currentTaskId?: string;
  metrics: {
    tasksCompleted: number;
    avgLatencyMs: number;
    errorCount: number;
    lastActiveTimestamp: string;
  };
}

export interface WorkflowStep {
  stepId: string;
  title: string;
  agent: string;
  action: string;
  status: 'PENDING' | 'RUNNING' | 'COMPLETED' | 'SKIPPED' | 'FAILED';
  output?: any;
}

export interface WorkflowPipeline {
  id: string;
  name: string;
  description: string;
  steps: WorkflowStep[];
  currentStepIndex: number;
  status: 'IDLE' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'ROLLED_BACK';
  updatedAt: string;
}

export interface ComponentAuditItem {
  id: string;
  name: string;
  layer: 'Presentation' | 'Orchestration Kernel' | 'Agent Engine' | 'Adapters & DB';
  status: ComponentStatus;
  notes: string;
}

export interface CapabilityItem {
  id: string;
  feature: string;
  status: ComponentStatus;
  requiredIntegration: string;
  verificationMethod: string;
}

export interface AgentRuntimeSpec {
  agentId: string;
  systemPrompt: string;
  memoryAccess: {
    shortTerm: string;
    longTerm: string;
    businessMemory: string;
    vectorStore: string;
  };
  tools: string[];
  permissions: {
    role: string;
    readScope: string;
    writeScope: string;
    approvalRequiredFor: string;
  };
  taskExecutionLoop: string[];
  auditLogging: {
    traceIdFormat: string;
    logLevel: string;
    snapshotFields: string[];
  };
}

export interface MemoryEngineSpec {
  shortTermMemory: {
    type: string;
    capacity: string;
    retention: string;
  };
  longTermMemory: {
    type: string;
    storage: string;
    indexing: string;
  };
  businessMemory: {
    type: string;
    contents: string[];
  };
  vectorStorage: {
    engine: string;
    dimensions: number;
    metric: string;
  };
  retrievalRules: {
    minSimilarityScore: number;
    maxTopK: number;
    recencyWeight: string;
    fallback: string;
  };
}

export interface PolicyConfig {
  adSpendDailyCap: number;
  transferApprovalThreshold: number;
  refundAutoApproveLimit: number;
  minNetMarginPercentage: number;
  maxAutoRetryCount: number;
  maxSupplierRiskScore: number;
  maxInventoryRiskUnitValue: number;
  maxCodeChangeLOC: number;
  maxDeploymentFrequencyDaily: number;
  preferredAIProvider: 'DYNAMIC_AUTO' | 'GEMINI_ONLY' | 'OPENAI_PREFER' | 'CLAUDE_PREFER';
  ownerNotificationChannel: 'WHATSAPP' | 'EMAIL' | 'BOTH';
  updatedAt: string;
  updatedBy: string;
}

export interface AgentInfo {
  id: string;
  name: string;
  role: string;
  category: 'Strategic' | 'Operational' | 'Growth' | 'Infrastructure' | 'Governance';
  description: string;
  primaryPrompt: string;
  inputs: string[];
  outputs: string[];
  toolsAllowed: string[];
  humanApprovalThreshold: string;
  fallbackStrategy: string;
  statusTag: ComponentStatus;
}

export interface TaskItem {
  id: string;
  title: string;
  agent: string;
  provider?: AIProviderID;
  reasoningLevel?: ReasoningLevel;
  status: TaskLifecycleState;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  dependencies?: string[];
  retryCounter?: number;
  maxRetries?: number;
  payload: any;
  result?: any;
  verification?: VerificationResult;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalItem {
  id: string;
  taskId: string;
  title: string;
  agent: string;
  impactScore: number;
  financialImpact?: string;
  description: string;
  whatsappMessagePreview: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface AuditLogItem {
  id: string;
  traceId: string;
  timestamp: string;
  agent: string;
  action: string;
  details: string;
  status: 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';
}

export interface SystemInfo {
  projectName: string;
  version: string;
  status: string;
  hasGeminiKey: boolean;
  hasOpenAIKey: boolean;
  hasClaudeKey: boolean;
  phase1SignOff: {
    approved: boolean;
    signOffDate: string;
    signedBy: string;
    notes: string;
  };
  activeStore: string;
  agentsCount: number;
  integrationsCount: number;
  policies: PolicyConfig;
  activeProvider: string;
}
