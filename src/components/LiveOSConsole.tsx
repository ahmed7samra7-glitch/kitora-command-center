import React, { useState } from 'react';
import { TaskItem, ApprovalItem, AuditLogItem, SystemInfo } from '../types';
import { 
  Zap, 
  Bot, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Send, 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  RefreshCw, 
  Sparkles, 
  ArrowUpRight,
  ShieldAlert,
  Terminal,
  Activity,
  Layers,
  Store
} from 'lucide-react';

interface LiveOSConsoleProps {
  tasks: TaskItem[];
  approvals: ApprovalItem[];
  auditLogs: AuditLogItem[];
  systemInfo: SystemInfo | null;
  onRefreshData: () => void;
  onActionApproval: (id: string, action: 'APPROVE' | 'REJECT') => void;
}

export const LiveOSConsole: React.FC<LiveOSConsoleProps> = ({
  tasks,
  approvals,
  auditLogs,
  systemInfo,
  onRefreshData,
  onActionApproval,
}) => {
  const [selectedAgent, setSelectedAgent] = useState('Product Hunter Agent');
  const [promptText, setPromptText] = useState('Find 3 high-margin trending home items on CJ Dropshipping with COGS < $8 and retail > $28.');
  const [isExecuting, setIsExecuting] = useState(false);
  const [agentOutput, setAgentOutput] = useState<any | null>(null);

  const agentsList = [
    'Master Orchestrator',
    'Product Hunter Agent',
    'Finance Agent',
    'Marketing Agent',
    'Customer Support Agent',
    'Supplier Agent',
    'CTO Agent',
    'Approval Agent'
  ];

  const handleDispatchAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!promptText.trim()) return;

    setIsExecuting(true);
    setAgentOutput(null);

    try {
      const res = await fetch('/api/agent/dispatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agentName: selectedAgent,
          prompt: promptText,
          context: { store: 'KITORA Primary Store', currency: 'USD' }
        }),
      });

      const data = await res.json();
      setAgentOutput(data);
      onRefreshData();
    } catch (err) {
      console.error('Failed to dispatch agent prompt:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const pendingApprovals = approvals.filter((a) => a.status === 'PENDING');

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* DAILY EXECUTIVE SUMMARY BAR (< 5 MINS/DAY OWNER MANDATE) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-emerald-950 border border-emerald-800 text-emerald-300 rounded text-[11px] font-mono mb-1">
              <Clock className="w-3 h-3 text-amber-400 mr-1" />
              <span>DAILY BRIEFING (&lt; 5 MINS OWNER TIME)</span>
            </div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center">
              <span>KITORA Daily Operational Overview</span>
              <span className="ml-3 text-xs font-normal text-slate-400 font-sans">
                Updated automatically at 07:00 UTC
              </span>
            </h2>
          </div>

          <button
            onClick={onRefreshData}
            className="self-start md:self-auto px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Sync Live Metrics</span>
          </button>
        </div>

        {/* Financial KPI Cards - Reality Audit Enforcement (NOT CONNECTED until APIs linked) */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">Gross Revenue (Today)</span>
            <div className="text-sm font-bold text-amber-400 font-mono">NOT CONNECTED</div>
            <span className="text-[10px] text-slate-500 font-mono">Requires Stripe / GA4 API</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">CJ Dropshipping COGS</span>
            <div className="text-sm font-bold text-amber-400 font-mono">NOT CONNECTED</div>
            <span className="text-[10px] text-slate-500 font-mono">Requires CJ_DROPSHIPPING_API_KEY</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">Meta/Google Ad Spend</span>
            <div className="text-sm font-bold text-amber-400 font-mono">NOT CONNECTED</div>
            <span className="text-[10px] text-slate-500 font-mono">Requires META_ADS_ACCESS_TOKEN</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">Net Cash Profit</span>
            <div className="text-sm font-bold text-amber-400 font-mono">NOT CONNECTED</div>
            <span className="text-[10px] text-slate-500 font-mono">Awaiting Financial Gateway Sync</span>
          </div>

          <div className="bg-slate-950/80 border border-slate-800 p-3.5 rounded-xl space-y-1">
            <span className="text-[10px] text-slate-400 font-mono block">PayPal Profit Sweep</span>
            <div className="text-sm font-bold text-amber-400 font-mono">NOT CONNECTED</div>
            <span className="text-[10px] text-slate-500 font-mono">Requires PAYPAL_CLIENT_ID</span>
          </div>
        </div>
      </div>

      {/* APPROVAL CENTER BANNER (HUMAN-IN-THE-LOOP WHATSAPP SIMULATOR) */}
      {pendingApprovals.length > 0 && (
        <div className="bg-slate-900 border border-amber-800/80 rounded-2xl p-6 space-y-4 shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div className="flex items-center space-x-2">
              <span className="w-3 h-3 rounded-full bg-amber-500 animate-ping" />
              <h3 className="text-base font-bold text-amber-300 font-mono flex items-center">
                <ShieldAlert className="w-5 h-5 mr-2 text-amber-400" />
                Human Approval Required ({pendingApprovals.length} Pending)
              </h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">WhatsApp Alert Delivered</span>
          </div>

          <div className="space-y-4">
            {pendingApprovals.map((approval) => (
              <div key={approval.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="md:col-span-2 space-y-2">
                  <div className="flex items-center space-x-2">
                    <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 text-[10px] font-mono rounded font-bold">
                      {approval.agent}
                    </span>
                    <h4 className="text-sm font-bold text-white font-mono">{approval.title}</h4>
                  </div>
                  <p className="text-xs text-slate-300">{approval.description}</p>
                  <div className="text-xs text-slate-400 font-mono">
                    Impact Score: <strong className="text-amber-400">{approval.impactScore}/100</strong> | Financial Impact: <strong className="text-emerald-400">{approval.financialImpact}</strong>
                  </div>
                </div>

                {/* WhatsApp Message Preview & Buttons */}
                <div className="bg-slate-900 p-3 rounded-xl border border-slate-800 flex flex-col justify-between space-y-3">
                  <div className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 p-2 rounded border border-emerald-900 whitespace-pre-wrap leading-tight">
                    <div className="flex items-center text-slate-400 mb-1 font-bold">
                      <MessageSquare className="w-3 h-3 mr-1 text-emerald-400" /> WhatsApp Payload:
                    </div>
                    {approval.whatsappMessagePreview}
                  </div>

                  <div className="flex space-x-2">
                    <button
                      onClick={() => onActionApproval(approval.id, 'APPROVE')}
                      className="flex-1 py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all"
                    >
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span>Authorize</span>
                    </button>
                    <button
                      onClick={() => onActionApproval(approval.id, 'REJECT')}
                      className="flex-1 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white font-mono text-xs font-bold rounded-lg flex items-center justify-center space-x-1 transition-all"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      <span>Decline</span>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* INTERACTIVE AGENT DISPATCH TERMINAL (REAL GEMINI AI API) */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div>
            <h3 className="text-base font-bold text-white font-mono flex items-center">
              <Bot className="w-5 h-5 text-cyan-400 mr-2" />
              Direct Agent Dispatch Terminal (Gemini AI Powered)
            </h3>
            <p className="text-xs text-slate-400">
              Target any independent agent directly. Real server-side route powered by <code className="text-cyan-300 font-mono">@google/genai</code>.
            </p>
          </div>

          <span className="px-2.5 py-1 bg-cyan-950 text-cyan-300 border border-cyan-800 text-xs font-mono rounded-full font-bold flex items-center">
            <Sparkles className="w-3 h-3 mr-1 text-cyan-400" /> gemini-3.6-flash
          </span>
        </div>

        <form onSubmit={handleDispatchAgent} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1">Target AI Agent:</label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
              >
                {agentsList.map((ag) => (
                  <option key={ag} value={ag}>{ag}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-3">
              <label className="block text-xs font-mono font-bold text-slate-300 mb-1">Directive / Prompt:</label>
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                  placeholder="Enter directive for target agent..."
                />
                <button
                  type="submit"
                  disabled={isExecuting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-mono text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all"
                >
                  {isExecuting ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>{isExecuting ? 'Executing...' : 'Dispatch'}</span>
                </button>
              </div>
            </div>
          </div>
        </form>

        {/* Live Output Terminal Display */}
        {agentOutput && (
          <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-2 text-[11px]">
              <span className="text-cyan-400 font-bold flex items-center">
                <Terminal className="w-3.5 h-3.5 mr-1.5" />
                Response from [{agentOutput.agent}]
              </span>
              <div className="flex items-center space-x-3 text-slate-400 text-[10px]">
                <span>Trace ID: <strong className="text-white">{agentOutput.traceId}</strong></span>
                <span className="px-1.5 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded font-bold">
                  Mode: {agentOutput.executionMode}
                </span>
              </div>
            </div>

            <div className="text-slate-200 whitespace-pre-wrap leading-relaxed text-[11px] bg-slate-900/60 p-3 rounded-lg border border-slate-800">
              {agentOutput.response}
            </div>
          </div>
        )}
      </div>

      {/* TASK QUEUE & AUDIT LOG DUAL PANELS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Queue Panel */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center">
              <Activity className="w-4 h-4 text-emerald-400 mr-2" />
              Autonomous Task Queue ({tasks.length})
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Real-Time State Machine</span>
          </div>

          <div className="space-y-2.5 max-h-[380px] overflow-y-auto pr-1">
            {tasks.map((task) => (
              <div key={task.id} className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1.5 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-cyan-400 font-bold">{task.id}</span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    task.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                    task.status === 'REQUIRES_APPROVAL' ? 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse' :
                    task.status === 'IN_PROGRESS' ? 'bg-indigo-950 text-indigo-300 border border-indigo-800' :
                    'bg-slate-800 text-slate-400'
                  }`}>
                    {task.status}
                  </span>
                </div>

                <p className="text-slate-200 text-xs font-sans">{task.title}</p>

                <div className="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/60">
                  <span>Agent: <strong className="text-slate-300">{task.agent}</strong></span>
                  <span>Priority: <strong className="text-amber-400">{task.priority}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Log Stream */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-bold text-white font-mono flex items-center">
              <Layers className="w-4 h-4 text-purple-400 mr-2" />
              Immutable Audit Trail Stream ({auditLogs.length})
            </h3>
            <span className="text-[10px] font-mono text-slate-400">Auditable System Record</span>
          </div>

          <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
            {auditLogs.map((log) => (
              <div key={log.id} className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-slate-500">{log.id}</span>
                    <span className="text-purple-400 font-bold">[{log.agent}]</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
                <div className="text-slate-300 text-[10px] font-sans">
                  <strong className="text-cyan-300 font-mono mr-1">{log.action}:</strong>
                  {log.details}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
