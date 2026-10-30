import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { Sparkles, CheckCircle2, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';

interface AIHealthState {
  geminiKeyPresent: boolean;
  firestoreAdminOk: boolean;
  model: string;
  status: 'healthy' | 'degraded' | 'error';
  reason: string;
}

export const AIStatusRow: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const [health, setHealth] = useState<AIHealthState | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getAIHealth();
      setHealth(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to inspect AI engine status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  const getStatusBadge = () => {
    if (loading && !health) {
      return (
        <span className="flex items-center space-x-1 text-xs text-[#6B7470]">
          <RefreshCw className="w-3 h-3 animate-spin text-[#087F68]" />
          <span>Checking AI...</span>
        </span>
      );
    }

    if (error || !health) {
      return (
        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#C83C4B]">
          <XCircle className="w-3.5 h-3.5" />
          <span>Offline</span>
        </div>
      );
    }

    if (!health.geminiKeyPresent || health.status === 'error') {
      return (
        <div className="flex items-center space-x-1.5 text-xs font-bold text-[#C83C4B]">
          <XCircle className="w-3.5 h-3.5" />
          <span>Gemini Key Missing</span>
        </div>
      );
    }

    if (health.status === 'degraded' || !health.firestoreAdminOk) {
      return (
        <div className="flex items-center space-x-1.5 text-xs font-bold text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3.5 h-3.5" />
          <span>Degraded (Fallback Active)</span>
        </div>
      );
    }

    return (
      <div className="flex items-center space-x-1.5 text-xs font-bold text-[#087F68] dark:text-[#38D6AB]">
        <CheckCircle2 className="w-3.5 h-3.5" />
        <span>Operational ({health.model})</span>
      </div>
    );
  };

  const getExplanation = () => {
    if (error) return error;
    if (!health) return 'Checking server-side Gemini & Firestore connection...';
    if (!health.geminiKeyPresent) {
      return 'Gemini key missing on server. AI message generator will serve instant template fallbacks.';
    }
    if (!health.firestoreAdminOk) {
      return 'Admin SDK access to named database restricted. In-memory rate limiting and quota fallbacks are active.';
    }
    return `Gemini API connected (${health.model}) with best-effort quota tracking and in-memory rate limits.`;
  };

  if (compact) {
    return (
      <div className="flex items-center justify-between py-2 text-xs">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-3.5 h-3.5 text-[#087F68]" />
          <span className="font-semibold text-[#18211F] dark:text-white">AI Engine</span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            title="Refresh AI Status"
            className="p-1 text-[#6B7470] hover:text-[#18211F] dark:hover:text-white transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 bg-[#FAFBFA] dark:bg-[#1E2825] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 rounded-lg bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <span className="font-bold text-xs text-[#18211F] dark:text-white">
            AI Service Status
          </span>
        </div>
        <div className="flex items-center space-x-2">
          {getStatusBadge()}
          <button
            type="button"
            onClick={fetchHealth}
            disabled={loading}
            title="Refresh AI Status"
            className="p-1 rounded-lg text-[#6B7470] hover:text-[#18211F] dark:hover:text-white hover:bg-[#F2F4F2] dark:hover:bg-[#202A27] transition cursor-pointer"
          >
            <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>
      <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] leading-relaxed">
        {getExplanation()}
      </p>
    </div>
  );
};
