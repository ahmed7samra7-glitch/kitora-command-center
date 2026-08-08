import { AgentInfo, CapabilityItem, ComponentAuditItem, AgentRuntimeSpec, MemoryEngineSpec, PolicyConfig, ProviderInfo, WorkflowPipeline } from '../types';

export const DEFAULT_POLICY_CONFIG: PolicyConfig = {
  adSpendDailyCap: 50.00,
  transferApprovalThreshold: 500.00,
  refundAutoApproveLimit: 30.00,
  minNetMarginPercentage: 40.0,
  maxAutoRetryCount: 5,
  maxSupplierRiskScore: 25,
  maxInventoryRiskUnitValue: 1500.00,
  maxCodeChangeLOC: 350,
  maxDeploymentFrequencyDaily: 12,
  preferredAIProvider: 'DYNAMIC_AUTO',
  ownerNotificationChannel: 'BOTH',
  updatedAt: new Date().toISOString(),
  updatedBy: 'CTO / System Administrator'
};

export const PROVIDERS_METADATA: ProviderInfo[] = [
  {
    id: 'gemini',
    name: 'Google Gemini (Native @google/genai SDK)',
    status: 'ACTIVE',
    defaultModel: 'gemini-3.6-flash',
    latencyAvgMs: 380,
    costPer1kTokens: 0.00015,
    supportsFunctionCalling: true,
    requiredKey: 'GEMINI_API_KEY',
    isAvailable: true,
  },
  {
    id: 'openai',
    name: 'OpenAI GPT Adapter',
    status: 'SIMULATED_ADAPTER',
    defaultModel: 'gpt-4o',
    latencyAvgMs: 620,
    costPer1kTokens: 0.0025,
    supportsFunctionCalling: true,
    requiredKey: 'OPENAI_API_KEY',
    isAvailable: false,
  },
  {
    id: 'claude',
    name: 'Anthropic Claude Adapter',
    status: 'SIMULATED_ADAPTER',
    defaultModel: 'claude-3-5-sonnet',
    latencyAvgMs: 710,
    costPer1kTokens: 0.0030,
    supportsFunctionCalling: true,
    requiredKey: 'ANTHROPIC_API_KEY',
    isAvailable: false,
  }
];

export const INITIAL_WORKFLOWS: WorkflowPipeline[] = [
  {
    id: 'WF-101',
    name: 'Automated Product Scouting & Store Publication',
    description: 'Autonomous end-to-end pipeline: Sourcing -> Margin Verification -> Copywriting -> Security Audit -> CTO Sign-off -> Store Publishing.',
    status: 'COMPLETED',
    currentStepIndex: 5,
    updatedAt: new Date().toISOString(),
    steps: [
      { stepId: 's1', title: 'Find High-Margin Product', agent: 'Product Hunter Agent', action: 'Scan CJ Dropshipping catalog for >60% gross margin', status: 'COMPLETED', output: { sku: 'CJ-ECOM-8821', margin: '68.5%', estRetail: '$49.99' } },
      { stepId: 's2', title: 'Verify Supplier & Inventory', agent: 'Supplier Agent', action: 'Check stock levels and dispatch latency', status: 'COMPLETED', output: { stock: 4500, deliveryDays: 4 } },
      { stepId: 's3', title: 'Generate Ad Copy & Hook Angles', agent: 'Marketing Agent', action: 'Craft Meta Ads copy variations via Gemini 3.6 Flash', status: 'COMPLETED', output: { hooksGenerated: 3, budgetRequested: '$50.00/day' } },
      { stepId: 's4', title: 'Policy Engine Check', agent: 'Approval Agent', action: 'Validate budget against adSpendDailyCap ($50.00)', status: 'COMPLETED', output: { policyPassed: true } },
      { stepId: 's5', title: 'Security & Secret Scan', agent: 'Security Agent', action: 'Scan generated code and API routes for secret leaks', status: 'COMPLETED', output: { clean: true } },
      { stepId: 's6', title: 'CTO Final Sign-Off', agent: 'CTO Agent', action: 'Final verification before catalog sync', status: 'COMPLETED', output: { status: 'APPROVED_AND_LIVE' } }
    ]
  },
  {
    id: 'WF-102',
    name: 'Financial Audit & Reserve Vault Sweep',
    description: 'Financial ledger verification, net margin check, and PayPal reserve vault sweep directive.',
    status: 'IDLE',
    currentStepIndex: 0,
    updatedAt: new Date().toISOString(),
    steps: [
      { stepId: 'f1', title: 'Gather Daily Revenue & COGS', agent: 'Finance Agent', action: 'Aggregate Stripe, PayPal, and CJ order costs', status: 'PENDING' },
      { stepId: 'f2', title: 'Margin Target Verification', agent: 'Finance Agent', action: 'Verify net profit margin >= minNetMarginPercentage (40%)', status: 'PENDING' },
      { stepId: 'f3', title: 'Check Policy Transfer Threshold', agent: 'Approval Agent', action: 'Compare sweep amount against transferApprovalThreshold ($500.00)', status: 'PENDING' },
      { stepId: 'f4', title: 'Execute Vault Sweep', agent: 'Finance Agent', action: 'Transfer surplus net profit to Reserve Vault', status: 'PENDING' }
    ]
  }
];

