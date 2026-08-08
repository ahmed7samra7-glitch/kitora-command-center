import React, { useState, useEffect } from 'react';
import { 
  Zap, 
  CreditCard, 
  ShoppingBag, 
  Clock, 
  Radio, 
  Database, 
  Play, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  ArrowRight, 
  Package, 
  Truck, 
  Activity, 
  ShieldCheck, 
  DollarSign, 
  Server, 
  Terminal,
  Send,
  Sliders,
  Sparkles
} from 'lucide-react';

export const Phase3OperationsDashboard: React.FC<{ onRefreshData?: () => void }> = ({ onRefreshData }) => {
  const [activeSubTab, setActiveSubTab] = useState<'e2e' | 'paypal' | 'cj' | 'scheduler' | 'eventbus' | 'db'>('e2e');
  const [loading, setLoading] = useState(false);

  // States
  const [paypalHealth, setPaypalHealth] = useState<any>(null);
  const [paypalOrders, setPaypalOrders] = useState<any[]>([]);
  const [cjHealth, setCjHealth] = useState<any>(null);
  const [cjProducts, setCjProducts] = useState<any[]>([]);
  const [cjOrders, setCjOrders] = useState<any[]>([]);
  const [schedulerJobs, setSchedulerJobs] = useState<any[]>([]);
  const [eventLogs, setEventLogs] = useState<any[]>([]);
  const [e2eResult, setE2eResult] = useState<any>(null);

  // Form states
  const [ppAmount, setPpAmount] = useState('89.99');
  const [ppDesc, setPpDesc] = useState('AI Earbuds Order');
  const [cjSearchKey, setCjSearchKey] = useState('smart');

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [ppHealthRes, ppOrdersRes, cjHealthRes, cjProdsRes, cjOrdersRes, jobsRes, eventsRes] = await Promise.all([
        fetch('/api/paypal/health').then(r => r.json()).catch(() => null),
        fetch('/api/paypal/orders').then(r => r.json()).catch(() => null),
        fetch('/api/cj-dropshipping/health').then(r => r.json()).catch(() => null),
        fetch('/api/cj-dropshipping/products').then(r => r.json()).catch(() => null),
        fetch('/api/cj-dropshipping/orders').then(r => r.json()).catch(() => null),
        fetch('/api/scheduler/jobs').then(r => r.json()).catch(() => null),
        fetch('/api/event-bus/history').then(r => r.json()).catch(() => null)
      ]);

      if (ppHealthRes?.health) setPaypalHealth(ppHealthRes.health);
      if (ppOrdersRes?.orders) setPaypalOrders(ppOrdersRes.orders);
      if (cjHealthRes?.health) setCjHealth(cjHealthRes.health);
      if (cjProdsRes?.products) setCjProducts(cjProdsRes.products);
      if (cjOrdersRes?.orders) setCjOrders(cjOrdersRes.orders);
      if (jobsRes?.jobs) setSchedulerJobs(jobsRes.jobs);
      if (eventsRes?.events) setEventLogs(eventsRes.events);
    } catch (err) {
      console.error('Error fetching Phase 3 operational data:', err);
    } finally {
      setLoading(false);
      if (onRefreshData) onRefreshData();
    }
  };

  // 1. E2E Workflow Execution
  const handleExecuteE2EWorkflow = async () => {
    setLoading(true);
    setE2eResult(null);
    try {
      const res = await fetch('/api/e2e/workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(ppAmount),
          productName: 'Earbuds',
          customerName: 'Executive CTO Sandbox User'
        })
      });
      const data = await res.json();
      setE2eResult(data);
      fetchAllData();
    } catch (err: any) {
      alert(`E2E Workflow Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 2. PayPal Handlers
  const handleCreatePayPalOrder = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/paypal/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: parseFloat(ppAmount),
          currency: 'USD',
          description: ppDesc
        })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      }
    } catch (err: any) {
      alert(`PayPal Order Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleCapturePayPalOrder = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/paypal/orders/${orderId}/capture`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      }
    } catch (err: any) {
      alert(`PayPal Capture Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. CJ Handlers
  const handleSyncCJProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/cj-dropshipping/products/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: cjSearchKey, limit: 10 })
      });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      }
    } catch (err: any) {
      alert(`CJ Sync Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAdvanceCJTracking = async (orderId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/cj-dropshipping/orders/${orderId}/tracking`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        fetchAllData();
      }
    } catch (err: any) {
      alert(`CJ Tracking Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  // 4. Scheduler Handlers
  const handleTriggerJob = async (jobId: string) => {
    setLoading(true);
    try {
      await fetch(`/api/scheduler/jobs/${jobId}/trigger`, { method: 'POST' });
      fetchAllData();
    } catch (err: any) {
      alert(`Trigger Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleJob = async (jobId: string, currentEnabled: boolean) => {
    setLoading(true);
    try {
      await fetch(`/api/scheduler/jobs/${jobId}/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !currentEnabled })
      });
      fetchAllData();
    } catch (err: any) {
      alert(`Toggle Error: ${err?.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Zap className="w-56 h-56 text-cyan-400" />
        </div>

        <div className="relative z-10 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <span className="p-2.5 bg-cyan-950 text-cyan-400 border border-cyan-800 rounded-xl">
                <Zap className="w-7 h-7" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-white font-mono flex items-center">
                  PHASE 3 AUTONOMOUS OPERATIONS COMMAND CENTER
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  Live Payment, Sourcing, Scheduler, Event Bus, and End-to-End Fulfillment Runtimes
                </p>
              </div>
            </div>

            <button
              onClick={fetchAllData}
              disabled={loading}
              className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 text-cyan-300 border border-slate-800 rounded-lg text-xs font-mono font-bold transition-all flex items-center space-x-2"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              <span>Refresh Operations</span>
            </button>
          </div>

          <div className="pt-2 flex flex-wrap gap-3">
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-500">PayPal Runtime:</span>{' '}
              <strong className="text-emerald-400 font-mono">
                {paypalHealth?.pingSuccess ? `HEALTHY (${paypalHealth?.mode.toUpperCase()})` : 'INITIALIZING'}
              </strong>
            </div>
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-500">CJ Dropshipping:</span>{' '}
              <strong className="text-cyan-400 font-mono">
                {cjHealth?.syncedProductsCount} Products Synced
              </strong>
            </div>
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-500">Active Jobs:</span>{' '}
              <strong className="text-indigo-400 font-mono">
                {schedulerJobs.filter(j => j.enabled).length}/{schedulerJobs.length} Running
              </strong>
            </div>
            <div className="px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs">
              <span className="text-slate-500">Bus Events:</span>{' '}
              <strong className="text-amber-400 font-mono">
                {eventLogs.length} Streamed
              </strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sub-Navigation Tabs */}
      <div className="flex border-b border-slate-800 space-x-2 overflow-x-auto pb-1 scrollbar-none">
        <button
          onClick={() => setActiveSubTab('e2e')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'e2e'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>1. E2E Autonomous Workflow</span>
        </button>

        <button
          onClick={() => setActiveSubTab('paypal')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'paypal'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          <span>2. Real PayPal Runtime</span>
        </button>

        <button
          onClick={() => setActiveSubTab('cj')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'cj'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>3. Real CJ Dropshipping Runtime</span>
        </button>

        <button
          onClick={() => setActiveSubTab('scheduler')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'scheduler'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Clock className="w-4 h-4" />
          <span>4. Persistent Scheduler & Retry</span>
        </button>

        <button
          onClick={() => setActiveSubTab('eventbus')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-2 whitespace-nowrap ${
            activeSubTab === 'eventbus'
              ? 'bg-cyan-600 text-white shadow-md shadow-cyan-900/50'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800'
          }`}
        >
          <Radio className="w-4 h-4" />
          <span>5. Internal Event Bus</span>
        </button>
      </div>

      {/* SUB-TAB CONTENT PANELS */}

      {/* 1. END-TO-END AUTONOMOUS WORKFLOW */}
      {activeSubTab === 'e2e' && (
        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-bold text-white flex items-center">
                  <Sparkles className="w-5 h-5 mr-2 text-cyan-400" />
                  Execute Full End-to-End Autonomous E-Commerce Workflow
                </h2>
                <p className="text-xs text-slate-400 mt-1">
                  Triggers synchronized multi-step execution: Catalog Sourcing → PayPal Order Creation → Capture Payment → CJ Dropshipping Submission → Tracking Sync → Immutable Audit Logging.
                </p>
              </div>

              <button
                onClick={handleExecuteE2EWorkflow}
                disabled={loading}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-600 to-indigo-600 hover:from-cyan-500 hover:to-indigo-500 text-white rounded-lg text-xs font-bold font-mono transition-all flex items-center space-x-2 shadow-lg shadow-cyan-900/40"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                <span>EXECUTE COMPLETE E2E CYCLE NOW</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase font-mono block">Step 1: Product Sourcing</span>
                <p className="text-xs text-slate-300">Automated query to CJ Dropshipping catalog for high-margin smart gadgets (Margin target: &ge; 40%).</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase font-mono block">Step 2: PayPal Payment</span>
                <p className="text-xs text-slate-300">Generates checkout order and executes immediate capture via real PayPal OAuth2 API runtime.</p>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 space-y-2">
                <span className="text-xs font-bold text-slate-400 uppercase font-mono block">Step 3: Supplier Fulfillment</span>
                <p className="text-xs text-slate-300">Submits automated fulfillment request to CJ Dropshipping and attaches tracking sync listener.</p>
              </div>
            </div>

            {e2eResult && (
              <div className="mt-6 bg-slate-950 border border-cyan-800 rounded-xl p-5 space-y-4 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <span className="text-xs font-bold text-emerald-400 flex items-center">
                    <CheckCircle2 className="w-4 h-4 mr-2 text-emerald-400" />
                    E2E AUTONOMOUS WORKFLOW COMPLETED SUCCESSFULLY
                  </span>
                  <span className="text-xs text-slate-400">Trace ID: {e2eResult.traceId}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="bg-slate-900 p-3 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">Selected Product:</span>
                    <strong className="text-white block truncate">{e2eResult.product?.productName}</strong>
                    <span className="text-cyan-400">Cost: ${e2eResult.product?.costPrice} / Sell: ${e2eResult.product?.sellPrice}</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">PayPal Capture Record:</span>
                    <strong className="text-emerald-400 block">{e2eResult.paypalOrder?.id}</strong>
                    <span className="text-slate-300">Amount: ${e2eResult.paypalOrder?.amount} USD ({e2eResult.paypalOrder?.status})</span>
                  </div>

                  <div className="bg-slate-900 p-3 rounded border border-slate-800">
                    <span className="text-slate-500 block text-[10px] uppercase">CJ Fulfillment Order:</span>
                    <strong className="text-cyan-400 block">{e2eResult.cjOrder?.cjOrderId}</strong>
                    <span className="text-amber-300">Tracking: {e2eResult.cjOrder?.trackingNumber}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. REAL PAYPAL RUNTIME */}
      {activeSubTab === 'paypal' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Create Order Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 md:col-span-1">
              <h3 className="text-sm font-bold text-white flex items-center">
                <CreditCard className="w-4 h-4 mr-2 text-cyan-400" />
                Dispatch Live PayPal Order
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Order Amount ($ USD)</label>
                  <input
                    type="number"
                    value={ppAmount}
                    onChange={e => setPpAmount(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-slate-400 block mb-1">Description</label>
                  <input
                    type="text"
                    value={ppDesc}
                    onChange={e => setPpDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white"
                  />
                </div>

                <button
                  onClick={handleCreatePayPalOrder}
                  disabled={loading}
                  className="w-full py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded font-bold transition-all flex items-center justify-center space-x-1"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Create PayPal Checkout Order</span>
                </button>
              </div>
            </div>

            {/* Orders Stream */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 md:col-span-2">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <h3 className="text-sm font-bold text-white">Active PayPal Order Records ({paypalOrders.length})</h3>
                <span className="text-xs font-mono text-cyan-400">API Runtime: /v2/checkout/orders</span>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                {paypalOrders.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No PayPal orders generated yet.</p>
                ) : (
                  paypalOrders.map(order => (
                    <div key={order.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 flex items-center justify-between text-xs font-mono">
                      <div className="space-y-0.5">
                        <div className="flex items-center space-x-2">
                          <strong className="text-white">{order.id}</strong>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            order.status === 'COMPLETED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                        <p className="text-slate-400 font-sans text-[11px]">{order.description} &bull; ${order.amount} {order.currency}</p>
                      </div>

                      {order.status !== 'COMPLETED' && (
                        <button
                          onClick={() => handleCapturePayPalOrder(order.id)}
                          className="px-2.5 py-1 bg-emerald-950 hover:bg-emerald-900 text-emerald-300 border border-emerald-800 rounded text-[11px] font-bold transition-all"
                        >
                          Capture Payment
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. REAL CJ DROPSHIPPING RUNTIME */}
      {activeSubTab === 'cj' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Catalog Sync Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 md:col-span-1">
              <h3 className="text-sm font-bold text-white flex items-center">
                <ShoppingBag className="w-4 h-4 mr-2 text-cyan-400" />
                CJ Product Catalog Sync
              </h3>

              <div className="space-y-3 text-xs">
                <div>
                  <label className="text-slate-400 block mb-1">Search Keyword</label>
                  <input
                    type="text"
                    value={cjSearchKey}
                    onChange={e => setCjSearchKey(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded px-3 py-2 text-white font-mono"
                  />
                </div>

                <button
                  onClick={handleSyncCJProducts}
                  disabled={loading}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded font-bold transition-all flex items-center justify-center space-x-1"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Catalog from CJ API</span>
                </button>
              </div>
            </div>

            {/* Synced Products Catalog */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-md space-y-4 md:col-span-2">
              <h3 className="text-sm font-bold text-white">Synced Product Catalog ({cjProducts.length})</h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-1">
                {cjProducts.map(prod => (
                  <div key={prod.pid} className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex space-x-3 text-xs">
                    <img src={prod.productImage} alt={prod.productName} className="w-14 h-14 object-cover rounded border border-slate-800" />
                    <div className="space-y-1 min-w-0">
                      <strong className="text-white block truncate">{prod.productName}</strong>
                      <p className="text-slate-400 font-mono text-[10px]">SKU: {prod.productSku}</p>
                      <div className="flex items-center space-x-2 text-[11px] font-mono">
                        <span className="text-emerald-400 font-bold">Sell: ${prod.sellPrice}</span>
                        <span className="text-slate-400">Cost: ${prod.costPrice}</span>
                        <span className="text-cyan-300 font-bold">({prod.netMarginPercentage}% Margin)</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. PERSISTENT SCHEDULER & RETRY ENGINE */}
      {activeSubTab === 'scheduler' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center">
              <Clock className="w-5 h-5 mr-2 text-cyan-400" />
              Persistent Background Scheduler & Exponential Retry Engine
            </h2>
            <span className="text-xs text-slate-400 font-mono">Interval Loop: 10s Active Tick</span>
          </div>

          <div className="space-y-3">
            {schedulerJobs.map(job => (
              <div key={job.id} className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs font-mono">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <strong className="text-white text-sm font-sans">{job.name}</strong>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      job.enabled ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                    }`}>
                      {job.enabled ? 'ACTIVE' : 'PAUSED'}
                    </span>
                  </div>
                  <p className="text-slate-400 font-sans">{job.id} &bull; Cron: {job.cronExpression} &bull; Next Run: {new Date(job.nextRunAt).toLocaleTimeString()}</p>
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => handleTriggerJob(job.id)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-cyan-950 hover:bg-cyan-900 text-cyan-300 border border-cyan-800 rounded font-bold transition-all flex items-center space-x-1"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    <span>Run Now</span>
                  </button>

                  <button
                    onClick={() => handleToggleJob(job.id, job.enabled)}
                    disabled={loading}
                    className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 rounded transition-all"
                  >
                    {job.enabled ? 'Pause' : 'Enable'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. INTERNAL EVENT BUS */}
      {activeSubTab === 'eventbus' && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-md space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h2 className="text-base font-bold text-white flex items-center">
              <Radio className="w-5 h-5 mr-2 text-cyan-400" />
              Internal Event Bus Live Message Stream ({eventLogs.length})
            </h2>
            <span className="text-xs text-slate-400 font-mono">Pub/Sub Topic Router</span>
          </div>

          <div className="space-y-2 max-h-96 overflow-y-auto pr-1 font-mono text-xs">
            {eventLogs.map(evt => (
              <div key={evt.id} className="bg-slate-950 p-3 rounded-lg border border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 bg-cyan-950 text-cyan-300 border border-cyan-800 rounded font-bold">
                    {evt.topic}
                  </span>
                  <span className="text-slate-500 text-[10px]">{evt.timestamp} &bull; Trace: {evt.traceId}</span>
                </div>
                <p className="text-slate-300 font-sans text-xs">Source: <strong className="text-white">{evt.source}</strong></p>
                <pre className="text-[10px] text-slate-400 overflow-x-auto bg-slate-900/50 p-2 rounded border border-slate-800/50">
                  {JSON.stringify(evt.payload, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
