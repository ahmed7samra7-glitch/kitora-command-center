import React, { useState, useEffect } from 'react';
import { 
  Cpu, 
  Zap, 
  Bot, 
  Sliders, 
  ShieldCheck, 
  Database, 
  GitBranch, 
  Activity, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Sparkles, 
  Play, 
  RefreshCw, 
  Lock, 
  Search, 
  Layers, 
  ArrowRight, 
  Server, 
  Clock, 
  Terminal,
  FileCheck
} from 'lucide-react';
import { PolicyConfig, ProviderInfo, AgentRuntimeState, WorkflowPipeline } from '../types';

interface CoreRuntimeDashboardProps {
  policies: PolicyConfig;
  onUpdatePolicies: (newPolicies: Partial<PolicyConfig>) => void;
  onRefreshData: () => void;
}

export const CoreRuntimeDashboard: React.FC<CoreRuntimeDashboardProps> = ({
  policies,
  onUpdatePolicies,
  onRefreshData
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'orchestrator' | 'runtimes' | 'providers' | 'workflows' | 'memory'>('orchestrator');

  // Orchestrator Dispatch State
  const [dispatchPrompt, setDispatchPrompt] = useState('Draft high-converting ad copy for minimal luxury leather tote bag and evaluate Meta ad budget $45.00/day');
  const [targetAgent, setTargetAgent] = useState('Marketing Agent');
  const [requestedAmount, setRequestedAmount] = useState<number>(45);
  const [isExecuting, setIsExecuting] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<any>(null);

  // Live Server States
  const [runtimes, setRuntimes] = useState<AgentRuntimeState[]>([]);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowPipeline[]>([]);
  const [memoryQuery, setMemoryQuery] = useState('Target profit margins and refund policy limits');
  const [memoryResults, setMemoryResults] = useState<any>(null);
  const [isSearchingMemory, setIsSearchingMemory] = useState(false);

  // Load server states
  useEffect(() => {
    fetchRuntimes();
    fetchProviders();
    fetchWorkflows();
  }, []);

  const fetchRuntimes = async () => {
    try {
      const res = await fetch('/api/agents/runtime');
      const data = await res.json();
      if (data.agents) setRuntimes(data.agents);
    } catch (e) {
      console.error('Failed to fetch runtimes', e);
    }
  };

  const fetchProviders = async () => {
    try {
      const res = await fetch('/api/providers');
      const data = await res.json();
      if (data.providers) setProviders(data.providers);
    } catch (e) {
      console.error('Failed to fetch providers', e);
    }
  };

  const fetchWorkflows = async () => {
    try {
      const res = await fetch('/api/workflows');
      const data = await res.json();
      if (data.workflows) setWorkflows(data.workflows);
    } catch (e) {
      console.error('Failed to fetch workflows', e);
    }
  };

  const handleDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsExecuting(true);
    setDispatchResult(null);

    try {
      const res = await fetch('/api/orchestrator/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: dispatchPrompt,
          agentName: targetAgent,
          requestedAmount: requestedAmount || 0,
        }),
      });
      const data = await res.json();
      setDispatchResult(data);
      fetchRuntimes();
      onRefreshData();
    } catch (err) {
      console.error('Dispatch error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleRunWorkflowStep = async (workflowId: string) => {
    try {
      const res = await fetch('/api/workflows/step', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workflowId }),
      });
      const data = await res.json();
      if (data.success) {
        fetchWorkflows();
        onRefreshData();
      }
    } catch (e) {
      console.error('Workflow step error', e);
    }
  };

  const handleSearchMemory = async () => {
    setIsSearchingMemory(true);
    try {
      const res = await fetch('/api/memory/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: memoryQuery }),
      });
      const data = await res.json();
      setMemoryResults(data.results);
    } catch (e) {
      console.error('Memory search error', e);
    } finally {
      setIsSearchingMemory(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top OS Header Panel */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Cpu className="w-48 h-48 text-cyan-400" />
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="flex items-center space-x-3">
              <span className="p-2 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-lg">
                <Cpu className="w-6 h-6" />
              </span>
              <div>
                <h2 className="text-xl font-bold text-white font-mono flex items-center">
                  PHASE 2A CORE RUNTIME KERNEL
                  <span className="ml-3 px-2.5 py-0.5 text-xs bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-full font-sans">
                    ORCHESTRATOR ONLINE
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Autonomous Operating System with Master Orchestrator, Executable Runtimes, Universal AI Adapters & Verification Engine
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => {
                fetchRuntimes();
                fetchProviders();
                fetchWorkflows();
                onRefreshData();
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-medium flex items-center transition-all"
            >
              <RefreshCw className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
              Sync Kernel State
            </button>
          </div>
        </div>

        {/* Sub-Tabs Navigation */}
        <div className="flex items-center space-x-2 mt-6 border-t border-slate-800/80 pt-4 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('orchestrator')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeSubTab === 'orchestrator'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-300" />
            <span>1. Master Orchestrator</span>
          </button>

          <button
            onClick={() => setActiveSubTab('runtimes')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeSubTab === 'runtimes'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-300" />
            <span>2. Agent Runtimes ({runtimes.length || 16})</span>
          </button>

          <button
            onClick={() => setActiveSubTab('providers')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeSubTab === 'providers'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>3. Universal AI Providers</span>
          </button>

          <button
            onClick={() => setActiveSubTab('workflows')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeSubTab === 'workflows'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span>4. Multi-Agent Workflows</span>
          </button>

          <button
            onClick={() => setActiveSubTab('memory')}
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center space-x-2 whitespace-nowrap ${
              activeSubTab === 'memory'
                ? 'bg-cyan-600 text-white shadow-lg shadow-cyan-900/40'
                : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Database className="w-3.5 h-3.5 text-purple-400" />
            <span>5. Memory Engine Tiers</span>
          </button>
        </div>
      </div>

      {/* SUB-TAB 1: MASTER ORCHESTRATOR KERNEL */}
      {activeSubTab === 'orchestrator' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Dispatch Input Form */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
              <div className="flex items-center space-x-2 text-cyan-400 font-semibold text-sm mb-4">
                <Terminal className="w-4 h-4" />
                <span>Orchestrator Directive Dispatch</span>
              </div>

              <form onSubmit={handleDispatch} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Target AI Agent
                  </label>
                  <select
                    value={targetAgent}
                    onChange={(e) => setTargetAgent(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  >
                    <option value="Marketing Agent">Marketing Agent (Growth)</option>
                    <option value="Finance Agent">Finance Agent (CFO / Ledger)</option>
                    <option value="Product Hunter Agent">Product Hunter Agent (Sourcing)</option>
                    <option value="CTO Agent">CTO Agent (Architecture)</option>
                    <option value="Customer Support Agent">Customer Support Agent (Support)</option>
                    <option value="Approval Agent">Approval Agent (Gatekeeper)</option>
                    <option value="Master Orchestrator Agent">Master Orchestrator Kernel</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Directive / Intent Prompt
                  </label>
                  <textarea
                    rows={4}
                    value={dispatchPrompt}
                    onChange={(e) => setDispatchPrompt(e.target.value)}
                    placeholder="Enter business directive for the Orchestrator..."
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none font-mono"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Requested Financial Parameter ($) <span className="text-slate-500">(For Policy Gate evaluation)</span>
                  </label>
                  <input
                    type="number"
                    value={requestedAmount}
                    onChange={(e) => setRequestedAmount(Number(e.target.value))}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-cyan-500 focus:outline-none"
                  />
                  <p className="text-[10px] text-slate-500 mt-1">
                    Daily Ad Cap: ${policies.adSpendDailyCap.toFixed(2)} | Transfer Threshold: ${policies.transferApprovalThreshold.toFixed(2)}
                  </p>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={isExecuting}
                    className="w-full py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold transition-all flex items-center justify-center space-x-2 shadow-lg shadow-cyan-900/40 disabled:opacity-50"
                  >
                    {isExecuting ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin text-cyan-200" />
                        <span>Orchestrating 12-Step Pipeline...</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4 fill-current text-white" />
                        <span>Dispatch Directive to Master Orchestrator</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

            {/* Quick Test Presets */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4">
              <span className="text-xs font-bold text-slate-400 block mb-2">Test Preset Directives:</span>
              <div className="space-y-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setTargetAgent('Marketing Agent');
                    setDispatchPrompt('Draft high-converting ad copy for minimal luxury leather tote bag and evaluate Meta ad budget $45.00/day');
                    setRequestedAmount(45);
                  }}
                  className="w-full text-left p-2 bg-slate-950/80 hover:bg-slate-800 text-[11px] text-slate-300 rounded border border-slate-800 transition-all flex items-center justify-between"
                >
                  <span>1. Safe Marketing Copy ($45/day vs $50 Cap)</span>
                  <span className="text-emerald-400 font-bold">Auto-Approve</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetAgent('Marketing Agent');
                    setDispatchPrompt('Launch massive Meta ads campaign for high-margin silk scarf product with daily budget $150.00/day');
                    setRequestedAmount(150);
                  }}
                  className="w-full text-left p-2 bg-slate-950/80 hover:bg-slate-800 text-[11px] text-slate-300 rounded border border-slate-800 transition-all flex items-center justify-between"
                >
                  <span>2. Over-Budget Ad Campaign ($150/day vs $50 Cap)</span>
                  <span className="text-rose-400 font-bold">Trigger Approval Gate</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setTargetAgent('CTO Agent');
                    setDispatchPrompt('Audit core microservice architecture for security secret leaks and verify API key proxy isolation.');
                    setRequestedAmount(0);
                  }}
                  className="w-full text-left p-2 bg-slate-950/80 hover:bg-slate-800 text-[11px] text-slate-300 rounded border border-slate-800 transition-all flex items-center justify-between"
                >
                  <span>3. CTO Architecture & Security Audit</span>
                  <span className="text-cyan-400 font-bold">Deep Analytic</span>
                </button>
              </div>
            </div>
          </div>

          {/* Execution Pipeline Output */}
          <div className="lg:col-span-7 space-y-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg min-h-[460px] flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
                  <div className="flex items-center space-x-2 text-emerald-400 font-semibold text-sm">
                    <Activity className="w-4 h-4" />
                    <span>Orchestrator 12-Step Execution Output</span>
                  </div>
                  {dispatchResult && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                      dispatchResult.status === 'COMPLETED' 
                        ? 'bg-emerald-950 text-emerald-300 border-emerald-800' 
                        : 'bg-amber-950 text-amber-300 border-amber-800'
                    }`}>
                      {dispatchResult.status}
                    </span>
                  )}
                </div>

                {!dispatchResult ? (
                  <div className="py-16 text-center space-y-3">
                    <Cpu className="w-12 h-12 text-slate-700 mx-auto animate-pulse" />
                    <p className="text-xs text-slate-500">
                      Select a directive preset or enter custom prompt and click <strong className="text-cyan-400">Dispatch</strong> to execute the Orchestrator pipeline.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4 text-xs">
                    {/* Routing Badge */}
                    {dispatchResult.routing && (
                      <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg flex items-center justify-between">
                        <div>
                          <span className="text-slate-400 text-[11px]">Dynamic AI Routing:</span>
                          <div className="font-semibold text-white mt-0.5 font-mono">
                            {dispatchResult.routing.selectedProvider.toUpperCase()} ({dispatchResult.routing.modelUsed})
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{dispatchResult.routing.justification}</p>
                        </div>
                        <span className="px-2 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-mono text-[10px]">
                          {dispatchResult.routing.reasoningLevel}
                        </span>
                      </div>
                    )}

                    {/* Output Content */}
                    <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 text-slate-200 font-mono text-xs whitespace-pre-wrap max-h-52 overflow-y-auto">
                      {dispatchResult.output}
                    </div>

                    {/* Verification Checks */}
                    {dispatchResult.verification && (
                      <div className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-300 border-b border-slate-800/80 pb-1.5">
                          <span className="flex items-center">
                            <FileCheck className="w-3.5 h-3.5 mr-1.5 text-cyan-400" />
                            Verification Engine Audit Breakdown
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono ${
                            dispatchResult.verification.confidenceScore >= 0.85
                              ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                              : 'bg-rose-950 text-rose-300 border border-rose-800'
                          }`}>
                            Confidence: {(dispatchResult.verification.confidenceScore * 100).toFixed(0)}%
                          </span>
                        </div>

                        <div className="space-y-1 text-[11px]">
                          {dispatchResult.verification.checks.map((check: any, idx: number) => (
                            <div key={idx} className="flex items-center justify-between py-1 border-b border-slate-900 last:border-0">
                              <span className="text-slate-300">{check.rule}</span>
                              <span className={`flex items-center font-semibold text-[10px] ${
                                check.passed ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {check.passed ? (
                                  <CheckCircle2 className="w-3 h-3 mr-1 text-emerald-400" />
                                ) : (
                                  <XCircle className="w-3 h-3 mr-1 text-rose-400" />
                                )}
                                {check.message}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Lock Warning if triggered */}
                    {dispatchResult.status === 'WAITING_FOR_APPROVAL' && (
                      <div className="bg-amber-950/60 border border-amber-800/80 rounded-lg p-3 text-amber-200 flex items-start space-x-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-xs">ACTION LOCKED BY POLICY ENGINE</p>
                          <p className="text-[11px] text-amber-300/90 mt-0.5">
                            Created pending approval card <strong className="font-mono text-white">{dispatchResult.approvalId}</strong>. Switch to <strong className="text-white">Approval Center</strong> tab to authorize.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {dispatchResult && (
                <div className="text-[10px] text-slate-500 border-t border-slate-800/80 pt-2.5 flex items-center justify-between mt-4">
                  <span>Trace ID: <strong className="font-mono text-slate-400">{dispatchResult.traceId}</strong></span>
                  <span>Agent: <strong className="text-slate-300">{dispatchResult.agent}</strong></span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: AGENT RUNTIMES ENGINE */}
      {activeSubTab === 'runtimes' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center">
                <Bot className="w-4 h-4 mr-2 text-cyan-400" />
                16 Executable AI Agent Runtimes
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Every AI agent possesses an active runtime state, memory access, tools, permissions, and health telemetry.
              </p>
            </div>
            <span className="px-2.5 py-1 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded-md text-xs font-mono">
              16 / 16 HEALTHY
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {runtimes.map((agent) => (
              <div key={agent.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-md hover:border-slate-700 transition-all">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-white">{agent.name}</h4>
                    <p className="text-[11px] text-slate-400">{agent.role}</p>
                  </div>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    agent.healthStatus === 'HEALTHY' 
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' 
                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                  }`}>
                    {agent.healthStatus}
                  </span>
                </div>

                <div className="mt-3 pt-3 border-t border-slate-800/80 grid grid-cols-2 gap-2 text-[11px]">
                  <div>
                    <span className="text-slate-500 block">Lifecycle:</span>
                    <span className="font-mono text-cyan-300 font-bold">{agent.lifecycleState}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Confidence:</span>
                    <span className="font-mono text-emerald-400 font-bold">{(agent.confidenceScore * 100).toFixed(0)}%</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Completed:</span>
                    <span className="font-mono text-slate-200">{agent.metrics.tasksCompleted} tasks</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Avg Latency:</span>
                    <span className="font-mono text-slate-200">{agent.metrics.avgLatencyMs}ms</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: UNIVERSAL AI PROVIDERS LAYER */}
      {activeSubTab === 'providers' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg">
            <h3 className="text-sm font-bold text-white flex items-center mb-1">
              <Sparkles className="w-4 h-4 mr-2 text-amber-400" />
              Universal AI Provider Layer & Adapter Architecture
            </h3>
            <p className="text-xs text-slate-400">
              Plug-in adapter layer supporting Google Gemini (Native), OpenAI GPT, and Anthropic Claude with policy-based routing.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
              {providers.map((p) => (
                <div key={p.id} className="bg-slate-950 border border-slate-800 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-white">{p.name}</span>
                    <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                      p.status === 'ACTIVE' 
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                        : 'bg-slate-900 text-slate-400 border border-slate-800'
                    }`}>
                      {p.status}
                    </span>
                  </div>

                  <div className="space-y-1 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Default Model:</span>
                      <span className="font-mono text-cyan-300">{p.defaultModel}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Avg Latency:</span>
                      <span className="font-mono text-slate-200">{p.latencyAvgMs} ms</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Cost / 1k tokens:</span>
                      <span className="font-mono text-slate-200">${p.costPer1kTokens}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Function Calling:</span>
                      <span className="font-mono text-emerald-400">Supported</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Policy Preference Override */}
            <div className="mt-6 border-t border-slate-800 pt-4 flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">Policy Engine AI Provider Selection Preference:</span>
                <span className="text-[11px] text-slate-400">Enforce global LLM routing behavior across all agent dispatches.</span>
              </div>

              <select
                value={policies.preferredAIProvider}
                onChange={(e) => onUpdatePolicies({ preferredAIProvider: e.target.value as any })}
                className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-cyan-300 font-mono focus:ring-2 focus:ring-cyan-500"
              >
                <option value="DYNAMIC_AUTO">DYNAMIC_AUTO (Cost & Latency Optimized)</option>
                <option value="GEMINI_ONLY">GEMINI_ONLY (Native @google/genai SDK)</option>
                <option value="OPENAI_PREFER">OPENAI_PREFER (OpenAI Adapter)</option>
                <option value="CLAUDE_PREFER">CLAUDE_PREFER (Anthropic Adapter)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 4: MULTI-AGENT WORKFLOWS */}
      {activeSubTab === 'workflows' && (
        <div className="space-y-6">
          {workflows.map((wf) => (
            <div key={wf.id} className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center">
                    <GitBranch className="w-4 h-4 mr-2 text-emerald-400" />
                    {wf.name}
                    <span className="ml-2 font-mono text-xs text-slate-500">({wf.id})</span>
                  </h3>
                  <p className="text-xs text-slate-400 mt-0.5">{wf.description}</p>
                </div>

                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded font-mono ${
                    wf.status === 'COMPLETED' 
                      ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' 
                      : 'bg-indigo-950 text-indigo-300 border border-indigo-800'
                  }`}>
                    {wf.status}
                  </span>

                  {wf.status !== 'COMPLETED' && (
                    <button
                      onClick={() => handleRunWorkflowStep(wf.id)}
                      className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-xs font-bold transition-all flex items-center"
                    >
                      <Play className="w-3 h-3 mr-1 fill-current" />
                      Execute Next Step
                    </button>
                  )}
                </div>
              </div>

              {/* Step Flow List */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {wf.steps.map((step, idx) => (
                  <div key={step.stepId} className="bg-slate-950 border border-slate-800 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-white font-mono">Step {idx + 1}: {step.title}</span>
                      <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                        step.status === 'COMPLETED' 
                          ? 'bg-emerald-950 text-emerald-400' 
                          : step.status === 'RUNNING' 
                            ? 'bg-amber-950 text-amber-300 animate-pulse' 
                            : 'bg-slate-900 text-slate-500'
                      }`}>
                        {step.status}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-400">{step.action}</p>
                    <div className="text-[10px] text-slate-500 font-mono">Agent: {step.agent}</div>

                    {step.output && (
                      <div className="bg-slate-900/80 p-2 rounded text-[10px] font-mono text-cyan-300 border border-slate-800/80">
                        {JSON.stringify(step.output)}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* SUB-TAB 5: MEMORY ENGINE TIERS */}
      {activeSubTab === 'memory' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-lg space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center">
              <Database className="w-4 h-4 mr-2 text-purple-400" />
              Memory Engine Search & Context Inspector
            </h3>
            <p className="text-xs text-slate-400">
              Query the 4-layer memory architecture: Working Memory, Session Context, Business Memory, and Long-Term Vector Storage.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={memoryQuery}
                onChange={(e) => setMemoryQuery(e.target.value)}
                placeholder="Search business memory or vector index..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-xs text-white focus:ring-2 focus:ring-purple-500"
              />
              <button
                onClick={handleSearchMemory}
                disabled={isSearchingMemory}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-xs font-bold transition-all flex items-center space-x-1"
              >
                <Search className="w-3.5 h-3.5" />
                <span>Search Memory Tiers</span>
              </button>
            </div>

            {memoryResults && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <span className="text-xs font-bold text-cyan-300 block">1. Working Memory (Short-Term)</span>
                  <div className="text-[11px] text-slate-300 font-mono bg-slate-900 p-2 rounded">
                    {JSON.stringify(memoryResults.shortTermMemory, null, 2)}
                  </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2">
                  <span className="text-xs font-bold text-emerald-300 block">2. Business Memory (Policies & Directives)</span>
                  <ul className="text-[11px] text-slate-300 space-y-1 list-disc pl-4">
                    {memoryResults.businessMemory.map((item: string, idx: number) => (
                      <li key={idx}>{item}</li>
                    ))}
                  </ul>
                </div>

                <div className="bg-slate-950 border border-slate-800 p-4 rounded-lg space-y-2 md:col-span-2">
                  <span className="text-xs font-bold text-purple-300 block">3. Long-Term Vector Memory (pgvector Semantic Matches)</span>
                  <div className="space-y-2">
                    {memoryResults.vectorMemory.map((v: any) => (
                      <div key={v.id} className="bg-slate-900 p-2.5 rounded text-xs flex justify-between items-center border border-slate-800">
                        <span className="text-slate-200">{v.text}</span>
                        <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded font-mono text-[10px]">
                          Similarity: {(v.similarity * 100).toFixed(0)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
