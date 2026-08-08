import React, { useState, useEffect } from 'react';
import { Target, Play, Pause, CheckCircle2, Clock, AlertTriangle, Cpu, Zap, Shield, Sparkles, ArrowRight, Bot } from 'lucide-react';

interface MissionTask {
  taskId: string;
  title: string;
  description: string;
  category: string;
  priority: string;
  assignedProvider: string;
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'AWAITING_APPROVAL';
  verificationMethod: string;
  result?: any;
}

interface MissionStrategy {
  targetNiche: string;
  coreMilestones: string[];
  estimatedROI: string;
  riskAssessment: string;
  targetAudience: string;
}

interface Mission {
  missionId: string;
  goal: string;
  priority: string;
  status: 'PLANNING' | 'ACTIVE' | 'AWAITING_APPROVAL' | 'COMPLETED' | 'FAILED' | 'PAUSED';
  createdAt: string;
  updatedAt: string;
  strategy: MissionStrategy;
  tasks: MissionTask[];
  currentStep: string;
  progressPercentage: number;
  ownerApprovalRequired: boolean;
  finalReport?: any;
}

export const KccMissionControlView: React.FC = () => {
  const [goalInput, setGoalInput] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMissionId, setSelectedMissionId] = useState<string | null>(null);

  const fetchMissions = async () => {
    try {
      const res = await fetch('/api/kcc/missions');
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();
      if (data && data.success) {
        setMissions(data.missions || []);
        if (data.missions?.length > 0 && !selectedMissionId) {
          setSelectedMissionId(data.missions[0].missionId);
        }
      }
    } catch {
      // Ignore transient network polling errors
    }
  };

  useEffect(() => {
    fetchMissions();
    const interval = setInterval(fetchMissions, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleLaunchMission = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalInput.trim() || loading) return;

    setLoading(true);
    try {
      const res = await fetch('/api/kcc/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ goal: goalInput, priority: 'HIGH' })
      });
      if (!res.ok) return;
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return;
      const data = await res.json();
      if (data && data.success) {
        setGoalInput('');
        fetchMissions();
        if (data.missionId) setSelectedMissionId(data.missionId);
      }
    } catch {
      // Ignore network errors
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (missionId: string, action: 'approve' | 'pause' | 'resume') => {
    try {
      await fetch(`/api/kcc/mission/${missionId}/${action}`, { method: 'POST' });
      fetchMissions();
    } catch (err) {
      console.error(`Failed to ${action} mission:`, err);
    }
  };

  const selectedMission = missions.find(m => m.missionId === selectedMissionId) || missions[0];

  return (
    <div className="space-y-6">
      {/* HEADER HERO */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-indigo-500/30 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Bot className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="flex items-center gap-3 mb-2">
          <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 rounded-full text-xs font-semibold uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-indigo-400" /> KCC Autonomous Operator
          </span>
          <span className="px-3 py-1 bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 rounded-full text-xs font-semibold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Zero-Touch Execution Active
          </span>
        </div>

        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white mb-2">
          Autonomous Business Mission Control
        </h1>
        <p className="text-slate-300 max-w-2xl text-sm sm:text-base leading-relaxed mb-6">
          Provide one high-level goal. KCC Brain automatically creates the strategy, decomposes tasks, assigns specialized AI workers, and executes until completion.
        </p>

        {/* GOAL INPUT FORM */}
        <form onSubmit={handleLaunchMission} className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Target className="w-5 h-5 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={goalInput}
              onChange={(e) => setGoalInput(e.target.value)}
              placeholder='e.g. "Create and scale a profitable automated fitness dropshipping business"'
              className="w-full pl-12 pr-4 py-3 bg-slate-800/80 border border-indigo-500/40 rounded-xl text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              disabled={loading}
            />
          </div>
          <button
            type="submit"
            disabled={loading || !goalInput.trim()}
            className="px-6 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold rounded-xl text-sm transition-all shadow-lg flex items-center justify-center gap-2 whitespace-nowrap"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Decomposing Goal...
              </>
            ) : (
              <>
                <Zap className="w-4 h-4" /> Launch Mission
              </>
            )}
          </button>
        </form>
      </div>

      {/* MISSIONS GRID & DETAIL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* MISSIONS LIST */}
        <div className="lg:col-span-1 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-2">
            <Cpu className="w-4 h-4 text-indigo-500" /> Active Business Missions ({missions.length})
          </h3>

          {missions.length === 0 ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-slate-500 text-sm">
              No active missions. Submit a business objective above to start.
            </div>
          ) : (
            missions.map((m) => {
              const isSelected = selectedMission?.missionId === m.missionId;
              return (
                <div
                  key={m.missionId}
                  onClick={() => setSelectedMissionId(m.missionId)}
                  className={`p-4 rounded-xl border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-500 shadow-md'
                      : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold ${
                      m.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                      m.status === 'ACTIVE' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300' :
                      m.status === 'PAUSED' ? 'bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300' :
                      'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300'
                    }`}>
                      {m.status}
                    </span>
                    <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                      {m.progressPercentage}%
                    </span>
                  </div>

                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm line-clamp-2 mb-2">
                    {m.goal}
                  </h4>

                  {/* PROGRESS BAR */}
                  <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-indigo-600 h-full transition-all duration-500"
                      style={{ width: `${m.progressPercentage}%` }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* SELECTED MISSION DETAIL */}
        <div className="lg:col-span-2 space-y-6">
          {selectedMission ? (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-6 shadow-sm space-y-6">
              {/* MISSION HEADER & OWNER ACTIONS */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-700">
                <div>
                  <div className="text-xs font-mono text-slate-400 mb-1">ID: {selectedMission.missionId}</div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    {selectedMission.goal}
                  </h2>
                </div>

                <div className="flex items-center gap-2">
                  {selectedMission.status === 'PAUSED' ? (
                    <button
                      onClick={() => handleAction(selectedMission.missionId, 'resume')}
                      className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Play className="w-3.5 h-3.5" /> Resume
                    </button>
                  ) : selectedMission.status === 'ACTIVE' ? (
                    <button
                      onClick={() => handleAction(selectedMission.missionId, 'pause')}
                      className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <Pause className="w-3.5 h-3.5" /> Pause
                    </button>
                  ) : null}

                  {selectedMission.ownerApprovalRequired && (
                    <button
                      onClick={() => handleAction(selectedMission.missionId, 'approve')}
                      className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" /> Approve Action
                    </button>
                  )}
                </div>
              </div>

              {/* CURRENT STEP HIGHLIGHT */}
              <div className="bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/40 rounded-xl p-4 flex items-center gap-3">
                <Sparkles className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
                <div className="text-sm">
                  <span className="font-semibold text-indigo-950 dark:text-indigo-200">Current Step: </span>
                  <span className="text-indigo-900 dark:text-indigo-300">{selectedMission.currentStep}</span>
                </div>
              </div>

              {/* STRATEGY SUMMARY */}
              {selectedMission.strategy && (
                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 space-y-2 border border-slate-200 dark:border-slate-700/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Strategy Roadmap
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block font-medium">Niche:</span>
                      <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedMission.strategy.targetNiche}</span>
                    </div>
                    <div className="bg-white dark:bg-slate-800 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700">
                      <span className="text-slate-400 block font-medium">Projected ROI:</span>
                      <span className="font-semibold text-emerald-600 dark:text-emerald-400">{selectedMission.strategy.estimatedROI}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* WORKER STATUS BREAKDOWN */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  AI Worker Assignments
                </h4>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {[
                    { name: 'Gemini', role: 'Research & Copy', color: 'bg-blue-500' },
                    { name: 'CJ Agent', role: 'Supplier Sync', color: 'bg-emerald-500' },
                    { name: 'Manus', role: 'Store Code', color: 'bg-purple-500' },
                    { name: 'Claude', role: 'Security Audit', color: 'bg-amber-500' },
                    { name: 'OpenAI', role: 'Decision Support', color: 'bg-teal-500' }
                  ].map((w) => (
                    <div key={w.name} className="bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 text-center">
                      <div className="flex items-center justify-center gap-1.5 mb-1">
                        <span className={`w-2 h-2 rounded-full ${w.color}`} />
                        <span className="text-xs font-bold text-slate-800 dark:text-slate-200">{w.name}</span>
                      </div>
                      <span className="text-[10px] text-slate-500 dark:text-slate-400 block">{w.role}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* TASK BREAKDOWN */}
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-3">
                  Decomposed Execution Tasks ({selectedMission.tasks?.length || 0})
                </h4>
                <div className="space-y-2">
                  {(selectedMission.tasks || []).map((t, idx) => (
                    <div
                      key={`${t.taskId}-${idx}`}
                      className="p-3 bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-700/80 rounded-lg flex items-start justify-between gap-3"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-xs text-slate-900 dark:text-white">{t.title}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded font-mono bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                            {t.assignedProvider}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.description}</p>
                      </div>

                      <span className={`text-[10px] px-2.5 py-1 rounded-full font-bold whitespace-nowrap shrink-0 ${
                        t.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300' :
                        t.status === 'IN_PROGRESS' ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300 animate-pulse' :
                        'bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-300'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-8 text-center text-slate-500">
              Select a mission to view strategy & real-time execution tasks.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
