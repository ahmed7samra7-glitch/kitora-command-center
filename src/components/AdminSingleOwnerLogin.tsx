import React, { useState, useEffect } from 'react';
import { Shield, Lock, Key, AlertTriangle, LogOut, CheckCircle2, User, AlertCircle, RefreshCw } from 'lucide-react';

interface AdminSingleOwnerLoginProps {
  onLoginSuccess: (ownerEmail: string) => void;
  authenticated: boolean;
  ownerEmail: string;
  onLogout: () => void;
}

export const AdminSingleOwnerLogin: React.FC<AdminSingleOwnerLoginProps> = ({
  onLoginSuccess,
  authenticated,
  ownerEmail,
  onLogout
}) => {
  const [emailInput, setEmailInput] = useState('samraboss@gmail.com');
  const [passwordInput, setPasswordInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [retryAfterSecs, setRetryAfterSecs] = useState<number | null>(null);
  const [securityAudit, setSecurityAudit] = useState<any>(null);
  const [auditLoading, setAuditLoading] = useState(false);

  useEffect(() => {
    fetchSecurityAudit();
  }, []);

  const fetchSecurityAudit = async () => {
    try {
      setAuditLoading(true);
      const res = await fetch('/api/admin/security-audit');
      if (res.ok) {
        const data = await res.json();
        setSecurityAudit(data);
        if (data.ownerEmail) {
          setEmailInput(data.ownerEmail);
        }
      }
    } catch (err) {
      console.error('Failed to fetch security audit:', err);
    } finally {
      setAuditLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setRetryAfterSecs(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput, password: passwordInput })
      });

      const data = await res.json();

      if (res.status === 429) {
        setErrorMsg(data.error);
        setRetryAfterSecs(data.retryAfterSecs || 900);
        return;
      }

      if (!res.ok || !data.success) {
        setErrorMsg(data.error || 'Authentication failed. Access denied.');
        return;
      }

      // Success
      setPasswordInput('');
      onLoginSuccess(data.ownerEmail || emailInput);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Network error attempting login.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmergencyLockdown = async () => {
    if (!window.confirm('EMERGENCY LOCKDOWN WARNING:\n\nAre you sure you want to invalidate ALL active sessions and force immediate logout across all devices?')) {
      return;
    }
    try {
      const res = await fetch('/api/admin/lockdown', { method: 'POST' });
      const data = await res.json();
      alert(data.message || 'Lockdown executed. All sessions invalidated.');
      onLogout();
    } catch (err: any) {
      alert('Error executing lockdown: ' + (err?.message || String(err)));
    }
  };

  if (authenticated) {
    return (
      <div className="bg-slate-900/90 border-b border-indigo-900/50 px-4 py-2 text-xs text-slate-300 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <span className="flex items-center px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800 font-mono font-bold">
            <Shield className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            SINGLE OWNER AUTHENTICATED
          </span>
          <span className="text-slate-400">Owner Identity: <strong className="text-white font-mono">{ownerEmail || 'samraboss@gmail.com'}</strong></span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-400">Public Registration: <strong className="text-rose-400 font-mono">PERMANENTLY DISABLED</strong></span>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleEmergencyLockdown}
            className="px-2.5 py-1 bg-rose-950 hover:bg-rose-900 text-rose-300 border border-rose-800 rounded font-semibold transition flex items-center"
            title="Invalidate all sessions immediately"
          >
            <AlertTriangle className="w-3 h-3 mr-1 text-rose-400" />
            Emergency Lockdown
          </button>
          <button
            onClick={onLogout}
            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded transition flex items-center"
          >
            <LogOut className="w-3 h-3 mr-1" />
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-indigo-900/80 rounded-2xl p-6 shadow-2xl shadow-indigo-950/50 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex p-3 rounded-2xl bg-indigo-950 text-indigo-400 border border-indigo-800/80 mb-1">
            <Shield className="w-8 h-8 text-cyan-400" />
          </div>
          <h2 className="text-xl font-bold text-white tracking-tight font-mono">
            KITORA SINGLE OWNER ACCESS
          </h2>
          <p className="text-xs text-slate-400">
            This platform operates under strict Single Owner policy. Public registration and multiple administrator accounts are permanently disabled.
          </p>
        </div>

        {/* Security Audit Badge */}
        {securityAudit && (
          <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-[11px] space-y-1.5 font-mono">
            <div className="flex items-center justify-between text-slate-300">
              <span>Owner Email:</span>
              <span className="text-cyan-300 font-bold">{securityAudit.ownerEmail}</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Registration Status:</span>
              <span className="text-rose-400 font-bold">DISABLED (Single Owner Only)</span>
            </div>
            <div className="flex items-center justify-between text-slate-400">
              <span>Security Controls:</span>
              <span className="text-emerald-400 font-bold">Bcrypt + JWT + Helmet + RateLimiting Active</span>
            </div>
          </div>
        )}

        {/* Error / Rate Limit Alert */}
        {errorMsg && (
          <div className="bg-rose-950/80 border border-rose-800 text-rose-200 text-xs p-3 rounded-xl flex items-start space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">{errorMsg}</p>
              {retryAfterSecs && (
                <p className="text-[11px] text-rose-300 mt-1">
                  Try again in {Math.ceil(retryAfterSecs / 60)} minutes ({retryAfterSecs} seconds).
                </p>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Administrator Email
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
                placeholder="samraboss@gmail.com"
              />
            </div>
            <p className="text-[10px] text-slate-500 mt-1">
              Only the single configured email above is permitted to authenticate.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">
              Owner Security Password
            </label>
            <div className="relative">
              <Key className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
              <input
                type="password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-800 rounded-xl py-2.5 pl-9 pr-3 text-sm text-white focus:outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 font-mono"
                placeholder="••••••••••••"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-gradient-to-r from-cyan-600 via-indigo-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-indigo-950/60 transition flex items-center justify-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-white" />
                <span>Verifying Owner Credentials...</span>
              </>
            ) : (
              <>
                <Lock className="w-4 h-4 text-white" />
                <span>Unlock Single Owner Dashboard</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center text-[10px] text-slate-500 pt-2 border-t border-slate-800/60 space-y-1">
          <p>KITORA Command Center • Single Owner Security System</p>
          <p className="text-slate-600">Owner transfer enabled strictly via environment variables (ADMIN_EMAIL & ADMIN_PASSWORD_HASH).</p>
        </div>
      </div>
    </div>
  );
};
