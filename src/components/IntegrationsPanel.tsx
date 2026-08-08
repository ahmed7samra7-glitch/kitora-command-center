import React from 'react';
import { Sliders, CheckCircle2, Clock, AlertCircle, Key, ShieldCheck, ExternalLink } from 'lucide-react';

interface IntegrationItem {
  id: string;
  name: string;
  category: string;
  status: 'CONNECTED' | 'READY_VIA_SECRETS' | 'FUTURE_EXPANSION';
  envVar: string;
  description: string;
}

const INTEGRATIONS: IntegrationItem[] = [
  { id: 'gemini', name: 'Google AI Studio / Gemini', category: 'AI Models', status: 'CONNECTED', envVar: 'GEMINI_API_KEY', description: '@google/genai SDK used for server-side reasoning, ad copywriting, customer support, and orchestrator routing.' },
  { id: 'openai', name: 'OpenAI (GPT-4o Adapter)', category: 'AI Models', status: 'READY_VIA_SECRETS', envVar: 'OPENAI_API_KEY', description: 'Secondary fallback LLM provider adapter for redundancy and cross-model validation.' },
  { id: 'paypal', name: 'PayPal REST Gateway', category: 'Finance & Payments', status: 'READY_VIA_SECRETS', envVar: 'PAYPAL_CLIENT_ID & SECRET', description: 'Processes e-commerce checkout payments and sweeps daily profits to reserve vault.' },
  { id: 'cj', name: 'CJ Dropshipping REST API', category: 'Logistics & Sourcing', status: 'READY_VIA_SECRETS', envVar: 'CJ_DROPSHIPPING_API_KEY', description: 'Product catalog sourcing, automated order placement, shipping rates, tracking sync.' },
  { id: 'whatsapp', name: 'WhatsApp Cloud API', category: 'Governance & Messaging', status: 'READY_VIA_SECRETS', envVar: 'WHATSAPP_TOKEN & PHONE_ID', description: 'Sends high-impact approval cards directly to Owner WhatsApp for < 5 mins/day human-in-the-loop sign-off.' },
  { id: 'resend', name: 'Resend Transactional Email', category: 'Customer & Governance', status: 'READY_VIA_SECRETS', envVar: 'RESEND_API_KEY', description: 'Delivers daily executive PDF summaries and customer support email replies.' },
  { id: 'supabase', name: 'Supabase PostgreSQL & Vector DB', category: 'Persistence & Memory', status: 'READY_VIA_SECRETS', envVar: 'SUPABASE_URL & ANON_KEY', description: 'Relational database for task queue, financial ledger, and pgvector long-term memory embeddings.' },
  { id: 'github', name: 'GitHub Actions & REST API', category: 'DevOps & Engineering', status: 'READY_VIA_SECRETS', envVar: 'GITHUB_TOKEN', description: 'CI/CD pipeline triggering, pull request reviews, and engineering deployment automation.' },
  { id: 'meta', name: 'Meta Ads Graph API', category: 'Marketing & Traffic', status: 'READY_VIA_SECRETS', envVar: 'META_ADS_ACCESS_TOKEN', description: 'Autonomous ad campaign creation, budget scaling, and audience targeting.' },
  { id: 'ga4', name: 'Google Analytics 4', category: 'Analytics', status: 'READY_VIA_SECRETS', envVar: 'GA4_MEASUREMENT_ID', description: 'E-commerce conversion funnel tracking, user traffic metrics, and ROAS calculations.' },
  { id: 'stripe', name: 'Stripe Payment Gateway', category: 'Finance', status: 'FUTURE_EXPANSION', envVar: 'STRIPE_SECRET_KEY', description: 'Secondary merchant processing adapter scheduled for Phase 4 rollout.' },
  { id: 'shopify', name: 'Shopify Storefront API', category: 'E-Commerce Platform', status: 'FUTURE_EXPANSION', envVar: 'SHOPIFY_ACCESS_TOKEN', description: 'Multi-store connector adapter for external Shopify store management.' },
];

