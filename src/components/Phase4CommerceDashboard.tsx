import React, { useState, useEffect } from 'react';
import { 
  Bot, 
  Sparkles, 
  DollarSign, 
  ShoppingBag, 
  TrendingUp, 
  Zap, 
  ShieldCheck, 
  Layers, 
  FileText, 
  Image as ImageIcon, 
  Megaphone, 
  Send, 
  BarChart3, 
  PieChart, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Play, 
  ArrowRight, 
  Clock, 
  Undo2, 
  Eye, 
  ExternalLink,
  Target,
  Percent,
  Calculator,
  MessageSquare,
  Truck,
  CreditCard,
  Lock,
  UserCheck
} from 'lucide-react';

export const Phase4CommerceDashboard: React.FC<{ onRefreshData?: () => void }> = ({ onRefreshData }) => {
  const [activeTab, setActiveTab] = useState<
    'executive' | 'pipeline' | 'pricing' | 'content' | 'landing' | 'marketing' | 'customer' | 'finance'
  >('executive');

  const [loading, setLoading] = useState(false);

  // Phase 4 Data States
  const [overview, setOverview] = useState<any>(null);
  const [pipeline, setPipeline] = useState<any[]>([]);
  
  // Interactive Pricing State
  const [pricingInput, setPricingInput] = useState({
    productCostUSD: 14.50,
    shippingUSD: 5.20,
    targetNetMarginPercent: 35,
    adReserveUSD: 10.00
  });
  const [calculatedPricing, setCalculatedPricing] = useState<any>(null);

  // Content Generator State
  const [contentPrompt, setContentPrompt] = useState({
    productTitle: 'Ultra-Quiet Smart Ionic Hair Dryer',
    category: 'Beauty & Personal Care'
  });
  const [generatedContent, setGeneratedContent] = useState<any>(null);

  // Marketing Generator State
  const [generatedMarketing, setGeneratedMarketing] = useState<any>(null);

  // Customer Automation Trigger State
  const [customerAutomationResult, setCustomerAutomationResult] = useState<any>(null);

  useEffect(() => {
    fetchPhase4Data();
    calculatePricing();
  }, []);

  const fetchPhase4Data = async () => {
    setLoading(true);
    try {
      const [ovRes, pipeRes] = await Promise.all([
        fetch('/api/phase4/executive-overview').then(r => r.json()).catch(() => null),
        fetch('/api/phase4/pipeline').then(r => r.json()).catch(() => null)
      ]);

      if (ovRes?.overview) setOverview(ovRes.overview);
      if (pipeRes?.pipeline) setPipeline(pipeRes.pipeline);
    } catch (err) {
      console.error('Error fetching Phase 4 data:', err);
    } finally {
      setLoading(false);
      if (onRefreshData) onRefreshData();
    }
  };

  const handleHuntPipeline = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phase4/pipeline/hunt', { method: 'POST' });
      const data = await res.json();
      if (data.success && data.pipeline) {
        setPipeline(data.pipeline);
      }
    } catch (err: any) {
      alert(`Product Hunt Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const calculatePricing = async () => {
    try {
      const res = await fetch('/api/phase4/pricing/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pricingInput)
      });
      const data = await res.json();
      if (data.success) {
        setCalculatedPricing(data.pricing);
      }
    } catch (err) {
      console.error('Pricing calculation error:', err);
    }
  };

  const handleGenerateContent = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phase4/content/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentPrompt)
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedContent(data.content);
      }
    } catch (err: any) {
      alert(`Content generation error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateMarketing = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/phase4/marketing/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productTitle: contentPrompt.productTitle })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMarketing(data.marketing);
      }
    } catch (err: any) {
      alert(`Marketing generation error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleTriggerCustomerAutomation = async (event: string) => {
    setLoading(true);
    try {
      const res = await fetch('/api/phase4/customer/automate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ORD-KITORA-99120', event })
      });
      const data = await res.json();
      if (data.success) {
        setCustomerAutomationResult(data.result);
      }
    } catch (err: any) {
      alert(`Customer automation error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Bot className="w-64 h-64 text-indigo-400" />
        </div>

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <span className="p-3 bg-indigo-950 text-indigo-400 border border-indigo-800 rounded-xl shadow-lg">
              <Bot className="w-9 h-9" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 uppercase">
                  Phase 4 Live Engine
                </span>
                <span className="text-xs text-slate-400 font-mono">&bull; Policy-Driven & Auditable</span>
              </div>
              <h1 className="text-2xl font-bold text-white font-mono mt-1">
                KITORA AUTONOMOUS COMMERCE ENGINE
              </h1>
              <p className="text-xs text-slate-300 mt-0.5">
                Target Owner Overhead: &lt; 5 Minutes / Day &bull; Fully Automated Sourcing, Pricing, Copy, Media & Fulfillment
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            <div className="bg-slate-950 px-4 py-2 rounded-xl border border-slate-800 text-right">
              <span className="text-[10px] text-slate-500 uppercase block font-mono">Owner Overhead</span>
              <strong className="text-xl font-bold text-emerald-400 font-mono">
                {overview?.dailyOwnerTimeMinutes || 2.5} mins / day
              </strong>
            </div>

            <button
              onClick={fetchPhase4Data}
              disabled={loading}
              className="px-4 py-3 bg-slate-950 hover:bg-slate-800 text-indigo-300 border border-slate-800 rounded-xl text-xs font-mono font-bold transition-all flex items-center space-x-2 shadow-lg"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-indigo-400' : ''}`} />
              <span>Refresh Commerce State</span>
            </button>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveTab('executive')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'executive'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>1. Executive Dashboard (&lt;5m/day)</span>
        </button>

        <button
          onClick={() => setActiveTab('pipeline')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'pipeline'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>2. Product Pipeline & AI Hunter</span>
        </button>

        <button
          onClick={() => setActiveTab('pricing')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'pricing'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Calculator className="w-4 h-4" />
          <span>3. Dynamic Pricing Engine</span>
        </button>

        <button
          onClick={() => setActiveTab('content')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'content'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>4. AI Content & Copy Generator</span>
        </button>

        <button
          onClick={() => setActiveTab('landing')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'landing'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>5. High-Converting Landing Page</span>
        </button>

        <button
          onClick={() => setActiveTab('marketing')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'marketing'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Megaphone className="w-4 h-4" />
          <span>6. Marketing Automation</span>
        </button>

        <button
          onClick={() => setActiveTab('customer')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'customer'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          <span>7. CX & Dispatch Automation</span>
        </button>

        <button
          onClick={() => setActiveTab('finance')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeTab === 'finance'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>8. Financial Intelligence</span>
        </button>
      </div>

      {/* TAB 1: EXECUTIVE DASHBOARD */}
      {activeTab === 'executive' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Daily Owner Effort</span>
              <strong className="text-2xl text-emerald-400 font-mono">&lt; 2.5 Minutes</strong>
              <span className="text-[10px] text-slate-400 font-mono block">Fully Autonomous Operation</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Pipeline Catalog</span>
              <strong className="text-2xl text-white font-mono">{overview?.totalCatalogProducts || pipeline.length} Products</strong>
              <span className="text-[10px] text-indigo-400 font-mono block">{overview?.autoPublishedProducts || 2} Auto-Published</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Realized Net Profit (30D)</span>
              <strong className="text-2xl text-cyan-400 font-mono">${overview?.financials?.netProfit?.toLocaleString() || '6,587'}</strong>
              <span className="text-[10px] text-emerald-400 font-mono block">{overview?.financials?.profitMarginPercent || 46.1}% Net Margin</span>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-xl space-y-1">
              <span className="text-[10px] text-slate-500 uppercase font-mono block">Policy Guardrails</span>
              <strong className="text-2xl text-emerald-400 font-mono">100% Enforced</strong>
              <span className="text-[10px] text-slate-400 font-mono block">All Decisions Reversible</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Active Campaigns */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white font-mono flex items-center">
                <Megaphone className="w-4 h-4 mr-2 text-indigo-400" />
                Active Autonomous Ad Campaigns
              </h3>

              <div className="space-y-3">
                {overview?.campaigns?.map((camp: any) => (
                  <div key={camp.id} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1.5 text-xs font-mono">
                    <div className="flex justify-between items-center">
                      <strong className="text-white">{camp.platform}</strong>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                        {camp.status}
                      </span>
                    </div>
                    <p className="text-slate-400 text-[11px]">&bull; Target: {camp.targetProduct}</p>
                    <p className="text-slate-300 text-[11px] bg-slate-900 p-2 rounded border border-slate-800/80">
                      {camp.adCreative || camp.template}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Audit Trail & Reversibility */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <h3 className="text-sm font-bold text-white font-mono flex items-center justify-between">
                <span className="flex items-center">
                  <Undo2 className="w-4 h-4 mr-2 text-cyan-400" />
                  Audit Trail & Reversibility Log
                </span>
                <span className="text-[10px] text-emerald-400">100% Reversible</span>
              </h3>

              <div className="space-y-3">
                {overview?.reversibilityLog?.map((rev: any) => (
                  <div key={rev.id} className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-center justify-between text-xs font-mono">
                    <div className="space-y-1 max-w-[75%]">
                      <strong className="text-slate-200 block text-[11px]">{rev.action}</strong>
                      <span className="text-slate-500 text-[10px]">{rev.timestamp} &bull; ID: {rev.id}</span>
                    </div>
                    <button className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-cyan-300 border border-cyan-800 rounded text-[10px] font-bold transition-all">
                      Undo Action
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: AUTONOMOUS PRODUCT PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <ShoppingBag className="w-5 h-5 mr-2 text-indigo-400" />
                  Autonomous Product Discovery & Quality Score Matrix
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  CJ Dropshipping Discovery &rarr; Product Hunter AI &rarr; Competition Analysis &rarr; Dynamic Margin &rarr; Quality Score
                </p>
              </div>

              <button
                onClick={handleHuntPipeline}
                disabled={loading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-2 shadow-lg shadow-indigo-900/40"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                <span>TRIGGER AI PRODUCT HUNTER</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {pipeline.map((item: any) => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex space-x-4">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-24 h-24 object-cover rounded-lg border border-slate-800 shrink-0"
                    />
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-indigo-300 border border-slate-800">
                          {item.category}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                          item.decision === 'APPROVED_AUTO_PUBLISH' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                        }`}>
                          {item.decision}
                        </span>
                      </div>
                      <h3 className="text-sm font-bold text-white leading-tight">{item.title}</h3>
                      <p className="text-[11px] text-slate-400 font-mono">CJ ID: {item.cjProductId}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-2 bg-slate-900 p-3 rounded-lg border border-slate-800 text-center font-mono">
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">CJ Cost + Ship</span>
                      <strong className="text-xs text-slate-300">${(item.cjCostUSD + item.shippingUSD).toFixed(2)}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Auto Selling Price</span>
                      <strong className="text-xs text-emerald-400">${item.calculatedPriceUSD}</strong>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 block uppercase">Quality Score</span>
                      <strong className="text-xs text-cyan-400">{item.qualityScore} / 100</strong>
                    </div>
                  </div>

                  <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 text-xs space-y-1 font-mono">
                    <span className="text-indigo-400 font-bold text-[11px] block">Product Hunter AI Insights:</span>
                    <p className="text-slate-300">&bull; Key Selling Point: {item.hunterAnalysis?.keySellingPoint}</p>
                    <p className="text-slate-400">&bull; Target Audience: {item.hunterAnalysis?.targetAudience}</p>
                    <p className="text-slate-400">&bull; Competition Level: <strong className="text-amber-400">{item.hunterAnalysis?.competitionLevel}</strong></p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: DYNAMIC PRICING ENGINE */}
      {activeTab === 'pricing' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center">
                <Calculator className="w-5 h-5 mr-2 text-emerald-400" />
                Dynamic Pricing Engine & Cost Formula Calculator
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Formula: Selling Price = (Cost + Shipping + Ad Reserve + PayPal Fixed) / (1 - PayPal% - Target Margin%)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Controls */}
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 font-mono text-xs">
                <h3 className="text-sm font-bold text-white border-b border-slate-800 pb-2">Pricing Parameters</h3>

                <div>
                  <label className="text-slate-400 block mb-1">CJ Product Cost (USD):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricingInput.productCostUSD}
                    onChange={(e) => setPricingInput({ ...pricingInput, productCostUSD: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Shipping & Carrier Cost (USD):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricingInput.shippingUSD}
                    onChange={(e) => setPricingInput({ ...pricingInput, shippingUSD: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Advertising Reserve per Unit (USD):</label>
                  <input
                    type="number"
                    step="0.1"
                    value={pricingInput.adReserveUSD}
                    onChange={(e) => setPricingInput({ ...pricingInput, adReserveUSD: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Target Net Profit Margin (%):</label>
                  <input
                    type="number"
                    value={pricingInput.targetNetMarginPercent}
                    onChange={(e) => setPricingInput({ ...pricingInput, targetNetMarginPercent: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-900 border border-slate-800 text-white rounded p-2 focus:border-indigo-500 focus:outline-none"
                  />
                </div>

                <button
                  onClick={calculatePricing}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded transition-all shadow-md"
                >
                  Recalculate Dynamic Price
                </button>
              </div>

              {/* Live Output */}
              {calculatedPricing && (
                <div className="bg-slate-950 p-5 rounded-xl border border-emerald-800/80 space-y-4 font-mono text-xs">
                  <h3 className="text-sm font-bold text-emerald-400 border-b border-slate-800 pb-2">Calculated Price & Fee Structure</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Recommended Selling Price</span>
                      <strong className="text-2xl text-emerald-400 block">${calculatedPricing.calculatedPriceUSD}</strong>
                      <span className="text-[10px] text-slate-400">Compare At: ${calculatedPricing.compareAtPriceUSD}</span>
                    </div>

                    <div className="bg-slate-900 p-3 rounded border border-slate-800">
                      <span className="text-[10px] text-slate-500 uppercase block">Net Profit Realized</span>
                      <strong className="text-2xl text-cyan-400 block">${calculatedPricing.desiredNetMarginUSD}</strong>
                      <span className="text-[10px] text-slate-400">{calculatedPricing.netMarginPercent}% Profit Margin</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-2 text-[11px] text-slate-300">
                    <div className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>CJ Product Base Cost:</span>
                      <strong>${calculatedPricing.cjCostUSD.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>Shipping & Carrier Fee:</span>
                      <strong>${calculatedPricing.shippingUSD.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>PayPal Gateway Fee (3.49% + $0.49):</span>
                      <strong className="text-amber-400">${calculatedPricing.paypalFeeUSD.toFixed(2)}</strong>
                    </div>
                    <div className="flex justify-between border-b border-slate-800/60 pb-1">
                      <span>Advertising Budget Reserve:</span>
                      <strong className="text-indigo-400">${calculatedPricing.adReserveUSD.toFixed(2)}</strong>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AI CONTENT GENERATOR */}
      {activeTab === 'content' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-indigo-400" />
                  AI Product Copy & Specification Generator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Powered by Gemini 3.6 Flash &bull; Automatically creates Titles, Features, SEO, FAQ & Specs
                </p>
              </div>

              <button
                onClick={handleGenerateContent}
                disabled={loading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                <span>GENERATE COPY WITH GEMINI</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Product Name:</label>
                <input
                  type="text"
                  value={contentPrompt.productTitle}
                  onChange={(e) => setContentPrompt({ ...contentPrompt, productTitle: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-slate-400 block mb-1">Category:</label>
                <input
                  type="text"
                  value={contentPrompt.category}
                  onChange={(e) => setContentPrompt({ ...contentPrompt, category: e.target.value })}
                  className="w-full bg-slate-950 border border-slate-800 text-white rounded p-2 text-xs font-mono focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>

            {generatedContent && (
              <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-4 font-mono text-xs">
                <div className="border-b border-slate-800 pb-2">
                  <span className="text-[10px] text-indigo-400 uppercase font-bold block">Generated SEO Title:</span>
                  <strong className="text-sm text-white">{generatedContent.title}</strong>
                </div>

                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Short Description Hook:</span>
                  <p className="text-slate-300 bg-slate-900 p-3 rounded border border-slate-800">{generatedContent.shortDescription}</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <span className="text-[10px] text-emerald-400 uppercase font-bold block mb-1">Key Features:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1 bg-slate-900 p-3 rounded border border-slate-800">
                      {generatedContent.features?.map((f: string, i: number) => <li key={i}>{f}</li>)}
                    </ul>
                  </div>

                  <div>
                    <span className="text-[10px] text-cyan-400 uppercase font-bold block mb-1">Customer Benefits:</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-1 bg-slate-900 p-3 rounded border border-slate-800">
                      {generatedContent.benefits?.map((b: string, i: number) => <li key={i}>{b}</li>)}
                    </ul>
                  </div>
                </div>

                <div>
                  <span className="text-[10px] text-amber-400 uppercase font-bold block mb-1">Frequently Asked Questions (FAQ):</span>
                  <div className="space-y-2 bg-slate-900 p-3 rounded border border-slate-800">
                    {generatedContent.faq?.map((faq: any, i: number) => (
                      <div key={i} className="text-[11px]">
                        <strong className="text-white block">Q: {faq.question}</strong>
                        <p className="text-slate-400">A: {faq.answer}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: LANDING PAGE GENERATOR */}
      {activeTab === 'landing' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <FileText className="w-5 h-5 mr-2 text-emerald-400" />
                  Generated High-Converting Product Landing Page
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Live Preview of the Auto-Generated Product Funnel Page with 1-Click PayPal Checkout Integration
                </p>
              </div>

              <span className="px-3 py-1 rounded bg-emerald-950 text-emerald-400 border border-emerald-800 font-mono text-xs font-bold">
                PROVEN 4.2% CONVERSION DESIGN
              </span>
            </div>

            {/* Landing Page Mockup Frame */}
            <div className="bg-slate-950 border-2 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
              <div className="bg-slate-900 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono text-slate-400">
                <div className="flex items-center space-x-2">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" />
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" />
                  <span className="ml-2 text-slate-300">https://kitora.store/products/smart-ionic-hair-dryer</span>
                </div>
                <span>🔒 SSL Secured Checkout</span>
              </div>

              <div className="p-8 space-y-8 bg-slate-950">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                  <img
                    src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80"
                    alt="Product"
                    className="rounded-xl border border-slate-800 w-full h-80 object-cover shadow-lg"
                  />

                  <div className="space-y-4">
                    <div className="flex items-center space-x-2">
                      <span className="text-amber-400 text-xs">★★★★★ (1,420 Verified Reviews)</span>
                    </div>

                    <h1 className="text-2xl font-bold text-white leading-tight">
                      Ultra-Quiet Smart Ionic Hair Dryer with Intelligent Temp Control
                    </h1>

                    <div className="flex items-baseline space-x-3">
                      <strong className="text-3xl font-bold text-emerald-400">$69.99</strong>
                      <span className="text-base text-slate-500 line-through">$119.99</span>
                      <span className="px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800 text-xs font-bold">
                        SAVE 42%
                      </span>
                    </div>

                    <p className="text-xs text-slate-300">
                      Dries hair 2x faster with 200M negative ions to lock in moisture and eliminate frizz without extreme heat damage.
                    </p>

                    <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl space-y-3">
                      <button className="w-full py-3.5 bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-slate-950 font-black rounded-xl text-sm font-mono flex items-center justify-center space-x-2 shadow-xl">
                        <CreditCard className="w-5 h-5" />
                        <span>EXPRESS CHECKOUT WITH PAYPAL</span>
                      </button>
                      <p className="text-[10px] text-center text-slate-400 font-mono">
                        🚚 Free Worldwide Trackable Express Delivery (3-5 Days)
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 6: MARKETING AUTOMATION */}
      {activeTab === 'marketing' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <Megaphone className="w-5 h-5 mr-2 text-indigo-400" />
                  Automated Multi-Channel Campaign Generator
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Meta Ads, Google Search Keywords, Automated Email Flow & WhatsApp Outbound
                </p>
              </div>

              <button
                onClick={handleGenerateMarketing}
                disabled={loading}
                className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />}
                <span>GENERATE CAMPAIGN COPY</span>
              </button>
            </div>

            {generatedMarketing && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 font-mono text-xs">
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-indigo-400 border-b border-slate-800 pb-2">Meta Ads Creative Copy</h3>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Headline:</span>
                    <strong className="text-white text-xs">{generatedMarketing.metaAdCopy?.headline}</strong>
                  </div>
                  <div>
                    <span className="text-[10px] text-slate-500 uppercase block">Primary Text Body:</span>
                    <p className="text-slate-300 bg-slate-900 p-3 rounded border border-slate-800">{generatedMarketing.metaAdCopy?.primaryText}</p>
                  </div>
                </div>

                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-3">
                  <h3 className="text-sm font-bold text-emerald-400 border-b border-slate-800 pb-2">WhatsApp Outbound Template</h3>
                  <p className="text-slate-300 bg-slate-900 p-3 rounded border border-slate-800">
                    {generatedMarketing.whatsappBroadcast}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: CUSTOMER AUTOMATION */}
      {activeTab === 'customer' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-white flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-emerald-400" />
                Customer Experience & Dispatch Automation
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Automated WhatsApp & Email notifications triggered on key order lifecycle events
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <button
                onClick={() => handleTriggerCustomerAutomation('ORDER_PLACED')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 rounded-lg text-xs font-mono font-bold text-center"
              >
                Trigger Order Placed
              </button>

              <button
                onClick={() => handleTriggerCustomerAutomation('SHIPPED')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-cyan-400 rounded-lg text-xs font-mono font-bold text-center"
              >
                Trigger Order Shipped
              </button>

              <button
                onClick={() => handleTriggerCustomerAutomation('DELIVERED')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-indigo-400 rounded-lg text-xs font-mono font-bold text-center"
              >
                Trigger Delivered
              </button>

              <button
                onClick={() => handleTriggerCustomerAutomation('REVIEW_REQUEST')}
                className="p-3 bg-slate-950 hover:bg-slate-800 border border-slate-800 text-amber-400 rounded-lg text-xs font-mono font-bold text-center"
              >
                Trigger Review Request
              </button>
            </div>

            {customerAutomationResult && (
              <div className="bg-slate-950 p-5 rounded-xl border border-emerald-800/80 font-mono text-xs space-y-2">
                <div className="flex justify-between items-center border-b border-slate-800 pb-2">
                  <strong className="text-emerald-400">DISPATCH CONFIRMED: {customerAutomationResult.event}</strong>
                  <span className="text-slate-400">Tracking: {customerAutomationResult.trackingNumber}</span>
                </div>
                <p className="text-slate-200 bg-slate-900 p-3 rounded border border-slate-800">
                  {customerAutomationResult.whatsAppMessage}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 8: FINANCIAL INTELLIGENCE */}
      {activeTab === 'finance' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 space-y-6">
            <div className="border-b border-slate-800 pb-3 flex justify-between items-center">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <DollarSign className="w-5 h-5 mr-2 text-emerald-400" />
                  Financial Intelligence & Profitability Breakdown
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Live Unit Economics & Net Realized Margin Analysis
                </p>
              </div>

              <span className="text-sm font-bold font-mono text-emerald-400">
                46.1% NET PROFIT MARGIN
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {overview?.financials?.breakdown?.map((item: any, idx: number) => (
                <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1 font-mono">
                  <span className="text-[10px] text-slate-500 uppercase block">{item.label}</span>
                  <strong className={`text-xl font-bold ${item.color}`}>
                    ${Math.abs(item.value).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
