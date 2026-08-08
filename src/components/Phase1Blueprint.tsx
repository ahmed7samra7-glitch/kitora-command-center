import React, { useState } from 'react';
import { BlueprintSection, SystemInfo } from '../types';
import { 
  AGENTS_MATRIX, 
  DB_SCHEMA_DRIZZLE, 
  API_SPECIFICATION, 
  TECH_STACK, 
  ROADMAP, 
  RISKS 
} from '../data/architectureData';
import { 
  FolderTree, 
  Layers, 
  Cpu, 
  Database, 
  Network, 
  Bot, 
  Milestone, 
  AlertTriangle, 
  CheckCircle, 
  FileCode, 
  Copy, 
  Check, 
  Zap, 
  ShieldAlert, 
  Terminal,
  ArrowRight
} from 'lucide-react';

interface Phase1BlueprintProps {
  systemInfo: SystemInfo | null;
  onSignOff: (signedBy: string, notes: string) => void;
  onSwitchToLiveOS: () => void;
}

export const Phase1Blueprint: React.FC<Phase1BlueprintProps> = ({
  systemInfo,
  onSignOff,
  onSwitchToLiveOS
}) => {
  const [activeSection, setActiveSection] = useState<BlueprintSection>('architecture');
  const [copiedCode, setCopiedCode] = useState(false);
  const [signerName, setSignerName] = useState('Principal Software Architect (CTO)');
  const [signNotes, setSignNotes] = useState('Phase 1 Blueprint officially approved for production rollout.');

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleFormSignOff = (e: React.FormEvent) => {
    e.preventDefault();
    onSignOff(signerName, signNotes);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* Executive Hero Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-80 h-80 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 relative z-10">
          <div>
            <div className="inline-flex items-center space-x-2 px-3 py-1 bg-cyan-950/80 border border-cyan-800 text-cyan-300 rounded-full text-xs font-mono mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>PHASE 1 ARCHITECT BLUEPRINT & SPECIFICATION</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight font-mono">
              KITORA COMMAND CENTER (KCC)
            </h2>
            <p className="mt-2 text-slate-300 text-sm max-w-2xl leading-relaxed">
              Enterprise AI Operating System for Autonomous E-Commerce Management.
              Designed with Clean Architecture, Provider-Agnostic AI Adapters, 16 Independent Agents,
              and strict Human-in-the-Loop Governance (&lt; 5 minutes/day owner involvement).
            </p>
          </div>

          <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl flex flex-col justify-center space-y-3 min-w-[260px]">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Blueprint Approval:</span>
              {systemInfo?.phase1SignOff?.approved ? (
                <span className="text-emerald-400 font-bold flex items-center">
                  <CheckCircle className="w-3.5 h-3.5 mr-1" /> APPROVED
                </span>
              ) : (
                <span className="text-amber-400 font-bold">PENDING SIGN-OFF</span>
              )}
            </div>

            <div className="text-xs text-slate-400">
              Target Company: <strong className="text-white">KITORA (D2C E-Commerce)</strong>
            </div>

            <button
              onClick={onSwitchToLiveOS}
              className="w-full py-2 px-4 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white font-medium text-xs rounded-lg shadow-lg transition-all flex items-center justify-center space-x-2 group"
            >
              <span>Launch Live OS Console</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>

      {/* Blueprint Sub-Navigation Tabs */}
      <div className="flex items-center space-x-1 overflow-x-auto bg-slate-900 p-1.5 rounded-xl border border-slate-800 scrollbar-none">
        {[
          { id: 'architecture', label: '1. Architecture & Layers', icon: Layers },
          { id: 'agents-matrix', label: '2. 16 AI Agents Matrix', icon: Bot },
          { id: 'db-schema', label: '3. Database Schema', icon: Database },
          { id: 'api-design', label: '4. API Specification', icon: Network },
          { id: 'tech-stack', label: '5. Tech Stack & Adapters', icon: Cpu },
          { id: 'roadmap', label: '6. Roadmap & Milestones', icon: Milestone },
          { id: 'risks', label: '7. Risks & Guardrails', icon: AlertTriangle },
          { id: 'sign-off', label: '8. Executive Sign-Off', icon: Terminal },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = activeSection === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id as BlueprintSection)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center space-x-2 whitespace-nowrap ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* SECTION 1: ARCHITECTURE & LAYERS */}
      {activeSection === 'architecture' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center space-x-2 font-mono">
                <Layers className="w-5 h-5 text-cyan-400" />
                <span>Clean Architecture & Modular Kernel Diagram</span>
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Strict separation of concerns. Independent domain agents communicate strictly through the Master Orchestrator via an immutable event bus.
              </p>
            </div>

            {/* Visual Architecture Layers Grid */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-slate-950/80 border border-cyan-800/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-cyan-400 font-mono flex items-center">
                  <span className="w-2 h-2 rounded-full bg-cyan-400 mr-2"></span>
                  1. Presentation Layer
                </div>
                <p className="text-[11px] text-slate-300">
                  Executive Command Center, WhatsApp Cloud API Bridge, Daily Briefing Dashboard, Approval Cards, Audit Explorer.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-indigo-800/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-indigo-400 font-mono flex items-center">
                  <span className="w-2 h-2 rounded-full bg-indigo-400 mr-2"></span>
                  2. Orchestration Kernel
                </div>
                <p className="text-[11px] text-slate-300">
                  Master Orchestrator Agent, Task Queue Manager, Workflow Engine, State Machine, Dead Letter Queue (DLQ).
                </p>
              </div>

              <div className="bg-slate-950/80 border border-purple-800/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-purple-400 font-mono flex items-center">
                  <span className="w-2 h-2 rounded-full bg-purple-400 mr-2"></span>
                  3. 16 Autonomous Agents
                </div>
                <p className="text-[11px] text-slate-300">
                  CTO, Finance, Marketing, Product Hunter, Supplier, QA, Security, Customer Support, Memory, Approval, Deployment, etc.
                </p>
              </div>

              <div className="bg-slate-950/80 border border-emerald-800/60 rounded-xl p-4 space-y-2">
                <div className="text-xs font-bold text-emerald-400 font-mono flex items-center">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 mr-2"></span>
                  4. Adapter & Infrastructure
                </div>
                <p className="text-[11px] text-slate-300">
                  Provider-Agnostic LLM Adapter (Gemini / OpenAI), PayPal REST, CJ Dropshipping, Meta Ads, Supabase PostgreSQL, Resend.
                </p>
              </div>
            </div>

            {/* Folder Structure */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-slate-300">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <span className="font-bold text-cyan-400 flex items-center">
                  <FolderTree className="w-4 h-4 mr-2" />
                  KITORA COMMAND CENTER Production Folder Structure
                </span>
                <span className="text-[10px] text-slate-500">Modular & Replaceable</span>
              </div>
              <pre className="text-slate-300 overflow-x-auto text-[11px] leading-relaxed">
{`/kitora-command-center
├── server.ts                 # Express Server & Vite SSR Middleware Entrypoint
├── package.json              # System Manifest & Scripts
├── metadata.json             # Applet Metadata & Platform Capabilities
├── src/
│   ├── main.tsx              # React Entrypoint
│   ├── App.tsx               # Primary Layout Router & Root State
│   ├── types.ts              # Global System Data Models & Interfaces
│   ├── data/
│   │   └── architectureData.ts# System Blueprint Specifications
│   ├── components/
│   │   ├── Header.tsx        # Command Center Navigation Bar
│   │   ├── Phase1Blueprint.tsx# Interactive Architecture Blueprint & Specs
│   │   ├── LiveOSConsole.tsx # Autonomous Operating System Dashboard
│   │   ├── IntegrationsPanel.tsx# API Credentials & Adapter Controls
│   ├── db/
│   │   └── schema.ts         # Drizzle ORM PostgreSQL Database Schemas
│   ├── agents/               # 16 Modular AI Agent Implementations
│   │   ├── Orchestrator.ts   # System Kernel Router & Prompt Translator
│   │   ├── ProductHunter.ts  # CJ Dropshipping Product Scout
│   │   ├── FinanceAgent.ts   # PayPal P&L & Balance Sweep Engine
│   │   ├── MarketingAgent.ts # Meta/Google Ad Creative Pipeline
│   │   └── ApprovalAgent.ts  # Human-in-the-Loop WhatsApp Gatekeeper
│   └── adapters/             # External Service Abstraction Layer
│       ├── aiProvider.ts     # Gemini @google/genai & OpenAI Adapter
│       ├── cjDropshipping.ts # CJ Dropshipping API Connector
│       ├── paypal.ts         # PayPal Payment & Sweep Adapter
│       ├── whatsapp.ts       # WhatsApp Cloud API Messaging
│       └── supabase.ts       # Database & Vector Memory Connection`}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 2: 16 AI AGENTS MATRIX */}
      {activeSection === 'agents-matrix' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center">
                  <Bot className="w-5 h-5 text-indigo-400 mr-2" />
                  16 Independent AI Agents Matrix
                </h3>
                <p className="text-xs text-slate-400">
                  Sub-agents never communicate directly. All directives are routed through the Master Orchestrator Kernel with immutable audit trails.
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-950 border border-indigo-800 text-indigo-300 text-xs font-mono rounded-full font-bold">
                16 AGENTS ACTIVE
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {AGENTS_MATRIX.map((agent) => (
                <div key={agent.id} className="bg-slate-950/90 border border-slate-800 hover:border-slate-700 p-4 rounded-xl space-y-3 transition-all">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-lg bg-indigo-900/60 border border-indigo-700 flex items-center justify-center font-bold font-mono text-indigo-300 text-xs">
                        {agent.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-white font-mono">{agent.name}</h4>
                        <span className="text-[10px] text-slate-400">{agent.role}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-slate-800 text-slate-300 border border-slate-700">
                      {agent.category}
                    </span>
                  </div>

                  <p className="text-xs text-slate-300">{agent.description}</p>

                  <div className="bg-slate-900 p-2.5 rounded-lg border border-slate-800/80 text-[11px] space-y-1">
                    <div className="text-amber-400 font-mono font-bold flex items-center">
                      <ShieldAlert className="w-3 h-3 mr-1" /> Human Approval Threshold:
                    </div>
                    <p className="text-slate-300 text-[10px]">{agent.humanApprovalThreshold}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400">
                    <div>
                      <strong className="text-slate-300">Inputs:</strong> {agent.inputs.join(', ')}
                    </div>
                    <div>
                      <strong className="text-slate-300">Outputs:</strong> {agent.outputs.join(', ')}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 3: DATABASE SCHEMA */}
      {activeSection === 'db-schema' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-white font-mono flex items-center">
                  <Database className="w-5 h-5 text-emerald-400 mr-2" />
                  Drizzle ORM & PostgreSQL Schema Specification
                </h3>
                <p className="text-xs text-slate-400">
                  Multi-tenant relational structure supporting multi-store, multi-supplier, task queue state machine, and immutable financial ledger.
                </p>
              </div>

              <button
                onClick={() => copyToClipboard(DB_SCHEMA_DRIZZLE)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-mono rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all"
              >
                {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedCode ? 'Copied' : 'Copy Schema TS'}</span>
              </button>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs overflow-x-auto text-emerald-300">
              <pre className="text-[11px] leading-relaxed">{DB_SCHEMA_DRIZZLE}</pre>
            </div>
          </div>
        </div>
      )}

      {/* SECTION 4: API DESIGN */}
      {activeSection === 'api-design' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center">
                <Network className="w-5 h-5 text-cyan-400 mr-2" />
                REST & WebSocket Event-Bus API Specification
              </h3>
              <p className="text-xs text-slate-400">
                Production REST API contracts for Orchestrator kernel, Task Queue management, Approval Bridge, and Webhook triggers.
              </p>
            </div>

            <div className="space-y-2">
              {API_SPECIFICATION.map((api, idx) => (
                <div key={idx} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-2 font-mono text-xs">
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      api.method === 'GET' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-indigo-950 text-indigo-400 border border-indigo-800'
                    }`}>
                      {api.method}
                    </span>
                    <span className="text-cyan-300 font-bold">{api.path}</span>
                  </div>
                  <span className="text-slate-400 text-[11px]">{api.desc}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 5: TECH STACK & ADAPTERS */}
      {activeSection === 'tech-stack' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center">
                <Cpu className="w-5 h-5 text-indigo-400 mr-2" />
                Technology Stack & Modular Integrations Architecture
              </h3>
              <p className="text-xs text-slate-400">
                Every external vendor is interfaced via an isolated Adapter interface. Swapping AI or payment providers requires zero modification to core agent logic.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {TECH_STACK.map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-slate-400">{item.component}:</span>
                    <span className="text-cyan-400 font-bold">{item.tech}</span>
                  </div>
                  <p className="text-slate-300 text-xs">{item.role}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 6: ROADMAP & MILESTONES */}
      {activeSection === 'roadmap' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center">
                <Milestone className="w-5 h-5 text-amber-400 mr-2" />
                Multi-Phase Implementation Roadmap
              </h3>
              <p className="text-xs text-slate-400">
                Structured execution plan ensuring complete verification before phase transitions.
              </p>
            </div>

            <div className="space-y-4">
              {ROADMAP.map((item, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-white font-mono">{item.phase}: {item.title}</span>
                    <span className={`px-2.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                      item.status === 'COMPLETE' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                      item.status === 'IN_PROGRESS' ? 'bg-amber-950 text-amber-400 border border-amber-800 animate-pulse' :
                      'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}>
                      {item.status}
                    </span>
                  </div>

                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-300 pt-1">
                    {item.tasks.map((task, tIdx) => (
                      <li key={tIdx} className="flex items-center space-x-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400"></span>
                        <span>{task}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 7: RISKS & GUARDRAILS */}
      {activeSection === 'risks' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center">
                <AlertTriangle className="w-5 h-5 text-rose-400 mr-2" />
                Enterprise Risk Matrix & Failure Mitigation
              </h3>
              <p className="text-xs text-slate-400">
                Hard constraints preventing financial loss, brand damage, or secret exposure.
              </p>
            </div>

            <div className="space-y-3">
              {RISKS.map((risk, idx) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-rose-300 font-mono">{risk.risk}</span>
                    <span className="px-2 py-0.5 bg-rose-950 text-rose-400 border border-rose-800 text-[10px] font-bold rounded">
                      SEVERITY: {risk.severity}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300">
                    <strong className="text-emerald-400">Mitigation Strategy:</strong> {risk.mitigation}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECTION 8: EXECUTIVE SIGN-OFF */}
      {activeSection === 'sign-off' && (
        <div className="space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-white font-mono flex items-center">
                <Terminal className="w-5 h-5 text-emerald-400 mr-2" />
                Phase 1 Executive Sign-Off & Transition Workspace
              </h3>
              <p className="text-xs text-slate-400">
                Official architectural sign-off authorizing transition from Phase 1 Planning to Live Autonomous OS Execution Mode.
              </p>
            </div>

            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-3">
                <span className="text-slate-400">Current Phase 1 Approval Status:</span>
                <span className="text-emerald-400 font-bold font-mono flex items-center">
                  <CheckCircle className="w-4 h-4 mr-1" /> PHASE 1 BLUEPRINT VERIFIED & SIGNED OFF
                </span>
              </div>

              <form onSubmit={handleFormSignOff} className="space-y-4 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1 font-mono font-bold">Signer Title & Name:</label>
                  <input
                    type="text"
                    value={signerName}
                    onChange={(e) => setSignerName(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="Principal Software Architect / CTO"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-mono font-bold">Sign-off Certification Notes:</label>
                  <textarea
                    rows={3}
                    value={signNotes}
                    onChange={(e) => setSignNotes(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-white font-mono focus:border-cyan-500 focus:outline-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-medium rounded-lg text-xs font-mono transition-all flex items-center justify-center space-x-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    <span>Update Phase 1 Certification</span>
                  </button>

                  <button
                    type="button"
                    onClick={onSwitchToLiveOS}
                    className="flex-1 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg text-xs font-mono transition-all flex items-center justify-center space-x-2"
                  >
                    <Zap className="w-4 h-4 text-amber-300" />
                    <span>Proceed to Live Operating System</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
