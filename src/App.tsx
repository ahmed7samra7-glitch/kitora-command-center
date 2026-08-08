import React, { useState, useEffect } from 'react';
import { ViewTab, SystemInfo, TaskItem, ApprovalItem, AuditLogItem, PolicyConfig } from './types';
import { Header } from './components/Header';
import { AdminSingleOwnerLogin } from './components/AdminSingleOwnerLogin';
import { Phase1Blueprint } from './components/Phase1Blueprint';
import { RealityAuditView } from './components/RealityAuditView';
import { PolicyConfigurator } from './components/PolicyConfigurator';
import { LiveOSConsole } from './components/LiveOSConsole';
import { IntegrationsPanel } from './components/IntegrationsPanel';
import { CoreRuntimeDashboard } from './components/CoreRuntimeDashboard';
import { Phase2AVerificationReport } from './components/Phase2AVerificationReport';
import { Phase3OperationsDashboard } from './components/Phase3OperationsDashboard';
import { ProductionDiagnosticsCenter } from './components/ProductionDiagnosticsCenter';
import { PilotProductionDashboard } from './components/PilotProductionDashboard';
import { Phase4CommerceDashboard } from './components/Phase4CommerceDashboard';
import { KccMissionControlView } from './components/KccMissionControlView';
import { AGENTS_MATRIX, DEFAULT_POLICY_CONFIG } from './data/architectureData';
import { Bot, Shield, Activity, Layers, RefreshCw } from 'lucide-react';

