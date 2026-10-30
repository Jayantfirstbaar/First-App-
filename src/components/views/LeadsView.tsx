import React, { useState, useMemo, useEffect } from 'react';
import { Lead, LeadStage } from '../../types';
import { formatINR, validateAndCleanIndianPhone, categorizeFollowUp, generateLeadsCsv, calculateLeadScore } from '../../utils/calculations';
import {
  Search,
  Filter,
  Plus,
  Phone,
  MessageSquare,
  Clock,
  Sparkles,
  ArrowUpDown,
  Building,
  X,
  History,
  FileCheck,
  Handshake,
  Trophy,
  Sparkle,
  Download,
  FileSpreadsheet,
  Check,
  ChevronRight,
  LayoutGrid,
  List,
  CheckSquare,
  Square,
  Trash2,
  Tag,
  Zap,
} from 'lucide-react';

interface LeadsViewProps {
  leads: Lead[];
  onOpenAddLead: () => void;
  onSelectLead: (lead: Lead) => void;
  onOpenAIMessage: (lead: Lead) => void;
  onUpdateLeadStage?: (leadId: string, newStage: LeadStage) => Promise<void>;
  onBulkDeleteLeads?: (leadIds: string[]) => Promise<void>;
  onBulkUpdateStage?: (leadIds: string[], newStage: LeadStage) => Promise<void>;
}

const RECENT_SEARCHES_KEY = 'quoteback_leads_recent_searches';

export const getStageIndicatorConfig = (stage: LeadStage | string) => {
  switch (stage) {
    case 'New':
      return {
        dotClass: 'bg-blue-500 ring-2 ring-blue-100 dark:ring-blue-900/40',
        badgeClass: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
        label: 'New',
        tooltip: 'New Enquiry (Blue)',
      };
    case 'Negotiation':
      return {
        dotClass: 'bg-amber-500 ring-2 ring-amber-100 dark:ring-amber-900/40',
        badgeClass: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
        label: 'Negotiation',
        tooltip: 'In Negotiation (Amber)',
      };
    case 'Won':
      return {
        dotClass: 'bg-[#087F68] ring-2 ring-[#CBE7DC] dark:ring-[#087F68]/30',
        badgeClass: 'bg-[#E8F5EF] text-[#087F68] border-[#CBE7DC] dark:bg-[#087F68]/20 dark:text-[#38D6AB] dark:border-[#087F68]/30',
        label: 'Won',
        tooltip: 'Deal Won (Green)',
      };
    case 'Quotation Sent':
      return {
        dotClass: 'bg-orange-500 ring-2 ring-orange-100 dark:ring-orange-900/40',
        badgeClass: 'bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800/40',
        label: 'Quotation Sent',
        tooltip: 'Quote Sent (Orange)',
      };
    case 'Site Visit Scheduled':
      return {
        dotClass: 'bg-teal-500 ring-2 ring-teal-100 dark:ring-teal-900/40',
        badgeClass: 'bg-teal-50 text-teal-700 border-teal-200 dark:bg-teal-950/40 dark:text-teal-300 dark:border-teal-800/40',
        label: 'Site Visit',
        tooltip: 'Site Visit Scheduled (Teal)',
      };
    case 'Contacted':
      return {
        dotClass: 'bg-indigo-500 ring-2 ring-indigo-100 dark:ring-indigo-900/40',
        badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/40 dark:text-indigo-300 dark:border-indigo-800/40',
        label: 'Contacted',
        tooltip: 'Contacted (Indigo)',
      };
    case 'Lost':
      return {
        dotClass: 'bg-[#C83C4B] ring-2 ring-red-100 dark:ring-red-900/40',
        badgeClass: 'bg-[#FDF2F3] text-[#C83C4B] border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40',
        label: 'Lost',
        tooltip: 'Deal Lost (Red)',
      };
    default:
      return {
        dotClass: 'bg-gray-400 ring-2 ring-gray-100 dark:ring-gray-800',
        badgeClass: 'bg-[#F2F4F2] text-[#6B7470] border-gray-200 dark:bg-[#202A27] dark:text-[#A1ACA6]',
        label: stage || 'Unknown',
        tooltip: stage || 'Unknown',
      };
  }
};