export const COMPONENT_AUDIT_LIST: ComponentAuditItem[] = [
  { id: 'c1', name: 'Phase 1 Blueprint & Documentation UI', layer: 'Presentation', status: 'REAL IMPLEMENTATION', notes: 'Fully interactive React 19 visual architecture viewer with sign-off capability.' },
  { id: 'c2', name: 'Vite + Express Dual Server Entry (Port 3000)', layer: 'Presentation', status: 'REAL IMPLEMENTATION', notes: 'Native node server with Vite dev middleware proxy & production bundle pipeline.' },
  { id: 'c3', name: '@google/genai SDK Gemini 3.6 Flash Server Proxy', layer: 'Agent Engine', status: 'REAL IMPLEMENTATION', notes: 'Server-side route proxying /api/agent/dispatch using process.env.GEMINI_API_KEY.' },
  { id: 'c4', name: '16 AI Agents Metadata Matrix', layer: 'Agent Engine', status: 'REAL IMPLEMENTATION', notes: 'Complete prompt definitions, inputs/outputs, tools, and fallbacks.' },
  { id: 'c5', name: 'Human-in-the-Loop Gatekeeper & Policy Engine', layer: 'Orchestration Kernel', status: 'REAL IMPLEMENTATION', notes: 'Enforces configurable policy limits for approval triggers and manual sign-offs.' },
  { id: 'c6', name: 'In-Memory Task Queue & Audit Logger', layer: 'Orchestration Kernel', status: 'MOCK IMPLEMENTATION', notes: 'Functional runtime state, awaiting production Supabase DB persistence.' },
  { id: 'c7', name: 'CJ Dropshipping Order Fulfillment API', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires CJ_DROPSHIPPING_API_KEY secret and endpoint wiring.' },
  { id: 'c8', name: 'PayPal REST Sweeps & Payment Gateway', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires PAYPAL_CLIENT_ID and PAYPAL_SECRET environment credentials.' },
  { id: 'c9', name: 'Meta Marketing Ads Graph API', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires META_ADS_ACCESS_TOKEN and Ad Account authorization.' },
  { id: 'c10', name: 'WhatsApp Cloud API Webhook Gateway', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires WHATSAPP_TOKEN & PHONE_ID credentials.' },
  { id: 'c11', name: 'Supabase PostgreSQL & pgvector Engine', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires SUPABASE_URL & ANON_KEY environment connection.' },
  { id: 'c12', name: 'Google Analytics 4 Metric Aggregator', layer: 'Adapters & DB', status: 'ARCHITECTURE ONLY', notes: 'Requires GA4_MEASUREMENT_ID & OAuth access token.' }
];

export const CAPABILITY_MATRIX: CapabilityItem[] = [
  {
    id: 'cap-1',
    feature: 'Gemini Server-Side Decision Engine',
    status: 'REAL IMPLEMENTATION',
    requiredIntegration: '@google/genai SDK (GEMINI_API_KEY)',
    verificationMethod: 'Execute server HTTP POST /api/agent/dispatch with prompt and verify model JSON response.'
  },
  {
    id: 'cap-2',
    feature: 'Configurable Policy Safety Engine',
    status: 'REAL IMPLEMENTATION',
    requiredIntegration: 'In-Memory State / API / Policy Store',
    verificationMethod: 'POST /api/policies to update caps, then dispatch task exceeding cap and verify REQUIRES_APPROVAL trigger.'
  },
  {
    id: 'cap-3',
    feature: 'Human-in-the-Loop Approval Center',
    status: 'REAL IMPLEMENTATION',
    requiredIntegration: 'Approval Gate Router',
    verificationMethod: 'Submit high-impact task, verify pending card creation, execute POST /api/approvals/:id/action.'
  },
  {
    id: 'cap-4',
    feature: 'Auditable Execution Trace System',
    status: 'REAL IMPLEMENTATION',
    requiredIntegration: 'Trace ID Generator + Audit Log Stream',
    verificationMethod: 'Dispatch agent action and verify immutable log entry generated with unique traceId.'
  },
  {
    id: 'cap-5',
    feature: 'Live Revenue & P&L Analytics',
    status: 'ARCHITECTURE ONLY',
    requiredIntegration: 'PayPal API + Stripe API + CJ API',
    verificationMethod: 'Displays NOT CONNECTED until API credentials are wired to backend.'
  },
  {
    id: 'cap-6',
    feature: 'CJ Dropshipping Auto-Fulfillment',
    status: 'ARCHITECTURE ONLY',
    requiredIntegration: 'CJ Dropshipping REST API (CJ_DROPSHIPPING_API_KEY)',
    verificationMethod: 'API HTTP probe to CJ order endpoint returning valid tracking payload.'
  },
  {
    id: 'cap-7',
    feature: 'WhatsApp 1-Click Interactive Approvals',
    status: 'ARCHITECTURE ONLY',
    requiredIntegration: 'Meta WhatsApp Business Cloud API',
    verificationMethod: 'Receive incoming webhook POST on /api/webhook/whatsapp with button payload.'
  },
  {
    id: 'cap-8',
    feature: 'Vector Memory Semantic Search (pgvector)',
    status: 'ARCHITECTURE ONLY',
    requiredIntegration: 'Supabase PostgreSQL + pgvector extension',
    verificationMethod: 'Query match_documents RPC procedure returning cosine similarity matches > 0.80.'
  }
];

export const AGENT_RUNTIME_SPECS: Record<string, AgentRuntimeSpec> = {
  'orchestrator-agent': {
    agentId: 'orchestrator-agent',
    systemPrompt: 'You are the Master Orchestrator Kernel of KITORA COMMAND CENTER. Receive owner intent, fetch business memory, route directives to sub-agents, enforce policy safety thresholds, and log immutable audit trails.',
    memoryAccess: {
      shortTerm: 'In-session message thread (max 8,000 tokens)',
      longTerm: 'Supabase pgvector (Top-5 historical execution logs)',
      businessMemory: 'Configurable Safety Policy & Store Operating Directives',
      vectorStore: 'kitora_vector_memories table (768-dim embeddings)'
    },
    tools: ['dispatch_sub_agent', 'query_memory', 'evaluate_policy', 'log_audit_event'],
    permissions: {
      role: 'SYSTEM_KERNEL',
      readScope: 'ALL_MODULES',
      writeScope: 'TASK_QUEUE, AUDIT_LOGS, APPROVAL_QUEUE',
      approvalRequiredFor: 'System re-initialization, policy limit overrides'
    },
    taskExecutionLoop: [
      '1. Receive Owner Intent / Trigger Event',
      '2. Query Memory Engine for relevant context',
      '3. Evaluate safety rules against Policy Configuration',
      '4. If action exceeds policy cap -> Route to Approval Queue & HALT',
      '5. Else -> Dispatch sub-agent directive via Gemini 3.6 Flash',
      '6. Write immutable record to Audit Log Stream'
    ],
    auditLogging: {
      traceIdFormat: 'TRACE-ORCH-YYYYMMDD-XXXX',
      logLevel: 'INFO',
      snapshotFields: ['intent', 'targetAgent', 'policyResult', 'latencyMs']
    }
  },
  'finance-agent': {
    agentId: 'finance-agent',
    systemPrompt: 'You are the CFO Agent for KITORA. Monitor financial transactions, verify net profit margins >= policy target, and prepare PayPal sweep directives within policy thresholds.',
    memoryAccess: {
      shortTerm: 'Current transaction context buffer',
      longTerm: 'Historical daily P&L ledgers',
      businessMemory: 'Target Net Profit Margin Policy & Transfer Limits',
      vectorStore: 'financial_decisions vector index'
    },
    tools: ['paypal_ledger_read', 'calculate_margins', 'prepare_sweep_order'],
    permissions: {
      role: 'CFO_AGENT',
      readScope: 'FINANCIAL_LEDGER, PAYPAL_STATEMENTS',
      writeScope: 'TRANSFER_QUEUE (Staged)',
      approvalRequiredFor: 'Transfers exceeding Policy transferApprovalThreshold ($500.00 default)'
    },
    taskExecutionLoop: [
      '1. Fetch incoming ledger entries from PayPal / Stripe',
      '2. Calculate gross revenue, COGS, and net margin',
      '3. Compare transfer amount against policy cap',
      '4. Trigger Approval Agent if transfer threshold exceeded',
      '5. Log financial operation with trace ID'
    ],
    auditLogging: {
      traceIdFormat: 'TRACE-FIN-YYYYMMDD-XXXX',
      logLevel: 'INFO',
      snapshotFields: ['grossAmount', 'netMargin', 'sweepDestination', 'approvalStatus']
    }
  },
  'marketing-agent': {
    agentId: 'marketing-agent',
    systemPrompt: 'You are the Head of Performance Marketing for KITORA. Generate high-converting ad copy using Gemini AI, calculate target CAC/ROAS, and submit campaign budgets.',
    memoryAccess: {
      shortTerm: 'Active campaign prompt context',
      longTerm: 'Top performing ad copy historical embeddings',
      businessMemory: 'Ad Spend Policy Caps & Brand Voice Rules',
      vectorStore: 'ad_creative_memory vector index'
    },
    tools: ['generate_ad_copy', 'meta_ads_draft', 'roas_analyzer'],
    permissions: {
      role: 'GROWTH_AGENT',
      readScope: 'CAMPAIGN_ANALYTICS, PRODUCT_CATALOG',
      writeScope: 'AD_CAMPAIGN_DRAFTS',
      approvalRequiredFor: 'Daily campaign ad budgets exceeding Policy adSpendDailyCap ($50.00 default)'
    },
    taskExecutionLoop: [
      '1. Fetch target product details and audience profile',
      '2. Retrieve past winning ad hooks from Memory Engine',
      '3. Call Gemini API to generate 3 ad copy variations',
      '4. Check daily budget against Policy adSpendDailyCap',
      '5. If budget > cap -> Request Owner Approval',
      '6. Log creative generation event'
    ],
    auditLogging: {
      traceIdFormat: 'TRACE-MKT-YYYYMMDD-XXXX',
      logLevel: 'INFO',
      snapshotFields: ['productSku', 'adHooks', 'dailyBudget', 'approvalStatus']
    }
  }
};

export const MEMORY_ENGINE_SPEC: MemoryEngineSpec = {
  shortTermMemory: {
    type: 'In-Session Context Window',
    capacity: '8,000 Tokens Working Memory Buffer',
    retention: 'Transient per HTTP request / Agent execution cycle'
  },
  longTermMemory: {
    type: 'Vectorized Execution Memory',
    storage: 'Supabase PostgreSQL + pgvector Extension',
    indexing: 'HNSW index for cosine similarity queries'
  },
  businessMemory: {
    type: 'Configurable Policy & Operational Directives',
    contents: [
      'Target Net Margin Minimum (Default: 40%)',
      'Daily Ad Spend Cap (Default: $50.00)',
      'Transfer Approval Threshold (Default: $500.00)',
      'Customer Refund Auto-Resolution Limit (Default: $30.00)',
      'Brand Tone: Empowering, concise, luxury e-commerce minimalist',
      'Owner Communication Protocol: < 5 mins/day via WhatsApp'
    ]
  },
  vectorStorage: {
    engine: 'pgvector (Supabase)',
    dimensions: 768,
    metric: 'Cosine Distance (1 - Cosine Similarity)'
  },
  retrievalRules: {
    minSimilarityScore: 0.80,
    maxTopK: 5,
    recencyWeight: '0.85 * Similarity + 0.15 * RecencyDecay(days)',
    fallback: 'Relational SQL keyword match if vector index unavailable'
  }
};

export const AGENTS_MATRIX: AgentInfo[] = [
  {
    id: 'cto-agent',
    name: 'CTO Agent',
    role: 'Chief Technology Officer',
    category: 'Strategic',
    description: 'Oversees software architecture, technical debt, system performance, and infrastructure scalability for KITORA.',
    primaryPrompt: 'You are the CTO Agent for KITORA Command Center. Evaluate architecture integrity, review code PRs, monitor API latencies, and optimize system design.',
    inputs: ['System Metrics', 'GitHub Commits', 'Error Logs', 'Infrastructure Costs'],
    outputs: ['Architecture RFCs', 'Code Review Reports', 'Refactoring Tasks', 'Scaling Directives'],
    toolsAllowed: ['github_api', 'cloud_run_logs', 'system_diagnostics'],
    humanApprovalThreshold: 'System architectural changes, new third-party paid dependency additions ($>50/mo)',
    fallbackStrategy: 'Fallback to Orchestrator default safety configuration and freeze deployment pipeline.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'engineering-agent',
    name: 'Engineering Agent',
    role: 'Full-Stack Developer',
    category: 'Operational',
    description: 'Generates production code, fixes bug reports, creates micro-services, and handles integration patches.',
    primaryPrompt: 'You are the Lead Engineer for KITORA. Write modular TypeScript code adhering to clean architecture. Implement API routes and UI components.',
    inputs: ['Task Requirements', 'Bug Tickets', 'API Schemas'],
    outputs: ['Clean TypeScript Code', 'Pull Requests', 'Bug Fix Patches'],
    toolsAllowed: ['git_commit', 'code_editor', 'compiler_tool'],
    humanApprovalThreshold: 'Major core code merges into production branch',
    fallbackStrategy: 'Revert commit to last known green build and re-queue ticket for human engineer.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'qa-agent',
    name: 'QA Agent',
    role: 'Quality Assurance & Automated Testing',
    category: 'Operational',
    description: 'Validates API endpoints, runs automated unit and end-to-end tests, checks visual regressions before production release.',
    primaryPrompt: 'You are the QA Agent for KITORA. Test all code changes, verify edge cases, check API responses, and ensure zero runtime crashes.',
    inputs: ['Pull Requests', 'Build Artifacts', 'API Endpoints'],
    outputs: ['Test Execution Reports', 'Bug Reports', 'Release Verification Badges'],
    toolsAllowed: ['test_runner', 'http_client', 'dom_validator'],
    humanApprovalThreshold: 'None (Runs automatically on every commit)',
    fallbackStrategy: 'Block release pipeline if test pass rate < 100%.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'security-agent',
    name: 'Security Agent',
    role: 'Chief Information Security Officer',
    category: 'Governance',
    description: 'Scans for API key leaks, audits secret rotation, enforces role-based access control, and guards against injection attacks.',
    primaryPrompt: 'You are the CISO Agent for KITORA. Enforce secret isolation, validate OAuth tokens, review OWASP top 10 risks, and monitor unusual request volumes.',
    inputs: ['Code Diff', 'Environment Variables', 'API Traffic Logs'],
    outputs: ['Security Vulnerability Audit', 'Token Rotation Alerts', 'Access Rule Updates'],
    toolsAllowed: ['secret_scanner', 'firewall_rules', 'auth_auditor'],
    humanApprovalThreshold: 'Revoking key permissions or blocking IP ranges',
    fallbackStrategy: 'Immediately lock compromised API keys and isolate affected server container.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'finance-agent',
    name: 'Finance Agent',
    role: 'Chief Financial Officer',
    category: 'Strategic',
    description: 'Tracks net profits, manages PayPal balance sweeps, calculates product profit margins, and computes ad spend ROI.',
    primaryPrompt: 'You are the CFO Agent for KITORA. Monitor cash inflows and outflows against dynamic Policy limits. Maintain target margin %.',
    inputs: ['PayPal Ledger', 'Stripe Statements', 'CJ Dropshipping Costs', 'Ad Spend Reports'],
    outputs: ['Daily Financial P&L Statement', 'PayPal Transfer Directives', 'Budget Reallocations'],
    toolsAllowed: ['paypal_sdk', 'bank_ledger', 'margin_calculator'],
    humanApprovalThreshold: 'Fund transfers out of PayPal exceeding Policy transferApprovalThreshold ($500.00 default)',
    fallbackStrategy: 'Hold pending transfers in reserve account and notify Owner via WhatsApp.',
    statusTag: 'ARCHITECTURE ONLY'
  },
  {
    id: 'marketing-agent',
    name: 'Marketing Agent',
    role: 'Head of Performance Marketing',
    category: 'Growth',
    description: 'Generates ad copy, hook angles, targets lookalike audiences, and optimizes Meta Ads & Google Ads campaigns.',
    primaryPrompt: 'You are the Marketing Agent for KITORA. Craft high-converting Meta/Google ad copy via Gemini 3.6 Flash, identify viral hooks, and submit ad budgets.',
    inputs: ['Product Catalog', 'Customer Demographics', 'Past Ad ROAS Data'],
    outputs: ['Ad Copy Variants', 'Targeting Parameters', 'Campaign Budget Plans'],
    toolsAllowed: ['meta_ads_api', 'google_ads_api', 'copywriting_engine'],
    humanApprovalThreshold: 'Daily ad campaign budgets > Policy adSpendDailyCap ($50.00 default)',
    fallbackStrategy: 'Pause underperforming ads automatically and scale winning ads within safety cap.',
    statusTag: 'MOCK IMPLEMENTATION'
  },
  {
    id: 'seo-agent',
    name: 'SEO Agent',
    role: 'Organic Search Strategist',
    category: 'Growth',
    description: 'Optimizes product page meta tags, generates SEO keyword blogs, manages schema markup, and tracks Search Console rankings.',
    primaryPrompt: 'You are the SEO Specialist for KITORA. Optimize store pages for high-intent e-commerce search keywords, build structured product JSON-LD, and generate organic traffic.',
    inputs: ['Product Keywords', 'Google Search Console Data', 'Competitor Rank Data'],
    outputs: ['Meta Titles & Descriptions', 'Structured Schema Data', 'Optimized Product Copy'],
    toolsAllowed: ['google_search_console', 'keyword_explorer', 'sitemap_generator'],
    humanApprovalThreshold: 'None (Auto-applies meta changes)',
    fallbackStrategy: 'Roll back metadata changes if impressions drop > 15% over 14 days.',
    statusTag: 'MOCK IMPLEMENTATION'
  },
  {
    id: 'customer-support-agent',
    name: 'Customer Support Agent',
    role: 'Autonomous Support Manager',
    category: 'Operational',
    description: 'Resolves customer emails/chat tickets, provides tracking updates, processes replacement orders, and mitigates refunds with high empathy.',
    primaryPrompt: 'You are the Customer Support Agent for KITORA. Provide empathetic, accurate support responses via Gemini AI.',
    inputs: ['Customer Email/Chat', 'Order Status', 'Tracking Numbers', 'Return Policy'],
    outputs: ['Automated Customer Replies', 'Tracking Status Badges', 'Refund Authorization Drafts'],
    toolsAllowed: ['resend_email_api', 'cj_tracking_api', 'order_database'],
    humanApprovalThreshold: 'Full monetary refund requests > Policy refundAutoApproveLimit ($30.00 default)',
    fallbackStrategy: 'Offer customer store credit or replacement item before escalating refund to human owner.',
    statusTag: 'MOCK IMPLEMENTATION'
  },
  {
    id: 'product-hunter-agent',
    name: 'Product Hunter Agent',
    role: 'E-Commerce Sourcing Scout',
    category: 'Growth',
    description: 'Scrapes CJ Dropshipping & viral trends, identifies winning e-commerce products with > 65% gross margin, and analyzes competition.',
    primaryPrompt: 'You are the Product Hunter Agent for KITORA. Find trending high-margin products on CJ Dropshipping.',
    inputs: ['CJ Dropshipping Catalog', 'Social Media Trends', 'Supplier Delivery Scores'],
    outputs: ['Winning Product Briefs', 'COGS vs Retail Pricing Models', 'Import Directives'],
    toolsAllowed: ['cj_dropshipping_api', 'trend_scraper', 'competitor_price_analyzer'],
    humanApprovalThreshold: 'Publishing new product to live store catalog',
    fallbackStrategy: 'Rank alternative products by supplier rating and gross profit margin.',
    statusTag: 'MOCK IMPLEMENTATION'
  },
  {
    id: 'supplier-agent',
    name: 'Supplier Agent',
    role: 'Supply Chain & Fulfillment Logistics',
    category: 'Operational',
    description: 'Automates CJ Dropshipping order placement, syncs inventory levels, tracks fulfillment bottlenecks, and negotiates bulk pricing.',
    primaryPrompt: 'You are the Supplier Logistics Agent for KITORA. Auto-fulfill customer orders on CJ Dropshipping upon payment confirmation.',
    inputs: ['New Paid Orders', 'Supplier Inventory Count', 'Shipping Rates'],
    outputs: ['Fulfillment Orders Sent to CJ', 'Synced Inventory Counts', 'Shipping Delays Alerts'],
    toolsAllowed: ['cj_order_fulfillment_api', 'inventory_syncer'],
    humanApprovalThreshold: 'Supplier price increases > 10% or inventory out of stock',
    fallbackStrategy: 'Switch to pre-configured secondary CJ supplier offering identical SKU.',
    statusTag: 'ARCHITECTURE ONLY'
  },
  {
    id: 'analytics-agent',
    name: 'Analytics Agent',
    role: 'Chief Data Officer',
    category: 'Strategic',
    description: 'Aggregates Google Analytics 4, Meta Pixel, and store conversions into executive 1-page daily briefings for the Owner.',
    primaryPrompt: 'You are the Analytics Agent for KITORA COMMAND CENTER. Aggregate connected store traffic and net metrics into daily reports.',
    inputs: ['Google Analytics 4', 'Shopify/Store Orders', 'Meta Ads Insights', 'PayPal Transactions'],
    outputs: ['Daily Executive Briefing', 'Conversion Funnel Reports', 'Anomaly Detection Alerts'],
    toolsAllowed: ['ga4_api', 'database_queries', 'pdf_report_generator'],
    humanApprovalThreshold: 'None (Runs on automated schedule)',
    fallbackStrategy: 'Use cached snapshot if GA4/Ad metrics API experiences intermittent downtime.',
    statusTag: 'MOCK IMPLEMENTATION'
  },
  {
    id: 'deployment-agent',
    name: 'Deployment Agent',
    role: 'DevOps & Cloud Release Engineer',
    category: 'Infrastructure',
    description: 'Manages Cloud Run deployments, environment variables, GitHub Actions CI/CD workflows, and zero-downtime rollouts.',
    primaryPrompt: 'You are the DevOps Agent for KITORA. Trigger builds, verify container health, run database migrations, and perform rollback on errors.',
    inputs: ['Verified Code Builds', 'Cloud Run Status', 'Environment Secrets'],
    outputs: ['Production Deployment Logs', 'Container Health Reports', 'Rollback Triggers'],
    toolsAllowed: ['cloud_run_deployer', 'github_actions_api', 'docker_build_client'],
    humanApprovalThreshold: 'Major database migration or breaking infrastructure change',
    fallbackStrategy: 'Auto-rollback container instance to previous deployment revision tag within 30 seconds of failure.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'workflow-agent',
    name: 'Workflow Agent',
    role: 'Process & Automation Architect',
    category: 'Operational',
    description: 'Orchestrates multi-agent pipelines, enforces state transition rules, handles retry backoffs, and manages cron triggers.',
    primaryPrompt: 'You are the Workflow Engine Agent for KITORA. Execute scheduled routines and manage retry queues up to Policy maxAutoRetryCount.',
    inputs: ['Task Queue State', 'Cron Triggers', 'Dependency Graphs'],
    outputs: ['Workflow Step Execution', 'Retry Scheduled Queue', 'State Transition Events'],
    toolsAllowed: ['task_scheduler', 'state_machine', 'event_emitter'],
    humanApprovalThreshold: 'Tasks stuck in retry loop > Policy maxAutoRetryCount (5 default)',
    fallbackStrategy: 'Move failed step to Dead Letter Queue (DLQ) and issue warning to Master Orchestrator.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'memory-agent',
    name: 'Memory Agent',
    role: 'Knowledge Base & Long-Term Context Manager',
    category: 'Infrastructure',
    description: 'Stores historical business decisions, customer preferences, winning ad creative memories, and supplier historical reliability scores.',
    primaryPrompt: 'You are the Memory Agent for KITORA COMMAND CENTER. Index operational decisions and guidelines for semantic retrieval.',
    inputs: ['Audit Logs', 'Approved Decisons', 'Customer Feedback', 'Winning Hooks'],
    outputs: ['Relevant Context Embeddings', 'Historical Decision Lookups', 'Knowledge Graph Updates'],
    toolsAllowed: ['supabase_pgvector', 'semantic_search', 'memory_indexer'],
    humanApprovalThreshold: 'None (Background continuous indexing)',
    fallbackStrategy: 'Use standard relational keyword search if vector similarity index is re-building.',
    statusTag: 'ARCHITECTURE ONLY'
  },
  {
    id: 'approval-agent',
    name: 'Approval Agent',
    role: 'Human-in-the-Loop Gatekeeper',
    category: 'Governance',
    description: 'Monitors all agent actions against configurable Policy thresholds and formats approval cards before execution.',
    primaryPrompt: 'You are the Human-in-the-Loop Approval Agent for KITORA. When any agent action exceeds Policy limits, draft an alert for the Owner.',
    inputs: ['Pending High-Impact Tasks', 'Configurable Policy Rules', 'Risk Scores'],
    outputs: ['WhatsApp Approval Messages', 'Email Approval Notifications', 'Action Authorization Signals'],
    toolsAllowed: ['whatsapp_cloud_api', 'resend_email_api', 'approval_gate_engine'],
    humanApprovalThreshold: 'Self-governing gatekeeper that requests owner authorization',
    fallbackStrategy: 'Keep task locked in REQUIRES_APPROVAL state indefinitely until human explicitly signs off.',
    statusTag: 'REAL IMPLEMENTATION'
  },
  {
    id: 'orchestrator-agent',
    name: 'Master Orchestrator Agent',
    role: 'Autonomous AI Operating System Kernel',
    category: 'Strategic',
    description: 'The supreme intelligence that routes directives, delegates to specific sub-agents, logs all audit traces, and enforces Policy rules.',
    primaryPrompt: 'You are the Master Orchestrator Kernel of KITORA COMMAND CENTER (KCC). Receive owner intents, break them down into agent directives, and enforce Policy rules.',
    inputs: ['Owner Directives', 'System Event Bus', 'Agent Health Heartbeats'],
    outputs: ['Agent Sub-Task Dispatches', 'System Audit Log Entries', 'Executive State Summaries'],
    toolsAllowed: ['system_kernel', 'event_bus_dispatcher', 'agent_router'],
    humanApprovalThreshold: 'System re-initialization or total business mode toggle',
    fallbackStrategy: 'Fallback to read-only diagnostic mode and request owner intervention.',
    statusTag: 'REAL IMPLEMENTATION'
  }
];

export const DB_SCHEMA_DRIZZLE = `// src/db/schema.ts - KITORA COMMAND CENTER Enterprise Schema
import { pgTable, uuid, text, timestamp, integer, boolean, numeric, jsonb } from 'drizzle-orm/pg-core';

export const companies = pgTable('companies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  status: text('status').notNull().default('ACTIVE'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stores = pgTable('stores', {
  id: uuid('id').primaryKey().defaultRandom(),
  companyId: uuid('company_id').references(() => companies.id).notNull(),
  name: text('name').notNull(),
  platform: text('platform').notNull(), // 'KITORA_NATIVE' | 'SHOPIFY'
  currency: text('currency').default('USD').notNull(),
  status: text('status').default('ACTIVE').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const policies = pgTable('policies', {
  id: uuid('id').primaryKey().defaultRandom(),
  adSpendDailyCap: numeric('ad_spend_daily_cap', { precision: 10, scale: 2 }).default('50.00').notNull(),
  transferApprovalThreshold: numeric('transfer_approval_threshold', { precision: 10, scale: 2 }).default('500.00').notNull(),
  refundAutoApproveLimit: numeric('refund_auto_approve_limit', { precision: 10, scale: 2 }).default('30.00').notNull(),
  minNetMarginPercentage: numeric('min_net_margin_percentage', { precision: 5, scale: 2 }).default('40.00').notNull(),
  maxAutoRetryCount: integer('max_auto_retry_count').default(5).notNull(),
  ownerNotificationChannel: text('owner_notification_channel').default('BOTH').notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  role: text('role').notNull(),
  category: text('category').notNull(),
  status: text('status').default('ONLINE').notNull(),
  statusTag: text('status_tag').default('REAL IMPLEMENTATION').notNull(),
  lastHeartbeat: timestamp('last_heartbeat').defaultNow(),
});

export const tasks = pgTable('tasks', {
  id: text('id').primaryKey(),
  storeId: uuid('store_id').references(() => stores.id),
  title: text('title').notNull(),
  agentId: text('agent_id').references(() => agents.id).notNull(),
  status: text('status').notNull(), // 'PENDING' | 'IN_PROGRESS' | 'REQUIRES_APPROVAL' | 'COMPLETED' | 'FAILED'
  priority: text('priority').notNull(), // 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  payload: jsonb('payload').notNull(),
  result: jsonb('result'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const approvals = pgTable('approvals', {
  id: text('id').primaryKey(),
  taskId: text('task_id').references(() => tasks.id).notNull(),
  agentId: text('agent_id').references(() => agents.id).notNull(),
  title: text('title').notNull(),
  impactScore: integer('impact_score').notNull(),
  financialImpact: numeric('financial_impact', { precision: 12, scale: 2 }),
  description: text('description').notNull(),
  whatsappMessagePreview: text('whatsapp_message_preview').notNull(),
  status: text('status').default('PENDING').notNull(), // 'PENDING' | 'APPROVED' | 'REJECTED'
  signedOffAt: timestamp('signed_off_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  traceId: text('trace_id').notNull(),
  agentId: text('agent_id').notNull(),
  action: text('action').notNull(),
  details: text('details').notNull(),
  status: text('status').notNull(),
  metadata: jsonb('metadata'),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
});
`;

export const API_SPECIFICATION = [
  { method: 'GET', path: '/api/system/info', desc: 'Get KCC system metadata, active store info, Gemini status, Policy rules, and Phase 1 sign-off state.' },
  { method: 'GET', path: '/api/policies', desc: 'Fetch current dynamic Policy Configuration (Ad Cap, Transfer Threshold, Refund Limit, Margin Target).' },
  { method: 'POST', path: '/api/policies', desc: 'Update configurable policy limits dynamically without code changes.' },
  { method: 'POST', path: '/api/agent/dispatch', desc: 'Route directive through Master Orchestrator to target agent powered by Gemini AI API.' },
  { method: 'GET', path: '/api/tasks', desc: 'Fetch real-time autonomous task queue with state filter (PENDING, REQUIRES_APPROVAL, etc).' },
  { method: 'POST', path: '/api/tasks', desc: 'Enqueue new autonomous directive or sub-task into Orchestrator pipeline.' },
  { method: 'GET', path: '/api/approvals', desc: 'Fetch pending human-in-the-loop decisions awaiting Owner authorization.' },
  { method: 'POST', path: '/api/approvals/:id/action', desc: 'Execute Owner decision (APPROVE or REJECT) with instant WhatsApp bridge trigger.' },
  { method: 'GET', path: '/api/audit-logs', desc: 'Query immutable audit log stream with agent trace ID and detailed execution payloads.' },
  { method: 'POST', path: '/api/phase1/sign-off', desc: 'Sign off on Phase 1 System Architecture Blueprint & unlock Live Operating Mode.' }
];

export const TECH_STACK = [
  { component: 'AI Engine & SDK', tech: '@google/genai SDK (gemini-3.6-flash)', role: 'Core reasoning, decision routing, ad copywriting, customer support.' },
  { component: 'Backend Runtime', tech: 'Node.js + Express (Port 3000)', role: 'Clean Architecture HTTP endpoints, Vite middleware, Gemini server-side proxy.' },
  { component: 'Frontend Framework', tech: 'React 19 + TypeScript + Motion', role: 'Executive Command Center UI, real-time status feeds, slate-950 dark canvas.' },
  { component: 'Styling Engine', tech: 'Tailwind CSS v4', role: 'Utility-first layout, responsive grids, high contrast readable typography.' },
  { component: 'Database & ORM', tech: 'Supabase PostgreSQL + Drizzle ORM', role: 'Relational data models, pgvector memory storage, audit trail persistence.' },
  { component: 'Fulfillment & Sourcing', tech: 'CJ Dropshipping REST API', role: 'Product catalog sourcing, inventory syncing, automated order fulfillment.' },
  { component: 'Financial Settlement', tech: 'PayPal REST SDK', role: 'Payment processing, profit retention sweeps, seller balance payouts.' },
  { component: 'Messaging & Notifications', tech: 'WhatsApp Business Cloud API + Resend', role: 'Instant Owner alerts for high-impact decision approvals (< 5 min/day workflow).' }
];

export const ROADMAP = [
  { phase: 'Phase 1', title: 'System Blueprint & Reality Audit (COMPLETED)', status: 'COMPLETE', tasks: ['Clean Architecture Design', '16 Independent AI Agents Matrix', 'Reality Audit & Capability Matrix', 'Agent Runtime Architecture Spec', 'Memory Engine Spec (Short/Long/Vector)', 'Configurable Policy Safety Engine', 'Drizzle SQL Database Schema', 'API Specification', 'Executive Sign-off Console'] },
  { phase: 'Phase 2', title: 'Core Orchestrator & Task Queue Engine', status: 'UPCOMING', tasks: ['Gemini Server Proxy Route', 'State Machine & Retry Backoff', 'Immutable Audit Trail Logger', 'Human-in-the-Loop Approval Gate'] },
  { phase: 'Phase 3', title: 'Dropshipping & Marketing Automation', status: 'UPCOMING', tasks: ['CJ Dropshipping REST Integration', 'Product Hunter Autonomous Scout', 'Meta Ads Campaign Creator', 'SEO Schema Auto-Injector'] },
  { phase: 'Phase 4', title: 'Financial Sweeps & WhatsApp Autonomy', status: 'UPCOMING', tasks: ['PayPal Balance Sweep Engine', 'WhatsApp Cloud API Webhooks', 'Automated Daily Email Briefing', 'Multi-Store Expansion Engine'] }
];

export const RISKS = [
  { risk: 'Uncontrolled Financial Budget Runaway', severity: 'CRITICAL', mitigation: 'Strict configurable Policy Engine enforcing Daily Ad Spend Cap & Transfer Approval Threshold with explicit Owner sign-off.' },
  { risk: 'AI Model Hallucination in Customer Support', severity: 'HIGH', mitigation: 'Strict system prompt constraints, schema validation, refund caps at Policy refundAutoApproveLimit max auto-resolution.' },
  { risk: 'Supplier Inventory Out-of-Stock Shock', severity: 'HIGH', mitigation: 'Supplier Agent runs hourly inventory polling; automatically routes to secondary CJ SKU backup upon drops.' },
  { risk: 'WhatsApp API Webhook Down Time', severity: 'MEDIUM', mitigation: 'Dual notification fallback: Resend Email backup notification sent simultaneously with 1-click magic link.' },
  { risk: 'API Key Leak & Unauthorized Access', severity: 'CRITICAL', mitigation: 'Server-side key proxying only (never exposed to browser), secret scanner tool in Security Agent pipeline.' }
];