export const IntegrationsPanel: React.FC = () => {
  const [testOrder, setTestOrder] = React.useState('');
  const [isDispatching, setIsDispatching] = React.useState(false);
  const [gptResponse, setGptResponse] = React.useState<any>(null);
  const [copiedUrl, setCopiedUrl] = React.useState(false);

  const openApiUrl = typeof window !== 'undefined' ? `${window.location.origin}/api/openapi.json` : '/api/openapi.json';

  const handleCopyOpenApi = () => {
    navigator.clipboard.writeText(openApiUrl);
    setCopiedUrl(true);
    setTimeout(() => setCopiedUrl(false), 2000);
  };

  const handleTestDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testOrder.trim()) return;
    setIsDispatching(true);
    setGptResponse(null);

    try {
      const res = await fetch('/api/kcc/chatgpt/order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: testOrder, priority: 'HIGH' })
      });
      const data = await res.json();
      setGptResponse(data);
    } catch (err: any) {
      setGptResponse({ success: false, error: err.message || String(err) });
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      {/* ChatGPT / Custom GPT Integration Banner */}
      <div className="bg-gradient-to-r from-emerald-950/80 via-slate-900 to-cyan-950/80 border border-emerald-800/60 rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ACTIVE INTEGRATION
              </span>
              <h2 className="text-xl font-bold text-white font-mono flex items-center">
                🤖 ChatGPT & Custom GPT Action Bridge
              </h2>
            </div>
            <p className="text-xs text-slate-300 mt-1">
              Connect ChatGPT or any OpenAI Custom GPT directly to KCC to issue verbal & text orders.
            </p>
          </div>

          <button
            onClick={handleCopyOpenApi}
            className="flex items-center space-x-2 px-3 py-2 bg-emerald-900/60 hover:bg-emerald-800/80 text-emerald-200 border border-emerald-700/60 rounded-lg text-xs font-mono transition-colors"
          >
            <ExternalLink className="w-4 h-4" />
            <span>{copiedUrl ? 'Copied OpenAPI URL!' : 'Copy ChatGPT Action OpenAPI URL'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Quick Setup Instructions */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2 font-mono">
            <h3 className="font-bold text-emerald-400 text-sm flex items-center">
              <Key className="w-4 h-4 mr-1.5" />
              How to Connect ChatGPT in 3 Steps:
            </h3>
            <ol className="list-decimal list-inside space-y-1.5 text-slate-300 text-[11px]">
              <li>Open ChatGPT <code className="bg-slate-900 text-amber-300 px-1 rounded">chat.openai.com</code> → Explore GPTs → Create GPT.</li>
              <li>Under <span className="text-white font-bold">Actions</span>, click <span className="text-white font-bold">Import from URL</span>.</li>
              <li>Paste this URL: <code className="text-cyan-300 bg-slate-900 px-1 py-0.5 rounded border border-slate-800 text-[10px] select-all">{openApiUrl}</code></li>
            </ol>
            <p className="text-[10px] text-slate-400 pt-1">
              ChatGPT will now automatically understand KCC commands (e.g. "Launch new marketing campaign", "Check mission status").
            </p>
          </div>

          {/* Live ChatGPT Bridge Order Tester */}
          <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-3">
            <h3 className="font-bold text-cyan-400 text-sm font-mono flex items-center">
              <Sliders className="w-4 h-4 mr-1.5" />
              Test ChatGPT Order Bridge Live
            </h3>

            <form onSubmit={handleTestDispatch} className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={testOrder}
                  onChange={(e) => setTestOrder(e.target.value)}
                  placeholder="e.g. Optimize catalog product pricing..."
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
                <button
                  type="submit"
                  disabled={isDispatching || !testOrder.trim()}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono font-bold text-xs rounded-lg transition-colors"
                >
                  {isDispatching ? 'Sending...' : 'Dispatch'}
                </button>
              </div>
            </form>

            {gptResponse && (
              <div className="bg-slate-900 p-3 rounded-lg border border-slate-800 font-mono text-[11px] text-slate-300 max-h-40 overflow-y-auto space-y-1">
                <div className="flex items-center justify-between text-emerald-400 font-bold border-b border-slate-800 pb-1">
                  <span>Bridge Status: {gptResponse.success ? '200 OK' : 'ERROR'}</span>
                  <span>Mission: {gptResponse.missionId || 'N/A'}</span>
                </div>
                <pre className="whitespace-pre-wrap text-slate-200 mt-1">{gptResponse.reply || JSON.stringify(gptResponse, null, 2)}</pre>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h2 className="text-xl font-bold text-white font-mono flex items-center">
              <Sliders className="w-5 h-5 text-cyan-400 mr-2" />
              Multi-Service Integrations & Secrets Management
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Every external provider is connected via a modular adapter pattern. Secrets are managed securely via platform environment variables.
            </p>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-300 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Zero Keys Exposed To Client</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {INTEGRATIONS.map((item) => (
            <div key={item.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3 font-mono text-xs">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white">{item.name}</span>
                <span className={`px-2 py-0.5 text-[10px] rounded font-bold ${
                  item.status === 'CONNECTED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                  item.status === 'READY_VIA_SECRETS' ? 'bg-cyan-950 text-cyan-300 border border-cyan-800' :
                  'bg-slate-800 text-slate-400 border border-slate-700'
                }`}>
                  {item.status}
                </span>
              </div>

              <div className="text-[10px] text-slate-400 flex items-center">
                <Key className="w-3 h-3 mr-1 text-amber-400" />
                <span>Env: <code className="text-slate-200">{item.envVar}</code></span>
              </div>

              <p className="text-slate-300 text-xs font-sans leading-relaxed">{item.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
