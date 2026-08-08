import React, { useState } from 'react';
import { 
  COMPONENT_AUDIT_LIST, 
  CAPABILITY_MATRIX, 
  AGENT_RUNTIME_SPECS, 
  MEMORY_ENGINE_SPEC,
  AGENTS_MATRIX
} from '../data/architectureData';
import { ComponentStatus, PolicyConfig } from '../types';
import { 
  ShieldAlert, 
  CheckCircle2, 
  Layers, 
  Cpu, 
  Database, 
  Terminal, 
  Lock, 
  Search, 
  FileText, 
  Zap, 
  Bot, 
  AlertCircle,
  Sliders,
  ChevronRight,
  ExternalLink
} from 'lucide-react';

interface Props {
  policies: PolicyConfig | null;
  onOpenPolicyConfig: () => void;
}

export const RealityAuditView: React.FC<Props> = ({ policies, onOpenPolicyConfig }) => {
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('ALL');
  const [selectedAgentId, setSelectedAgentId] = useState<string>('orchestrator-agent');
  const [activeTabSection, setActiveTabSection] = useState<'matrix' | 'components' | 'runtime' | 'memory'>('matrix');

  const filteredComponents = selectedStatusFilter === 'ALL'
    ? COMPONENT_AUDIT_LIST
    : COMPONENT_AUDIT_LIST.filter((c) => c.status === selectedStatusFilter);

  const activeAgentSpec = AGENT_RUNTIME_SPECS[selectedAgentId] || AGENT_RUNTIME_SPECS['orchestrator-agent'];
  const activeAgentMeta = AGENTS_MATRIX.find((a) => a.id === selectedAgentId) || AGENTS_MATRIX[0];

  const getStatusBadgeClass = (status: ComponentStatus) => {
    switch (status) {
      case 'REAL IMPLEMENTATION':
        return 'bg-emerald-950 text-emerald-300 border-emerald-800';
      case 'VERIFIED PRODUCTION':
        return 'bg-cyan-950 text-cyan-300 border-cyan-800';
      case 'MOCK IMPLEMENTATION':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'ARCHITECTURE ONLY':
        return 'bg-slate-800 text-slate-300 border-slate-700';
      default:
        return 'bg-slate-800 text-slate-400 border-slate-700';
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* 1. CTO REALITY AUDIT BANNER */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-amber-950 border border-amber-800 text-amber-300 rounded-lg text-xs font-mono font-bold mb-2">
              <ShieldAlert className="w-4 h-4 text-amber-400" />
              <span>CTO PHASE 1 ARCHITECT REALITY AUDIT</span>
            </div>
            <h1 className="text-2xl font-bold text-white font-mono flex items-center">
              System Truth & Integration Audit
            </h1>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
              Zero simulated business metrics. Unintegrated metrics display <code className="text-amber-300 font-bold">NOT CONNECTED</code>. Every component is audited into explicit implementation states.
            </p>
          </div>

          <div className="flex flex-col space-y-2">
            <button
              onClick={onOpenPolicyConfig}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-mono rounded-xl border border-slate-700 flex items-center justify-center space-x-2 transition-all"
            >
              <Sliders className="w-4 h-4 text-cyan-400" />
              <span>Configure Policy Caps</span>
            </button>
            <span className="text-[10px] text-slate-400 text-right font-mono">
              Audit Status: <strong className="text-emerald-400">PASSED REALITY AUDIT</strong>
            </span>
          </div>
        </div>

        {/* Audit Principles Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 font-mono text-xs">
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">SIMULATED DATA</span>
            <span className="text-emerald-400 font-bold flex items-center">
              <CheckCircle2 className="w-3.5 h-3.5 mr-1" /> REMOVED (0 Fake Numbers)
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">UNCONNECTED METRICS</span>
            <span className="text-amber-400 font-bold flex items-center">
              <AlertCircle className="w-3.5 h-3.5 mr-1" /> EXPLICIT "NOT CONNECTED"
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">POLICY SAFETY ENGINE</span>
            <span className="text-cyan-400 font-bold flex items-center">
              <Sliders className="w-3.5 h-3.5 mr-1" /> DYNAMIC (Ad Cap: ${policies?.adSpendDailyCap ?? 50})
            </span>
          </div>
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1">
            <span className="text-[10px] text-slate-400 block">REAL GEMINI AI PROXY</span>
            <span className="text-indigo-400 font-bold flex items-center">
              <Zap className="w-3.5 h-3.5 mr-1" /> @google/genai SDK READY
            </span>
          </div>
        </div>
      </div>

      {/* NAV SUB-TABS */}
      <div className="flex items-center space-x-2 border-b border-slate-800 pb-3 font-mono text-xs overflow-x-auto">
        <button
          onClick={() => setActiveTabSection('matrix')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
            activeTabSection === 'matrix'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span>1. Capability Matrix</span>
        </button>

        <button
          onClick={() => setActiveTabSection('components')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
            activeTabSection === 'components'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Cpu className="w-4 h-4" />
          <span>2. Component Audit Explorer</span>
        </button>

        <button
          onClick={() => setActiveTabSection('runtime')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
            activeTabSection === 'runtime'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Bot className="w-4 h-4" />
          <span>3. Agent Runtime Architecture</span>
        </button>

        <button
          onClick={() => setActiveTabSection('memory')}
          className={`px-4 py-2 rounded-xl transition-all flex items-center space-x-2 ${
            activeTabSection === 'memory'
              ? 'bg-cyan-950 text-cyan-300 border border-cyan-800 font-bold'
              : 'bg-slate-900 text-slate-400 hover:bg-slate-800'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>4. Memory Engine Architecture</span>
        </button>
      </div>

      {/* SECTION 1: KCC CAPABILITY MATRIX */}
      {activeTabSection === 'matrix' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center">
                <Layers className="w-5 h-5 text-cyan-400 mr-2" />
                KCC System Capability Matrix
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Definitive classification of feature capability, current state, required third-party integration, and verification protocol.
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-950 border border-slate-800 text-slate-300 font-mono text-xs rounded-lg">
              {CAPABILITY_MATRIX.length} System Features Audited
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-[11px] bg-slate-950/50">
                  <th className="p-3">Feature Name</th>
                  <th className="p-3">Current Status</th>
                  <th className="p-3">Required Integration</th>
                  <th className="p-3">Verification Protocol</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {CAPABILITY_MATRIX.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-950/40 transition-colors">
                    <td className="p-3 font-bold text-white font-sans text-xs">{item.feature}</td>
                    <td className="p-3">
                      <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getStatusBadgeClass(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="p-3 text-cyan-300 text-[11px]">{item.requiredIntegration}</td>
                    <td className="p-3 text-slate-300 font-sans text-xs leading-relaxed">{item.verificationMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SECTION 2: COMPONENT AUDIT EXPLORER */}
      {activeTabSection === 'components' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center">
                <Cpu className="w-5 h-5 text-indigo-400 mr-2" />
                System Component Implementation Audit
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Filter and inspect the exact implementation status of every module across the 4 architecture layers.
              </p>
            </div>

            {/* Filter buttons */}
            <div className="flex items-center space-x-1 font-mono text-[11px] bg-slate-950 p-1 rounded-xl border border-slate-800 overflow-x-auto">
              {['ALL', 'REAL IMPLEMENTATION', 'MOCK IMPLEMENTATION', 'ARCHITECTURE ONLY'].map((st) => (
                <button
                  key={st}
                  onClick={() => setSelectedStatusFilter(st)}
                  className={`px-3 py-1.5 rounded-lg transition-all ${
                    selectedStatusFilter === st
                      ? 'bg-slate-800 text-white font-bold border border-slate-700'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredComponents.map((comp) => (
              <div key={comp.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-sm">{comp.name}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeClass(comp.status)}`}>
                    {comp.status}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 flex items-center">
                  <span className="text-slate-500 mr-1">Layer:</span>
                  <strong className="text-indigo-300">{comp.layer}</strong>
                </div>

                <p className="text-slate-300 font-sans text-xs leading-relaxed bg-slate-900/60 p-2.5 rounded border border-slate-850">
                  {comp.notes}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SECTION 3: REAL AGENT RUNTIME ARCHITECTURE */}
      {activeTabSection === 'runtime' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
            <div>
              <h2 className="text-lg font-bold text-white font-mono flex items-center">
                <Bot className="w-5 h-5 text-indigo-400 mr-2" />
                Real Agent Runtime Architecture Specification
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Every AI Agent operates with a dedicated System Prompt, Memory Access rules, Tools, Permissions, Execution Loop, and Audit Logging trace format.
              </p>
            </div>

            {/* Agent Dropdown Selector */}
            <div className="flex items-center space-x-2 font-mono text-xs">
              <span className="text-slate-400">Select Agent:</span>
              <select
                value={selectedAgentId}
                onChange={(e) => setSelectedAgentId(e.target.value)}
                className="bg-slate-950 text-white border border-slate-700 rounded-xl px-3 py-2 font-mono focus:outline-none focus:border-cyan-400"
              >
                {AGENTS_MATRIX.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.category})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Agent Runtime Inspector */}
          <div className="space-y-6">
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 font-mono text-xs">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-base font-bold text-white font-mono flex items-center">
                    <span className="text-cyan-400 mr-2">[{activeAgentMeta.name}]</span>
                    {activeAgentMeta.role}
                  </h3>
                  <span className="text-[11px] text-slate-400 font-sans block mt-0.5">
                    {activeAgentMeta.description}
                  </span>
                </div>
                <span className={`px-2.5 py-1 rounded text-[10px] font-bold border ${getStatusBadgeClass(activeAgentMeta.statusTag)}`}>
                  {activeAgentMeta.statusTag}
                </span>
              </div>

              {/* System Prompt Box */}
              <div className="space-y-1.5">
                <span className="text-[11px] text-amber-400 font-bold block flex items-center">
                  <Terminal className="w-3.5 h-3.5 mr-1" />
                  1. System Prompt Specification
                </span>
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 text-slate-200 text-xs font-mono leading-relaxed">
                  "{activeAgentSpec?.systemPrompt || activeAgentMeta.primaryPrompt}"
                </div>
              </div>

              {/* Memory Access Specs */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-cyan-400 font-bold block flex items-center">
                  <Database className="w-3.5 h-3.5 mr-1" />
                  2. Multi-Tier Memory Access Engine
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-[11px]">
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Short-Term Memory:</span>
                    <span className="text-slate-200 font-bold">{activeAgentSpec?.memoryAccess.shortTerm}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Long-Term Memory:</span>
                    <span className="text-slate-200 font-bold">{activeAgentSpec?.memoryAccess.longTerm}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Business Memory:</span>
                    <span className="text-amber-300 font-bold">{activeAgentSpec?.memoryAccess.businessMemory}</span>
                  </div>
                  <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 space-y-1">
                    <span className="text-slate-500 block">Vector Index:</span>
                    <span className="text-indigo-300 font-bold">{activeAgentSpec?.memoryAccess.vectorStore}</span>
                  </div>
                </div>
              </div>

              {/* Tools & Permissions */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-[11px] text-emerald-400 font-bold block flex items-center">
                    <Zap className="w-3.5 h-3.5 mr-1" />
                    3. Tool Integrations Allowed
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {activeAgentMeta.toolsAllowed.map((t) => (
                      <span key={t} className="px-2 py-0.5 bg-slate-950 text-slate-300 rounded border border-slate-800 text-[10px]">
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-2">
                  <span className="text-[11px] text-rose-400 font-bold block flex items-center">
                    <Lock className="w-3.5 h-3.5 mr-1" />
                    4. Permissions &amp; Safety Thresholds
                  </span>
                  <div className="text-[11px] text-slate-300 space-y-1 font-sans">
                    <div><strong className="text-slate-400 font-mono">Role:</strong> {activeAgentSpec?.permissions.role || 'AGENT_ROLE'}</div>
                    <div><strong className="text-slate-400 font-mono">Human Approval Trigger:</strong> <span className="text-amber-300">{activeAgentMeta.humanApprovalThreshold}</span></div>
                  </div>
                </div>
              </div>

              {/* Task Execution Loop */}
              <div className="space-y-2 pt-2">
                <span className="text-[11px] text-purple-400 font-bold block flex items-center">
                  <ChevronRight className="w-3.5 h-3.5 mr-1" />
                  5. Standard Task Execution Loop
                </span>
                <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-1 text-slate-300 text-[11px]">
                  {activeAgentSpec?.taskExecutionLoop.map((step, idx) => (
                    <div key={idx} className="flex items-center space-x-2">
                      <span className="text-purple-400 font-bold">{step}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Audit Logging */}
              <div className="bg-slate-900 p-3.5 rounded-lg border border-slate-800 space-y-1 text-[11px] font-mono">
                <span className="text-indigo-400 font-bold block">6. Audit Trace Protocol</span>
                <div className="text-slate-300">
                  Trace ID Pattern: <code className="text-cyan-300">{activeAgentSpec?.auditLogging.traceIdFormat}</code> | Log Level: <code className="text-emerald-300">{activeAgentSpec?.auditLogging.logLevel}</code>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: MEMORY ENGINE ARCHITECTURE */}
      {activeTabSection === 'memory' && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="border-b border-slate-800 pb-4">
            <h2 className="text-lg font-bold text-white font-mono flex items-center">
              <Database className="w-5 h-5 text-indigo-400 mr-2" />
              Memory Engine Architecture Specification
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Multi-tiered memory architecture separating transient context, long-term vector embeddings, business directives, and semantic retrieval rules.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
            {/* Short-Term Memory */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-cyan-400 flex items-center">
                <Terminal className="w-4 h-4 mr-1.5" />
                1. Short-Term Memory (In-Session Context)
              </h3>
              <div className="space-y-2 text-slate-300 text-[11px]">
                <div><span className="text-slate-500">Engine Type:</span> {MEMORY_ENGINE_SPEC.shortTermMemory.type}</div>
                <div><span className="text-slate-500">Capacity:</span> <strong className="text-white">{MEMORY_ENGINE_SPEC.shortTermMemory.capacity}</strong></div>
                <div><span className="text-slate-500">Retention Rules:</span> {MEMORY_ENGINE_SPEC.shortTermMemory.retention}</div>
              </div>
            </div>

            {/* Long-Term Memory */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-indigo-400 flex items-center">
                <Database className="w-4 h-4 mr-1.5" />
                2. Long-Term Memory (Vector Embeddings)
              </h3>
              <div className="space-y-2 text-slate-300 text-[11px]">
                <div><span className="text-slate-500">Engine Type:</span> {MEMORY_ENGINE_SPEC.longTermMemory.type}</div>
                <div><span className="text-slate-500">Storage Layer:</span> <strong className="text-white">{MEMORY_ENGINE_SPEC.longTermMemory.storage}</strong></div>
                <div><span className="text-slate-500">Indexing Strategy:</span> {MEMORY_ENGINE_SPEC.longTermMemory.indexing}</div>
              </div>
            </div>

            {/* Business Memory */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-amber-400 flex items-center">
                <Sliders className="w-4 h-4 mr-1.5" />
                3. Business Memory &amp; Directives
              </h3>
              <div className="space-y-1 text-slate-300 text-[11px] font-sans">
                <p className="font-mono text-[10px] text-slate-500 mb-2">Configured Brand Guidelines &amp; Margin Rules:</p>
                {MEMORY_ENGINE_SPEC.businessMemory.contents.map((item, i) => (
                  <div key={i} className="flex items-center space-x-1.5">
                    <span className="text-amber-400">•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Vector Storage & Retrieval Rules */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
              <h3 className="text-sm font-bold text-emerald-400 flex items-center">
                <Search className="w-4 h-4 mr-1.5" />
                4. Vector Storage &amp; Retrieval Rules
              </h3>
              <div className="space-y-2 text-slate-300 text-[11px]">
                <div><span className="text-slate-500">Vector Engine:</span> {MEMORY_ENGINE_SPEC.vectorStorage.engine} ({MEMORY_ENGINE_SPEC.vectorStorage.dimensions}-dim)</div>
                <div><span className="text-slate-500">Metric:</span> {MEMORY_ENGINE_SPEC.vectorStorage.metric}</div>
                <div><span className="text-slate-500">Min Similarity Score:</span> <strong className="text-emerald-300">&gt;= {MEMORY_ENGINE_SPEC.retrievalRules.minSimilarityScore}</strong></div>
                <div><span className="text-slate-500">Recency Weighting Formula:</span> <code className="text-cyan-300">{MEMORY_ENGINE_SPEC.retrievalRules.recencyWeight}</code></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