export const LeadsView: React.FC<LeadsViewProps> = ({
  leads,
  onOpenAddLead,
  onSelectLead,
  onOpenAIMessage,
  onUpdateLeadStage,
  onBulkDeleteLeads,
  onBulkUpdateStage,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'followUp' | 'value' | 'recent' | 'name' | 'score'>('score');
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [bulkStageTarget, setBulkStageTarget] = useState<LeadStage>('Negotiation');

  const handleToggleSelectAll = () => {
    if (selectedLeadIds.length === filteredLeads.length) {
      setSelectedLeadIds([]);
    } else {
      setSelectedLeadIds(filteredLeads.map(l => l.id));
    }
  };

  const handleToggleSelectLead = (leadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedLeadIds(prev =>
      prev.includes(leadId) ? prev.filter(id => id !== leadId) : [...prev, leadId]
    );
  };

  const handleBulkStageChange = async (targetStage: LeadStage) => {
    if (onBulkUpdateStage && selectedLeadIds.length > 0) {
      await onBulkUpdateStage(selectedLeadIds, targetStage);
      setSelectedLeadIds([]);
    }
  };

  const handleBulkDelete = async () => {
    if (onBulkDeleteLeads && selectedLeadIds.length > 0) {
      if (window.confirm(`Delete ${selectedLeadIds.length} selected leads?`)) {
        await onBulkDeleteLeads(selectedLeadIds);
        setSelectedLeadIds([]);
      }
    }
  };

  const getPriorityBadgeClass = (priority?: string) => {
    switch (priority) {
      case 'High':
        return 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800/40';
      case 'Low':
        return 'bg-green-50 text-green-700 border-green-200 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/40';
      case 'Medium':
      default:
        return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
    }
  };
  
  // Search history: remembers the user's last 3 search queries
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed.slice(0, 3);
        }
      }
    } catch {
      // fallback
    }
    return ['Modular Kitchen', 'Interior', 'Sharma'];
  });

  const saveSearchQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;
    setRecentSearches(prev => {
      const filtered = prev.filter(q => q.toLowerCase() !== trimmed.toLowerCase());
      const next = [trimmed, ...filtered].slice(0, 3);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const removeSearchQuery = (queryToRemove: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setRecentSearches(prev => {
      const next = prev.filter(q => q !== queryToRemove);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveSearchQuery(searchTerm);
    }
  };

  const handleSelectRecentSearch = (query: string) => {
    setSearchTerm(query);
    saveSearchQuery(query);
  };

  // CSV Export state & handler for accounting and tax documentation
  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccess, setExportSuccess] = useState(false);
  const [lastExportedCount, setLastExportedCount] = useState(0);

  const handleExportCsv = (mode: 'current' | 'all' = 'current') => {
    setIsExporting(true);
    try {
      const targets = mode === 'all' || filteredLeads.length === 0 ? leads : filteredLeads;
      const csvContent = generateLeadsCsv(targets as any);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const blobUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      const stageTag = selectedStage !== 'all' && mode === 'current' ? `_${selectedStage.replace(/\s+/g, '_')}` : '';
      const dateTag = new Date().toISOString().split('T')[0];
      a.download = `QuoteBack_Leads_Report${stageTag}_${dateTag}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);

      setLastExportedCount(targets.length);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 15000);
    } catch (err) {
      console.error('Failed to export leads CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const stagesList = ['all', 'New', 'Contacted', 'Site Visit Scheduled', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  // Stage distribution summary statistics
  const stageStats = useMemo(() => {
    const total = leads.length || 1;
    
    const countByStage = (stageName: string) => leads.filter(l => l.stage === stageName).length;
    const valueByStage = (stageName: string) => 
      leads
        .filter(l => l.stage === stageName)
        .reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);

    const newCount = countByStage('New');
    const quotedCount = countByStage('Quotation Sent');
    const negCount = countByStage('Negotiation');
    const wonCount = countByStage('Won');

    const totalPipelineValue = leads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);

    return {
      total: leads.length,
      totalPipelineValue,
      stages: [
        {
          id: 'New',
          label: 'New',
          stageKey: 'New',
          count: newCount,
          percent: Math.round((newCount / total) * 100),
          value: valueByStage('New'),
          color: 'bg-blue-500',
          textColor: 'text-blue-700 dark:text-blue-400',
          barColor: 'bg-blue-500',
          badgeBg: 'bg-blue-50 dark:bg-blue-950/40',
          icon: Sparkle,
        },
        {
          id: 'Quotation Sent',
          label: 'Quoted',
          stageKey: 'Quotation Sent',
          count: quotedCount,
          percent: Math.round((quotedCount / total) * 100),
          value: valueByStage('Quotation Sent'),
          color: 'bg-orange-500',
          textColor: 'text-orange-700 dark:text-orange-400',
          barColor: 'bg-orange-500',
          badgeBg: 'bg-orange-50 dark:bg-orange-950/40',
          icon: FileCheck,
        },
        {
          id: 'Negotiation',
          label: 'Negotiation',
          stageKey: 'Negotiation',
          count: negCount,
          percent: Math.round((negCount / total) * 100),
          value: valueByStage('Negotiation'),
          color: 'bg-amber-500',
          textColor: 'text-amber-700 dark:text-amber-400',
          barColor: 'bg-amber-500',
          badgeBg: 'bg-amber-50 dark:bg-amber-950/40',
          icon: Handshake,
        },
        {
          id: 'Won',
          label: 'Won',
          stageKey: 'Won',
          count: wonCount,
          percent: Math.round((wonCount / total) * 100),
          value: valueByStage('Won'),
          color: 'bg-[#087F68]',
          textColor: 'text-[#087F68] dark:text-[#38D6AB]',
          barColor: 'bg-[#087F68]',
          badgeBg: 'bg-[#E8F5EF] dark:bg-[#087F68]/20',
          icon: Trophy,
        },
      ]
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter(l => {
      const matchSearch =
        l.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.phone.includes(searchTerm) ||
        l.projectType.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (l.notes && l.notes.toLowerCase().includes(searchTerm.toLowerCase()));

      const matchStage = selectedStage === 'all' || l.stage === selectedStage;
      const matchSource = selectedSource === 'all' || l.source === selectedSource;

      return matchSearch && matchStage && matchSource;
    }).sort((a, b) => {
      if (sortBy === 'score') {
        const scoreA = calculateLeadScore(a).score;
        const scoreB = calculateLeadScore(b).score;
        return scoreB - scoreA;
      }
      if (sortBy === 'value') {
        const valA = a.quotationAmount || a.estimatedValue || 0;
        const valB = b.quotationAmount || b.estimatedValue || 0;
        return valB - valA;
      }
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
      if (sortBy === 'name') {
        return a.customerName.localeCompare(b.customerName);
      }
      // Default: sort by next follow-up date (earliest first)
      if (!a.nextFollowUpDate) return 1;
      if (!b.nextFollowUpDate) return -1;
      return a.nextFollowUpDate.localeCompare(b.nextFollowUpDate);
    });
  }, [leads, searchTerm, selectedStage, selectedSource, sortBy]);

  return (
    <div className="p-3.5 sm:p-5 space-y-3.5 max-w-4xl mx-auto overflow-x-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-black text-[#18211F] dark:text-white tracking-tight truncate">
            Leads & Pipeline
          </h1>
          <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
            {filteredLeads.length} of {leads.length} shown • Tax ready
          </p>
        </div>

        <div className="flex items-center space-x-1.5 shrink-0">
          <button
            onClick={() => handleExportCsv('current')}
            disabled={isExporting}
            title="Export current leads to CSV for accounting or tax documentation"
            className="px-2.5 py-1.5 rounded-xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] hover:bg-[#F2F4F2] dark:hover:bg-[#222C29] text-[#18211F] dark:text-[#EAEFEA] font-semibold text-xs shadow-xs flex items-center space-x-1 active:scale-95 transition cursor-pointer"
          >
            {exportSuccess ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#087F68]" />
                <span className="text-[#087F68] font-bold">Exported!</span>
              </>
            ) : (
              <>
                <Download className="w-3.5 h-3.5 text-[#087F68]" />
                <span>Export to CSV</span>
              </>
            )}
          </button>

          <button
            onClick={onOpenAddLead}
            className="px-2.5 sm:px-3 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-xs shadow-xs flex items-center space-x-1 active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
      </div>

      {/* CSV Export Success Banner */}
      {exportSuccess && (
        <div className="p-2.5 rounded-xl bg-[#E8F5EF] border border-[#CBE7DC] dark:bg-[#087F68]/20 dark:border-[#087F68]/30 text-[#087F68] dark:text-[#38D6AB] text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <FileSpreadsheet className="w-4 h-4 shrink-0 text-[#087F68] dark:text-[#38D6AB]" />
            <span className="truncate">
              <strong>Report Ready:</strong> {lastExportedCount} lead{lastExportedCount !== 1 ? 's' : ''} exported to CSV for accounting & tax documentation.
            </span>
          </div>
          <button
            onClick={() => setExportSuccess(false)}
            className="p-1 hover:text-[#066956] text-[#087F68] dark:text-[#38D6AB] shrink-0"
            title="Dismiss"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Cards: Lead Distribution Across Stages */}
      <div className="bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-1.5">
            <span className="text-xs font-bold text-[#18211F] dark:text-white">
              Pipeline Distribution
            </span>
            <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">
              • {leads.length} total leads
            </span>
          </div>
          <span className="text-xs font-black text-[#087F68] dark:text-[#38D6AB]">
            {formatINR(stageStats.totalPipelineValue)}
          </span>
        </div>

        {/* Stacked Proportional Distribution Bar */}
        <div className="w-full h-2 rounded-full bg-[#F2F4F2] dark:bg-[#26312E] flex overflow-hidden">
          {stageStats.stages.map(st => {
            if (st.percent <= 0) return null;
            return (
              <div
                key={st.id}
                style={{ width: `${st.percent}%` }}
                className={`${st.barColor} transition-all duration-300 relative group`}
                title={`${st.label}: ${st.count} leads (${st.percent}%)`}
              />
            );
          })}
        </div>

        {/* 4 Stage Metric Cards in 2x2 Grid */}
        <div className="grid grid-cols-2 gap-2">
          {stageStats.stages.map(st => {
            const isSelected = selectedStage === st.stageKey;
            const Icon = st.icon;

            return (
              <button
                key={st.id}
                type="button"
                onClick={() => setSelectedStage(isSelected ? 'all' : st.stageKey)}
                className={`p-2.5 rounded-xl border text-left transition relative active:scale-98 cursor-pointer ${
                  isSelected
                    ? 'border-[#087F68] bg-[#E8F5EF]/70 dark:bg-[#087F68]/20 shadow-xs ring-1 ring-[#087F68]'
                    : 'border-[#E6EAE7] dark:border-[#26312E] bg-[#FAFBFA] dark:bg-[#1E2825] hover:border-[#087F68]/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-[#18211F] dark:text-white flex items-center space-x-1.5 truncate">
                    <Icon className="w-3.5 h-3.5 text-[#087F68] shrink-0" />
                    <span className="truncate">{st.label}</span>
                  </span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-md font-bold shrink-0 ${st.badgeBg} ${st.textColor}`}>
                    {st.count}
                  </span>
                </div>

                <div className="text-xs font-black text-[#18211F] dark:text-white truncate">
                  {formatINR(st.value)}
                </div>

                {/* Progress bar inside card */}
                <div className="mt-1.5 space-y-0.5">
                  <div className="w-full h-1.5 bg-[#E6EAE7] dark:bg-[#2B3733] rounded-full overflow-hidden">
                    <div
                      className={`h-full ${st.barColor} rounded-full transition-all duration-300`}
                      style={{ width: `${st.percent}%` }}
                    />
                  </div>
                  <div className="flex justify-between items-center text-[9px] text-[#6B7470] dark:text-[#9BA5A0]">
                    <span>{st.percent}% of pipeline</span>
                    {isSelected && (
                      <span className="text-[9px] font-bold text-[#087F68] dark:text-[#38D6AB]">Active Filter</span>
                    )}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Search & Sort Bar */}
      <div className="space-y-2">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#6B7470] absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              onBlur={() => saveSearchQuery(searchTerm)}
              placeholder="Search customer, phone, project (Press Enter to save)..."
              className="w-full pl-9 pr-8 py-2 bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white placeholder:text-[#6B7470] focus:ring-1 focus:ring-[#087F68] shadow-xs"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-2.5 top-2.5 text-[#6B7470] hover:text-[#18211F]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Sort Selector & View Mode Toggle */}
          <div className="flex items-center space-x-1.5 self-start sm:self-auto shrink-0">
            <div className="flex items-center space-x-1 bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl px-2.5 py-1.5 shadow-xs text-xs">
              <ArrowUpDown className="w-3.5 h-3.5 text-[#6B7470]" />
              <select
                value={sortBy}
                onChange={e => setSortBy(e.target.value as any)}
                className="bg-transparent border-none text-xs text-[#18211F] dark:text-[#EAEFEA] focus:ring-0 cursor-pointer"
              >
                <option value="score">⚡ Lead Score (High)</option>
                <option value="followUp">Follow-up Date</option>
                <option value="value">Deal Value (High)</option>
                <option value="recent">Most Recent</option>
                <option value="name">Name (A-Z)</option>
              </select>
            </div>

            {/* View Mode Toggle: List vs Kanban */}
            <div className="flex items-center bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-0.5 shadow-xs text-xs">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List View"
                className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-[#087F68] text-white font-bold shadow-xs'
                    : 'text-[#6B7470] dark:text-[#A1ACA6] hover:text-[#18211F]'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">List</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                title="Kanban Board View"
                className={`px-2.5 py-1.5 rounded-lg flex items-center space-x-1 transition cursor-pointer ${
                  viewMode === 'kanban'
                    ? 'bg-[#087F68] text-white font-bold shadow-xs'
                    : 'text-[#6B7470] dark:text-[#A1ACA6] hover:text-[#18211F]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span className="hidden xs:inline">Kanban</span>
              </button>
            </div>
          </div>
        </div>

        {/* Search History Chips: Remembers last 3 queries */}
        {recentSearches.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
            <div className="flex items-center space-x-1 text-[#6B7470] dark:text-[#9BA5A0] shrink-0 font-medium mr-0.5">
              <History className="w-3 h-3 text-[#087F68]" />
              <span>Recent:</span>
            </div>
            {recentSearches.map(query => {
              const isCurrent = searchTerm.toLowerCase() === query.toLowerCase();
              return (
                <div
                  key={query}
                  onClick={() => handleSelectRecentSearch(query)}
                  className={`inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg border text-xs font-medium cursor-pointer transition active:scale-95 ${
                    isCurrent
                      ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20 border-[#087F68] text-[#087F68] dark:text-[#38D6AB] font-bold'
                      : 'bg-white dark:bg-[#18211F] border-[#E6EAE7] dark:border-[#26312E] text-[#18211F] dark:text-[#D1DBD6] hover:border-[#087F68]/50'
                  }`}
                >
                  <span className="truncate max-w-[120px]">{query}</span>
                  <button
                    type="button"
                    onClick={e => removeSearchQuery(query, e)}
                    className="p-0.5 hover:text-[#C83C4B] text-[#6B7470] transition"
                    title="Remove from history"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Horizontal Stage Filter Pill Strip */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none text-xs">
        {stagesList.map(st => {
          const isActive = selectedStage === st;
          const count = st === 'all' ? leads.length : leads.filter(l => l.stage === st).length;
          const config = st !== 'all' ? getStageIndicatorConfig(st) : null;
          return (
            <button
              key={st}
              onClick={() => setSelectedStage(st)}
              className={`px-3 py-1.5 rounded-xl font-medium whitespace-nowrap transition flex items-center space-x-1.5 cursor-pointer ${
                isActive
                  ? 'bg-[#087F68] text-white font-bold shadow-xs'
                  : 'bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470] dark:text-[#A1ACA6] hover:bg-[#F4F6F4]'
              }`}
            >
              {config && (
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${config.dotClass.split(' ')[0]}`} />
              )}
              <span className="capitalize">{st === 'all' ? 'All' : st}</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${isActive ? 'bg-white/25 text-white' : 'bg-[#F2F4F2] dark:bg-[#202A27]'}`}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Leads View Mode: List vs Kanban */}
      {filteredLeads.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] space-y-2">
          <Building className="w-7 h-7 text-[#6B7470]/60 mx-auto" />
          <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm">No Enquiries Found</h3>
          <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] max-w-xs mx-auto">
            {searchTerm || selectedStage !== 'all'
              ? 'Try adjusting your search query or stage filters.'
              : 'Add your first customer enquiry to start tracking quotations.'}
          </p>
        </div>
      ) : viewMode === 'list' ? (
        <div className="space-y-2">
          {/* Select All Bar */}
          <div className="flex items-center justify-between px-3 py-1.5 bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs">
            <label className="flex items-center space-x-2 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedLeadIds.length === filteredLeads.length && filteredLeads.length > 0}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-[#087F68] focus:ring-[#087F68] cursor-pointer"
              />
              <span className="font-semibold text-[#6B7470] dark:text-[#9BA5A0]">
                Select All ({filteredLeads.length})
              </span>
            </label>
            {selectedLeadIds.length > 0 && (
              <span className="text-[11px] font-bold text-[#087F68]">
                {selectedLeadIds.length} selected
              </span>
            )}
          </div>

          {filteredLeads.map(lead => {
            const phoneInfo = validateAndCleanIndianPhone(lead.phone);
            const status = categorizeFollowUp(lead, todayStr);
            const val = lead.quotationAmount || lead.estimatedValue;
            const initials = getInitials(lead.customerName);
            const stageConfig = getStageIndicatorConfig(lead.stage);
            const isSelected = selectedLeadIds.includes(lead.id);

            return (
              <div
                key={lead.id}
                onClick={() => onSelectLead(lead)}
                className={`p-3 rounded-2xl bg-white dark:bg-[#18211F] border transition flex items-center justify-between gap-2.5 cursor-pointer ${
                  isSelected
                    ? 'border-[#087F68] bg-[#E8F5EF]/40 dark:bg-[#087F68]/10 ring-1 ring-[#087F68]'
                    : 'border-[#E6EAE7] dark:border-[#26312E] hover:border-[#087F68]/40 shadow-xs'
                }`}
              >
                {/* Checkbox & Avatar & Info */}
                <div className="flex items-center space-x-2.5 min-w-0 flex-1">
                  <div
                    onClick={e => handleToggleSelectLead(lead.id, e)}
                    className="p-1 cursor-pointer shrink-0"
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}}
                      className="w-4 h-4 rounded text-[#087F68] focus:ring-[#087F68] cursor-pointer"
                    />
                  </div>

                  {/* Initials Avatar */}
                  <div className="w-9 h-9 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] font-bold text-xs flex items-center justify-center shrink-0 border border-[#CBE7DC] dark:border-[#087F68]/30">
                    {initials}
                  </div>

                  {/* Customer Main Info */}
                  <div className="min-w-0 flex-1">
                    {/* Line 1: Color dot, Name, Priority Badge */}
                    <div className="flex items-center space-x-1.5 min-w-0 flex-wrap">
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${stageConfig.dotClass}`}
                        title={`Stage: ${lead.stage}`}
                      />
                      <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm truncate">
                        {lead.customerName}
                      </h3>
                      {lead.priority && (
                        <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider border ${getPriorityBadgeClass(lead.priority)}`}>
                          {lead.priority}
                        </span>
                      )}
                      {(() => {
                        const scoreRes = calculateLeadScore(lead);
                        return (
                          <span
                            title={`Lead Score: ${scoreRes.score}/100 (${scoreRes.level})\nEngagement: ${scoreRes.breakdown.engagement}/35\nActivity: ${scoreRes.breakdown.activity}/35\nDeal Value: ${scoreRes.breakdown.dealValue}/30`}
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold uppercase tracking-wider border flex items-center space-x-0.5 shrink-0 ${scoreRes.colorClass}`}
                          >
                            <Zap className="w-2.5 h-2.5 shrink-0 fill-current" />
                            <span>{scoreRes.score} • {scoreRes.level}</span>
                          </span>
                        );
                      })()}
                    </div>

                    {/* Line 2: Stage, Overdue, Price, Project, Tags */}
                    <div className="flex items-center space-x-1.5 flex-wrap mt-0.5 text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">
                      <span className={`text-[9px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wide border ${stageConfig.badgeClass}`}>
                        {lead.stage}
                      </span>
                      {status === 'overdue' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#C83C4B] text-white font-bold">
                          Overdue
                        </span>
                      )}
                      {status === 'today' && (
                        <span className="text-[9px] px-1.5 py-0.2 rounded-md bg-[#D97706] text-white font-bold">
                          Due Today
                        </span>
                      )}
                      <span className="font-semibold text-[#18211F] dark:text-[#CBD3CF]">{formatINR(val)}</span>
                      <span>•</span>
                      <span className="truncate">{lead.projectType}</span>
                      
                      {/* Tags */}
                      {lead.tags && lead.tags.length > 0 && (
                        <div className="flex items-center space-x-1">
                          <span>•</span>
                          {lead.tags.map(t => (
                            <span key={t} className="text-[9px] px-1.5 py-0.2 rounded bg-[#F2F4F2] dark:bg-[#202A27] text-[#6B7470] dark:text-[#A1ACA6]">
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right Quick Actions */}
                <div className="flex items-center space-x-1 shrink-0" onClick={e => e.stopPropagation()}>
                  <a
                    href={`https://wa.me/${phoneInfo.whatsAppNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    title="Open WhatsApp"
                    className="p-1.5 rounded-xl bg-[#E8F5EF] hover:bg-[#D5EFE3] text-[#087F68] transition"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                  </a>

                  <button
                    onClick={() => onOpenAIMessage(lead)}
                    title="Generate AI Follow-Up"
                    className="px-2 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-[11px] flex items-center space-x-1 shadow-xs active:scale-95 transition cursor-pointer"
                  >
                    <Sparkles className="w-3 h-3" />
                    <span>AI</span>
                  </button>

                  <button
                    onClick={() => onSelectLead(lead)}
                    title="View Lead Details"
                    className="p-1.5 rounded-xl bg-[#F2F4F2] dark:bg-[#222C28] text-[#18211F] dark:text-[#EAEFEA] hover:bg-[#E6EAE7] transition cursor-pointer"
                  >
                    <ChevronRight className="w-3.5 h-3.5 text-[#6B7470] dark:text-[#A1ACA6]" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* Kanban Board View */
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3 overflow-x-auto pb-4">
          {['New', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'].map(stageName => {
            const stageLeads = filteredLeads.filter(l => l.stage === stageName);
            const stageConfig = getStageIndicatorConfig(stageName);

            return (
              <div
                key={stageName}
                className="bg-[#FAFBFA] dark:bg-[#151D1B] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl p-3 flex flex-col min-w-[220px]"
              >
                {/* Column Header */}
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#E6EAE7] dark:border-[#26312E]">
                  <div className="flex items-center space-x-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${stageConfig.dotClass.split(' ')[0]}`} />
                    <span className="font-bold text-xs text-[#18211F] dark:text-white truncate">
                      {stageName}
                    </span>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB]">
                    {stageLeads.length}
                  </span>
                </div>

                {/* Column Cards */}
                <div className="space-y-2.5 flex-1 min-h-[300px]">
                  {stageLeads.length === 0 ? (
                    <div className="h-24 flex items-center justify-center text-[11px] text-[#6B7470] border border-dashed border-[#E6EAE7] dark:border-[#26312E] rounded-xl">
                      No leads
                    </div>
                  ) : (
                    stageLeads.map(lead => {
                      const val = lead.quotationAmount || lead.estimatedValue;
                      const phoneInfo = validateAndCleanIndianPhone(lead.phone);

                      return (
                        <div
                          key={lead.id}
                          onClick={() => onSelectLead(lead)}
                          className="p-3 rounded-xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs hover:border-[#087F68]/50 transition space-y-2 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-1">
                            <h4 className="font-bold text-xs text-[#18211F] dark:text-white truncate">
                              {lead.customerName}
                            </h4>
                            {lead.priority && (
                              <span className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase tracking-wider border shrink-0 ${getPriorityBadgeClass(lead.priority)}`}>
                                {lead.priority}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-1">
                            <div className="text-[11px] font-semibold text-[#087F68] dark:text-[#38D6AB]">
                              {formatINR(val)}
                            </div>
                            {(() => {
                              const scoreRes = calculateLeadScore(lead);
                              return (
                                <span
                                  title={`Lead Score: ${scoreRes.score}/100 (${scoreRes.level})`}
                                  className={`text-[8px] px-1 py-0.2 rounded font-bold uppercase tracking-wider border shrink-0 flex items-center space-x-0.5 ${scoreRes.colorClass}`}
                                >
                                  <Zap className="w-2 h-2 shrink-0 fill-current" />
                                  <span>{scoreRes.score} • {scoreRes.level}</span>
                                </span>
                              );
                            })()}
                          </div>

                          <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
                            {lead.projectType}
                          </div>

                          {/* Quick Stage Move Dropdown */}
                          <div className="pt-1 border-t border-[#F2F4F2] dark:border-[#26312E] flex items-center justify-between text-[10px]" onClick={e => e.stopPropagation()}>
                            <span className="text-[#6B7470]">Move:</span>
                            <select
                              value={lead.stage}
                              onChange={async e => {
                                if (onUpdateLeadStage) {
                                  await onUpdateLeadStage(lead.id, e.target.value as LeadStage);
                                }
                              }}
                              className="bg-[#F2F4F2] dark:bg-[#202A27] text-[#18211F] dark:text-white border-none rounded-lg px-1.5 py-0.5 text-[10px] cursor-pointer font-medium"
                            >
                              {['New', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'].map(s => (
                                <option key={s} value={s}>{s}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Floating Bulk Action Toolbar */}
      {selectedLeadIds.length > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 bg-[#18211F] text-white px-4 py-2.5 rounded-2xl shadow-2xl flex items-center space-x-3 border border-[#2D3935] text-xs animate-in slide-in-from-bottom-4 duration-200">
          <span className="font-bold bg-[#087F68] text-white px-2 py-0.5 rounded-full text-[10px]">
            {selectedLeadIds.length} selected
          </span>
          <div className="flex items-center space-x-2">
            <select
              value={bulkStageTarget}
              onChange={e => setBulkStageTarget(e.target.value as LeadStage)}
              className="bg-[#222C28] border border-[#2D3935] rounded-xl px-2.5 py-1 text-xs text-white focus:ring-0 cursor-pointer"
            >
              {stagesList.filter(s => s !== 'all').map(s => (
                <option key={s} value={s}>Move to {s}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => handleBulkStageChange(bulkStageTarget)}
              className="px-3 py-1 bg-[#087F68] hover:bg-[#066956] text-white font-semibold rounded-xl transition cursor-pointer"
            >
              Update Stage
            </button>
            <button
              type="button"
              onClick={handleBulkDelete}
              className="px-3 py-1 bg-[#C83C4B] hover:bg-[#B03340] text-white font-semibold rounded-xl transition cursor-pointer"
            >
              Delete
            </button>
            <button
              type="button"
              onClick={() => setSelectedLeadIds([])}
              className="p-1 hover:text-[#9BA5A0] text-white/70"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