export default function App() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('kcc-mission-control');
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [policies, setPolicies] = useState<PolicyConfig | null>(DEFAULT_POLICY_CONFIG);
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Single Owner Authentication State
  const [authenticated, setAuthenticated] = useState<boolean>(false);
  const [ownerEmail, setOwnerEmail] = useState<string>('samraboss@gmail.com');

  const checkAuthStatus = async () => {
    try {
      const res = await fetch('/api/admin/status');
      if (res.ok) {
        const data = await res.json();
        setAuthenticated(!!data.authenticated);
        if (data.ownerEmail) setOwnerEmail(data.ownerEmail);
      }
    } catch (err) {
      console.error('Error checking owner auth status:', err);
    }
  };

  const fetchSystemData = async () => {
    try {
      const [sysRes, polRes, tasksRes, appRes, auditRes] = await Promise.all([
        fetch('/api/system/info'),
        fetch('/api/policies'),
        fetch('/api/tasks'),
        fetch('/api/approvals'),
        fetch('/api/audit-logs'),
      ]);

      if (sysRes.ok) {
        const sysData = await sysRes.json();
        setSystemInfo(sysData);
        if (sysData.policies) setPolicies(sysData.policies);
      }

      if (polRes.ok) {
        const polData = await polRes.json();
        if (polData.policies) setPolicies(polData.policies);
      }

      if (tasksRes.ok) {
        const data = await tasksRes.json();
        setTasks(data.tasks || []);
      }
      if (appRes.ok) {
        const data = await appRes.json();
        setApprovals(data.approvals || []);
      }
      if (auditRes.ok) {
        const data = await auditRes.json();
        setAuditLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Error fetching KCC system data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkAuthStatus();
    fetchSystemData();
  }, []);

  const handleLoginSuccess = (email: string) => {
    setAuthenticated(true);
    setOwnerEmail(email);
    fetchSystemData();
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/admin/logout', { method: 'POST' });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setAuthenticated(false);
    }
  };


  const handleUpdatePolicies = async (updatedFields: Partial<PolicyConfig>) => {
    try {
      const res = await fetch('/api/policies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedFields),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.policies) {
          setPolicies(data.policies);
        }
        fetchSystemData();
      }
    } catch (err) {
      console.error('Error saving policies:', err);
    }
  };

  const handleActionApproval = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const res = await fetch(`/api/approvals/${id}/action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (res.ok) {
        fetchSystemData();
      }
    } catch (err) {
      console.error('Error processing approval:', err);
    }
  };

  const handleSignOffPhase1 = async (signedBy: string, notes: string) => {
    try {
      const res = await fetch('/api/phase1/sign-off', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signedBy, notes }),
      });
      if (res.ok) {
        fetchSystemData();
      }
    } catch (err) {
      console.error('Error updating sign-off:', err);
    }
  };

  const pendingApprovalsCount = approvals.filter((a) => a.status === 'PENDING').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-cyan-500 selection:text-slate-950">
      <AdminSingleOwnerLogin
        authenticated={authenticated}
        ownerEmail={ownerEmail}
        onLoginSuccess={handleLoginSuccess}
        onLogout={handleLogout}
      />
      <Header
        currentTab={currentTab}
        setCurrentTab={setCurrentTab}
        systemInfo={systemInfo}
        pendingApprovalsCount={pendingApprovalsCount}
      />

      <main className="pb-12">
        {currentTab === 'kcc-mission-control' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <KccMissionControlView />
          </div>
        )}

        {currentTab === 'phase4-commerce' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Phase4CommerceDashboard onRefreshData={fetchSystemData} />
          </div>
        )}

        {currentTab === 'pilot-production' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <PilotProductionDashboard onRefreshData={fetchSystemData} />
          </div>
        )}

        {currentTab === 'diagnostics' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <ProductionDiagnosticsCenter onRefreshData={fetchSystemData} />
          </div>
        )}

        {currentTab === 'phase3-ops' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Phase3OperationsDashboard onRefreshData={fetchSystemData} />
          </div>
        )}

        {currentTab === 'core-runtime' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <CoreRuntimeDashboard
              policies={policies || DEFAULT_POLICY_CONFIG}
              onUpdatePolicies={handleUpdatePolicies}
              onRefreshData={fetchSystemData}
            />
          </div>
        )}

        {currentTab === 'verification-report' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
            <Phase2AVerificationReport
              policies={policies || DEFAULT_POLICY_CONFIG}
              onRefreshData={fetchSystemData}
            />
          </div>
        )}

        {currentTab === 'reality-audit' && (
          <RealityAuditView
            policies={policies}
            onOpenPolicyConfig={() => setCurrentTab('policies')}
          />
        )}

        {currentTab === 'policies' && (
          <PolicyConfigurator
            policies={policies}
            onUpdatePolicies={handleUpdatePolicies}
          />
        )}

        {currentTab === 'blueprint' && (
          <Phase1Blueprint
            systemInfo={systemInfo}
            onSignOff={handleSignOffPhase1}
            onSwitchToLiveOS={() => setCurrentTab('live-os')}
          />
        )}

        {currentTab === 'live-os' && (
          <LiveOSConsole
            tasks={tasks}
            approvals={approvals}
            auditLogs={auditLogs}
            systemInfo={systemInfo}
            onRefreshData={fetchSystemData}
            onActionApproval={handleActionApproval}
          />
        )}

        {currentTab === 'agents' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-mono text-white flex items-center">
                  <Bot className="w-5 h-5 text-indigo-400 mr-2" />
                  16 Independent AI Agents Architecture
                </h2>
                <p className="text-xs text-slate-400">
                  Every agent is decoupled and operates under strict human approval thresholds and dynamic policy limits.
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-mono font-bold rounded-full">
                16 AGENTS ONLINE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENTS_MATRIX.map((agent) => (
                <div key={agent.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{agent.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      agent.statusTag === 'REAL IMPLEMENTATION' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' :
                      agent.statusTag === 'MOCK IMPLEMENTATION' ? 'bg-amber-950 text-amber-300 border border-amber-800' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {agent.statusTag}
                    </span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs">{agent.description}</p>
                  <div className="bg-slate-950 p-2 rounded border border-slate-800 text-[11px]">
                    <strong className="text-amber-400">System Prompt:</strong> "{agent.primaryPrompt}"
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'approvals' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-bold font-mono text-white flex items-center mb-1">
                <Shield className="w-5 h-5 text-amber-400 mr-2" />
                Human-in-the-Loop Approval Center
              </h2>
              <p className="text-xs text-slate-400">
                Actions exceeding dynamic Policy Caps (Ad Cap: ${policies?.adSpendDailyCap}, Transfer Cap: ${policies?.transferApprovalThreshold}) require Owner sign-off.
              </p>
            </div>

            <div className="space-y-3">
              {approvals.map((app) => (
                <div key={app.id} className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-3 font-mono text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white">{app.title}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      app.status === 'APPROVED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      app.status === 'REJECTED' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                      'bg-amber-950 text-amber-300 border border-amber-800'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                  <p className="text-slate-300 font-sans text-xs">{app.description}</p>
                  {app.status === 'PENDING' && (
                    <div className="flex space-x-2 pt-2">
                      <button
                        onClick={() => handleActionApproval(app.id, 'APPROVE')}
                        className="py-1.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg"
                      >
                        Authorize Action
                      </button>
                      <button
                        onClick={() => handleActionApproval(app.id, 'REJECT')}
                        className="py-1.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg"
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'tasks' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold font-mono text-white flex items-center">
                  <Activity className="w-5 h-5 text-emerald-400 mr-2" />
                  Autonomous Task Queue Management
                </h2>
                <p className="text-xs text-slate-400">
                  Real-time status of asynchronous operations across all 16 agents.
                </p>
              </div>
            </div>

            <div className="space-y-3">
              {tasks.map((task) => (
                <div key={task.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl font-mono text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-cyan-400 font-bold">{task.id} - {task.title}</span>
                    <span className="px-2 py-0.5 bg-slate-800 rounded text-slate-300 border border-slate-700">
                      {task.status}
                    </span>
                  </div>
                  <div className="text-slate-400 text-[11px]">
                    Assigned Agent: <strong className="text-white">{task.agent}</strong> | Priority: <strong className="text-amber-400">{task.priority}</strong>
                  </div>
                  {task.result && (
                    <div className="bg-slate-950 p-2.5 rounded text-[11px] text-emerald-300 border border-slate-800">
                      Result: {JSON.stringify(task.result)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'audit' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h2 className="text-xl font-bold font-mono text-white flex items-center mb-1">
                <Layers className="w-5 h-5 text-purple-400 mr-2" />
                Auditable Execution Log Stream
              </h2>
              <p className="text-xs text-slate-400">
                Every action is logged with an immutable trace ID and agent metadata.
              </p>
            </div>

            <div className="space-y-2">
              {auditLogs.map((log) => (
                <div key={log.id} className="bg-slate-900 border border-slate-800 p-3 rounded-xl font-mono text-xs flex items-center justify-between">
                  <div>
                    <span className="text-slate-500 mr-2">{log.id}</span>
                    <span className="text-purple-400 font-bold mr-2">[{log.agent}]</span>
                    <span className="text-slate-200">{log.action}: {log.details}</span>
                  </div>
                  <span className="text-slate-500 text-[10px]">
                    {new Date(log.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {currentTab === 'integrations' && <IntegrationsPanel />}
      </main>
    </div>
  );
}
