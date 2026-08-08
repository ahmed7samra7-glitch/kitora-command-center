import React from 'react';
import { ViewTab, SystemInfo } from '../types';
import { 
  Shield, 
  ShieldCheck,
  Cpu, 
  Layers, 
  CheckCircle2, 
  Clock, 
  Zap, 
  Bot, 
  FileCode2, 
  FileCheck,
  Sliders, 
  Activity, 
  DollarSign, 
  Sparkles,
  Store
} from 'lucide-react';

interface HeaderProps {
  currentTab: ViewTab;
  setCurrentTab: (tab: ViewTab) => void;
  systemInfo: SystemInfo | null;
  pendingApprovalsCount: number;
}

export const Header: React.FC<HeaderProps> = ({
  currentTab,
  setCurrentTab,
  systemInfo,
  pendingApprovalsCount,
}) => {
  return (
    <header className="bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-50 backdrop-blur-md bg-slate-900/90">
      {/* Top Banner Status Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-2 border-b border-slate-800/80 flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
        <div className="flex items-center space-x-3">
          <span className="flex items-center text-emerald-400 font-medium">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse mr-2"></span>
            KCC KERNEL v1.0.0 ONLINE
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center text-slate-300">
            <Store className="w-3.5 h-3.5 mr-1 text-cyan-400" />
            Active Store: <strong className="ml-1 text-white">{systemInfo?.activeStore || 'KITORA Main (D2C)'}</strong>
          </span>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center text-slate-300 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700">
            <Clock className="w-3 h-3 mr-1 text-amber-400" />
            <span>Target Owner Work: <strong className="text-amber-300">&lt; 5 mins/day</strong></span>
          </div>

          <div className="flex items-center space-x-1">
            <span className="text-slate-400">Gemini AI:</span>
            {systemInfo?.hasGeminiKey ? (
              <span className="px-1.5 py-0.5 text-[10px] bg-emerald-950 text-emerald-300 rounded border border-emerald-700 flex items-center font-mono">
                <Sparkles className="w-2.5 h-2.5 mr-1 text-emerald-400" /> @google/genai CONNECTED
              </span>
            ) : (
              <span className="px-1.5 py-0.5 text-[10px] bg-amber-950 text-amber-300 rounded border border-amber-800 font-mono">
                READY (Key via Secrets)
              </span>
            )}
          </div>

          <div className="flex items-center text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800 text-[11px]">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            <span>Phase 1 Architect Blueprint Active</span>
          </div>
        </div>
      </div>

      {/* Main Navigation & Title */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 flex items-center justify-center shadow-lg shadow-cyan-900/40 border border-cyan-400/30">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold tracking-tight text-white font-mono">
                KITORA COMMAND CENTER
              </h1>
              <span className="px-2 py-0.5 text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800 rounded">
                KCC AI-OS
              </span>
            </div>
            <p className="text-xs text-slate-400">
              Autonomous Enterprise AI Operating System for KITORA E-Commerce
            </p>
          </div>
        </div>

        {/* Navigation Tabs */}
        <nav className="flex items-center space-x-1 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <button
            onClick={() => setCurrentTab('kcc-mission-control')}
            className={`px-4 py-1.5 rounded-lg text-xs font-extrabold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'kcc-mission-control'
                ? 'bg-gradient-to-r from-cyan-500 via-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-900/80 ring-2 ring-indigo-400 animate-pulse'
                : 'bg-indigo-950 text-indigo-300 border border-indigo-600 hover:bg-indigo-900 hover:text-white'
            }`}
          >
            <Sparkles className="w-4 h-4 text-cyan-300" />
            <span>Mission Control</span>
          </button>

          <button
            onClick={() => setCurrentTab('phase4-commerce')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'phase4-commerce'
                ? 'bg-gradient-to-r from-indigo-500 via-purple-600 to-indigo-700 text-white shadow-lg shadow-indigo-900/60 ring-1 ring-indigo-300'
                : 'bg-indigo-950/90 text-indigo-300 border border-indigo-700 hover:bg-indigo-900 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-indigo-300" />
            <span>Phase 4 Autonomous Commerce</span>
          </button>

          <button
            onClick={() => setCurrentTab('pilot-production')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'pilot-production'
                ? 'bg-gradient-to-r from-emerald-500 to-cyan-500 text-white shadow-lg shadow-emerald-900/60 ring-1 ring-cyan-300'
                : 'bg-slate-900 text-emerald-400 border border-emerald-800/80 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
            <span>Pilot Production Directive</span>
          </button>

          <button
            onClick={() => setCurrentTab('diagnostics')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'diagnostics'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-900/60 ring-1 ring-emerald-300'
                : 'bg-emerald-950/90 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 hover:text-white'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Phase 3A Production Hardening</span>
          </button>

          <button
            onClick={() => setCurrentTab('phase3-ops')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'phase3-ops'
                ? 'bg-gradient-to-r from-emerald-600 to-cyan-600 text-white shadow-lg shadow-emerald-900/60 ring-1 ring-emerald-400'
                : 'bg-emerald-950/80 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-emerald-300 fill-current" />
            <span>Phase 3 Autonomous Ops</span>
          </button>

          <button
            onClick={() => setCurrentTab('core-runtime')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'core-runtime'
                ? 'bg-gradient-to-r from-cyan-600 to-indigo-600 text-white shadow-md shadow-cyan-900/50 ring-1 ring-cyan-400'
                : 'bg-cyan-950/60 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900 hover:text-white'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-cyan-300" />
            <span>Core Runtime Kernel</span>
          </button>

          <button
            onClick={() => setCurrentTab('verification-report')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'verification-report'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-900/50 ring-1 ring-emerald-400'
                : 'bg-emerald-950/60 text-emerald-300 border border-emerald-800/80 hover:bg-emerald-900 hover:text-white'
            }`}
          >
            <FileCheck className="w-3.5 h-3.5 text-emerald-300" />
            <span>Phase 2A Verification Report</span>
          </button>

          <button
            onClick={() => setCurrentTab('reality-audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'reality-audit'
                ? 'bg-amber-600 text-white shadow-md shadow-amber-900/50 font-bold'
                : 'text-amber-300 hover:bg-slate-800 hover:text-amber-200'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-300" />
            <span>CTO Reality Audit</span>
          </button>

          <button
            onClick={() => setCurrentTab('policies')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'policies'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50 font-bold'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Safety Policies</span>
          </button>

          <button
            onClick={() => setCurrentTab('blueprint')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'blueprint'
                ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <FileCode2 className="w-3.5 h-3.5" />
            <span>Phase 1 Architecture</span>
          </button>

          <button
            onClick={() => setCurrentTab('live-os')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'live-os'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Zap className="w-3.5 h-3.5 text-amber-300" />
            <span>Live Autonomous OS</span>
          </button>

          <button
            onClick={() => setCurrentTab('agents')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'agents'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Bot className="w-3.5 h-3.5 text-cyan-300" />
            <span>16 Agents Matrix</span>
          </button>

          <button
            onClick={() => setCurrentTab('approvals')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap relative ${
              currentTab === 'approvals'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Shield className="w-3.5 h-3.5 text-amber-400" />
            <span>Approval Center</span>
            {pendingApprovalsCount > 0 && (
              <span className="ml-1 px-1.5 py-0.2 bg-rose-500 text-white text-[10px] font-bold rounded-full animate-bounce">
                {pendingApprovalsCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setCurrentTab('tasks')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'tasks'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
            <span>Task Queue</span>
          </button>

          <button
            onClick={() => setCurrentTab('audit')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'audit'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>Audit Logs</span>
          </button>

          <button
            onClick={() => setCurrentTab('integrations')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center space-x-1.5 whitespace-nowrap ${
              currentTab === 'integrations'
                ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
                : 'text-slate-300 hover:bg-slate-800 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 text-cyan-400" />
            <span>Integrations</span>
          </button>
        </nav>
      </div>
    </header>
  );
};
