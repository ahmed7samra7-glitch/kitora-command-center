import React, { useState } from 'react';
import { PolicyConfig } from '../types';
import { ShieldCheck, Sliders, DollarSign, Percent, RefreshCw, CheckCircle2, AlertTriangle, Send } from 'lucide-react';

interface Props {
  policies: PolicyConfig | null;
  onUpdatePolicies: (updated: Partial<PolicyConfig>) => Promise<void>;
}

export const PolicyConfigurator: React.FC<Props> = ({ policies, onUpdatePolicies }) => {
  const [adCap, setAdCap] = useState(policies?.adSpendDailyCap ?? 50);
  const [transferThreshold, setTransferThreshold] = useState(policies?.transferApprovalThreshold ?? 500);
  const [refundLimit, setRefundLimit] = useState(policies?.refundAutoApproveLimit ?? 30);
  const [minMargin, setMinMargin] = useState(policies?.minNetMarginPercentage ?? 40);
  const [maxRetries, setMaxRetries] = useState(policies?.maxAutoRetryCount ?? 5);
  const [channel, setChannel] = useState<'WHATSAPP' | 'EMAIL' | 'BOTH'>(policies?.ownerNotificationChannel ?? 'BOTH');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      await onUpdatePolicies({
        adSpendDailyCap: Number(adCap),
        transferApprovalThreshold: Number(transferThreshold),
        refundAutoApproveLimit: Number(refundLimit),
        minNetMarginPercentage: Number(minMargin),
        maxAutoRetryCount: Number(maxRetries),
        ownerNotificationChannel: channel,
        updatedBy: 'CTO Owner via Policy Configurator'
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 4000);
    } catch (err) {
      console.error('Error saving policy configuration:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 bg-amber-950 border border-amber-800 text-amber-300 rounded text-[11px] font-mono mb-1">
              <ShieldCheck className="w-3 h-3 text-amber-400 mr-1" />
              <span>DYNAMIC POLICY SAFETY ENGINE</span>
            </div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center">
              <span>Configurable Safety & Threshold Policies</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              No hardcoded safety numbers. All agent financial, operational, and retry thresholds are configured below and enforced dynamically at runtime.
            </p>
          </div>

          <div className="flex items-center space-x-2 bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs font-mono text-slate-300">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Policy Status: <strong className="text-emerald-400">ENFORCED IN REAL-TIME</strong></span>
          </div>
        </div>

        {saveSuccess && (
          <div className="bg-emerald-950/80 border border-emerald-800 p-3 rounded-xl flex items-center space-x-2 text-xs text-emerald-300 font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Policy rules updated successfully! Agent runtime and Approval Gate updated immediately.</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Ad Spend Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <DollarSign className="w-4 h-4 text-amber-400 mr-1" />
                  Daily Ad Spend Cap
                </span>
                <span className="px-2 py-0.5 bg-amber-950 text-amber-300 border border-amber-800 rounded text-[10px]">
                  Approval Trigger
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Any ad campaign budget exceeding this limit automatically locks in <code className="text-amber-300">REQUIRES_APPROVAL</code> state and alerts the Owner.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Maximum Daily Budget ($ USD):</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={adCap}
                  onChange={(e) => setAdCap(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            {/* Financial Transfer Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <DollarSign className="w-4 h-4 text-cyan-400 mr-1" />
                  PayPal Transfer Threshold
                </span>
                <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded text-[10px]">
                  CFO Safety Gate
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Single fund transfer or sweep requests from PayPal above this dollar amount require explicit Owner authorization.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Single Transfer Limit ($ USD):</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={transferThreshold}
                  onChange={(e) => setTransferThreshold(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            {/* Refund Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <DollarSign className="w-4 h-4 text-rose-400 mr-1" />
                  Refund Auto-Approve Limit
                </span>
                <span className="px-2 py-0.5 bg-rose-950 text-rose-300 border border-rose-800 rounded text-[10px]">
                  Support Cap
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Customer Support Agent can auto-issue refunds up to this dollar amount. Larger refund requests escalate to Owner.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Max Auto Refund ($ USD):</label>
                <input
                  type="number"
                  step="5"
                  min="0"
                  value={refundLimit}
                  onChange={(e) => setRefundLimit(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-rose-400"
                />
              </div>
            </div>

            {/* Profit Margin Floor Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <Percent className="w-4 h-4 text-emerald-400 mr-1" />
                  Minimum Net Margin Target
                </span>
                <span className="px-2 py-0.5 bg-emerald-950 text-emerald-300 border border-emerald-800 rounded text-[10px]">
                  Product Scout Rule
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Product Hunter Agent rejects products on CJ Dropshipping that yield a projected gross margin percentage lower than this floor.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Minimum Net Margin Target (%):</label>
                <input
                  type="number"
                  step="1"
                  min="0"
                  max="100"
                  value={minMargin}
                  onChange={(e) => setMinMargin(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-emerald-400"
                />
              </div>
            </div>

            {/* Workflow Max Retry Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <RefreshCw className="w-4 h-4 text-purple-400 mr-1" />
                  Max Task Auto-Retry Count
                </span>
                <span className="px-2 py-0.5 bg-purple-950 text-purple-300 border border-purple-800 rounded text-[10px]">
                  Workflow Backoff
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Workflow Agent will attempt exponential backoff retries up to this limit before routing task to Dead Letter Queue (DLQ).
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Maximum Retries:</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={maxRetries}
                  onChange={(e) => setMaxRetries(Number(e.target.value))}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-purple-400"
                />
              </div>
            </div>

            {/* Notification Channel Policy */}
            <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-sm flex items-center">
                  <Send className="w-4 h-4 text-indigo-400 mr-1" />
                  Owner Notification Channel
                </span>
                <span className="px-2 py-0.5 bg-indigo-950 text-indigo-300 border border-indigo-800 rounded text-[10px]">
                  Bridge Router
                </span>
              </div>
              <p className="text-slate-400 text-xs font-sans">
                Primary gateway for delivering urgent approval notifications to the business Owner.
              </p>
              <div className="space-y-1">
                <label className="text-[11px] text-slate-400">Notification Channel:</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:outline-none focus:border-indigo-400"
                >
                  <option value="WHATSAPP">WhatsApp Cloud API (Primary)</option>
                  <option value="EMAIL">Resend Transactional Email</option>
                  <option value="BOTH">Dual Channel (WhatsApp + Email)</option>
                </select>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-800 font-mono text-xs">
            <span className="text-slate-400 text-[11px]">
              Last updated: {policies?.updatedAt ? new Date(policies.updatedAt).toLocaleString() : 'Just now'} | By: {policies?.updatedBy || 'CTO Owner'}
            </span>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 bg-cyan-600 hover:bg-cyan-500 text-white font-bold rounded-xl shadow-lg transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              {isSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              <span>Save &amp; Enforce Policy Rules</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
