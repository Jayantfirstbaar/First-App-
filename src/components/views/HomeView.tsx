import React from 'react';
import { Lead, UserProfile } from '../../types';
import { formatINR, categorizeFollowUp, calculateWonRevenue, calculatePipelineValue } from '../../utils/calculations';
import {
  Sparkles,
  Clock,
  AlertCircle,
  Plus,
  ArrowRight,
  CheckCircle2,
  TrendingUp,
  FileText,
  MessageSquare,
  Users,
  Building,
} from 'lucide-react';

interface HomeViewProps {
  user: UserProfile | null;
  leads: Lead[];
  onOpenAddLead: () => void;
  onSelectLead: (lead: Lead) => void;
  onOpenAIMessage: (lead: Lead) => void;
  onNavigateTab: (tab: 'leads' | 'followups' | 'reports') => void;
  onSeedSampleData?: () => void;
}

export const HomeView: React.FC<HomeViewProps> = ({
  user,
  leads,
  onOpenAddLead,
  onSelectLead,
  onOpenAIMessage,
  onNavigateTab,
  onSeedSampleData,
}) => {
  const todayStr = new Date().toISOString().split('T')[0];

  // Greeting based on hour
  const currentHour = new Date().getHours();
  const greeting = currentHour < 12 ? 'Good morning' : currentHour < 17 ? 'Good afternoon' : 'Good evening';

  // Derived metrics from real saved records
  const thisMonthStr = todayStr.substring(0, 7);
  const leadsThisMonth = leads.filter(l => l.createdAt.startsWith(thisMonthStr)).length;

  const overdueLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'overdue');
  const dueTodayLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'today');
  const upcomingLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'upcoming');

  const { totalValue: openPipelineValue, openCount } = calculatePipelineValue(leads);
  const wonRevenue = calculateWonRevenue(leads);
  const wonCount = leads.filter(l => l.stage === 'Won').length;

  // Leads that require attention today (overdue first, then due today)
  const priorityActionLeads = [...overdueLeads, ...dueTodayLeads];

  // Helper for customer avatar initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="p-3.5 sm:p-5 space-y-4 max-w-4xl mx-auto overflow-x-hidden">
      {/* Header Greeting Banner */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="min-w-0">
          <span className="text-[11px] font-bold text-[#087F68] uppercase tracking-wider block">
            {greeting}, {user?.name?.split(' ')[0] || 'Designer'}
          </span>
          <h1 className="text-lg sm:text-xl font-black text-[#18211F] dark:text-white tracking-tight truncate">
            {user?.businessName || 'Interior Studio'}
          </h1>
          <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
            Never lose track of a quotation.
          </p>
        </div>

        {/* Quick Add Lead Button */}
        <button
          onClick={onOpenAddLead}
          className="shrink-0 px-3.5 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-xs shadow-xs flex items-center space-x-1.5 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Lead</span>
        </button>
      </div>

      {/* Critical Overdue Follow-Up Alert Banner (if any) */}
      {overdueLeads.length > 0 && (
        <div className="p-3.5 bg-[#FDF2F3] dark:bg-[#C83C4B]/15 border border-[#F7D2D6] dark:border-[#C83C4B]/30 rounded-2xl flex items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="p-1.5 rounded-lg bg-[#C83C4B]/15 text-[#C83C4B] shrink-0">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-[#C83C4B] dark:text-[#F38B95] text-xs truncate">
                {overdueLeads.length} Quotation Follow-Up{overdueLeads.length > 1 ? 's' : ''} Overdue
              </h2>
              <p className="text-[11px] text-[#6B7470] dark:text-[#CBD3CF] truncate">
                Clients waiting for response. Send a WhatsApp follow-up.
              </p>
            </div>
          </div>
          <button
            onClick={() => onNavigateTab('followups')}
            className="shrink-0 px-2.5 py-1.5 rounded-lg bg-[#C83C4B] hover:bg-[#B33543] text-white font-bold text-[11px] shadow-xs transition"
          >
            Review ({overdueLeads.length})
          </button>
        </div>
      )}

      {/* Priority Action Tasks Card ("Today's Follow-up Priority") */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="min-w-0">
            <h2 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm flex items-center space-x-1.5">
              <Sparkles className="w-4 h-4 text-[#087F68]" />
              <span>Today&apos;s Follow-up Priority</span>
            </h2>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
              {priorityActionLeads.length} lead{priorityActionLeads.length === 1 ? '' : 's'} scheduled for communication
            </p>
          </div>
          <button
            onClick={() => onNavigateTab('followups')}
            className="text-[11px] font-semibold text-[#087F68] hover:underline flex items-center space-x-1 shrink-0"
          >
            <span>View All</span>
            <ArrowRight className="w-3 h-3" />
          </button>
        </div>

        {priorityActionLeads.length === 0 ? (
          <div className="py-6 px-4 text-center rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/50 border border-dashed border-[#E6EAE7] dark:border-[#26312E] space-y-1.5">
            <CheckCircle2 className="w-7 h-7 text-[#087F68] mx-auto" />
            <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm">
              All Caught Up for Today!
            </h3>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] max-w-sm mx-auto">
              No pending follow-ups today. You have {upcomingLeads.length} upcoming appointments scheduled this week.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {priorityActionLeads.slice(0, 4).map(lead => {
              const status = categorizeFollowUp(lead, todayStr);
              const val = lead.quotationAmount || lead.estimatedValue;
              const initials = getInitials(lead.customerName);

              return (
                <div
                  key={lead.id}
                  className="p-3 rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between gap-3 hover:border-[#087F68]/40 transition group"
                >
                  <div
                    onClick={() => onSelectLead(lead)}
                    className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    {/* Customer Initials Avatar */}
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                        status === 'overdue'
                          ? 'bg-[#FDF2F3] text-[#C83C4B] border border-[#F7D2D6]'
                          : 'bg-[#E8F5EF] text-[#087F68] border border-[#CBE7DC]'
                      }`}
                    >
                      {initials}
                    </div>

                    {/* Customer Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm truncate">
                        {lead.customerName}
                      </h3>

                      <div className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate mt-0.5 flex items-center space-x-1.5">
                        <span
                          className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase shrink-0 ${
                            status === 'overdue'
                              ? 'bg-[#C83C4B] text-white'
                              : 'bg-[#D97706] text-white'
                          }`}
                        >
                          {status === 'overdue' ? 'Overdue' : 'Today'}
                        </span>
                        <span className="font-semibold text-[#18211F] dark:text-[#CBD3CF] shrink-0">{formatINR(val)}</span>
                        <span>•</span>
                        <span className="truncate">{lead.projectType}</span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: AI Follow-Up + Tap to view */}
                  <div className="flex items-center space-x-1.5 shrink-0">
                    <button
                      onClick={() => onOpenAIMessage(lead)}
                      title="AI WhatsApp Follow-Up"
                      className="px-2.5 py-1.5 rounded-lg bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-[11px] flex items-center space-x-1 shadow-xs active:scale-95 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Follow-Up</span>
                    </button>
                    <button
                      onClick={() => onSelectLead(lead)}
                      title="View Details"
                      className="p-1.5 rounded-lg text-[#6B7470] hover:text-[#18211F] hover:bg-white dark:hover:bg-[#18211F] transition"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Key Metric Cards (2x2 Grid) */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Metric 1: Leads This Month */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7470] dark:text-[#9BA5A0] text-[11px]">
            <span>Leads (Month)</span>
            <Users className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-xl font-black text-[#18211F] dark:text-white mt-1">
            {leadsThisMonth}
          </div>
          <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
            {leads.length} total active & closed
          </div>
        </div>

        {/* Metric 2: Follow-ups Due Today */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7470] dark:text-[#9BA5A0] text-[11px]">
            <span>Due Today</span>
            <Clock className="w-3.5 h-3.5 text-[#D97706]" />
          </div>
          <div className="text-xl font-black text-[#18211F] dark:text-white mt-1">
            {dueTodayLeads.length}
          </div>
          <div className="text-[10px] text-[#C83C4B] font-semibold mt-0.5">
            {overdueLeads.length > 0 ? `${overdueLeads.length} overdue` : '0 overdue'}
          </div>
        </div>

        {/* Metric 3: Open Quotation Pipeline */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7470] dark:text-[#9BA5A0] text-[11px]">
            <span>Open Pipeline</span>
            <FileText className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-base sm:text-lg font-black text-[#087F68] mt-1 truncate">
            {formatINR(openPipelineValue)}
          </div>
          <div className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
            Across {openCount} active leads
          </div>
        </div>

        {/* Metric 4: Won Sales Revenue */}
        <div className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
          <div className="flex items-center justify-between text-[#6B7470] dark:text-[#9BA5A0] text-[11px]">
            <span>Won Revenue</span>
            <TrendingUp className="w-3.5 h-3.5 text-[#087F68]" />
          </div>
          <div className="text-base sm:text-lg font-black text-[#18211F] dark:text-white mt-1 truncate">
            {formatINR(wonRevenue)}
          </div>
          <div className="text-[10px] text-[#087F68] font-semibold mt-0.5">
            {wonCount} won deal{wonCount === 1 ? '' : 's'}
          </div>
        </div>
      </div>

      {/* Empty State / Sample Leads Seeder for New Users */}
      {leads.length === 0 && (
        <div className="p-5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] text-center space-y-2.5">
          <div className="w-10 h-10 rounded-2xl bg-[#E8F5EF] text-[#087F68] mx-auto flex items-center justify-center">
            <Building className="w-5 h-5" />
          </div>
          <h3 className="text-sm font-bold text-[#18211F] dark:text-white">
            Welcome to QuoteBack AI
          </h3>
          <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] max-w-sm mx-auto">
            Store client enquiries, track quotation amounts, generate personalized follow-up messages in English/Hindi/Hinglish, and send directly on WhatsApp.
          </p>
          <div className="flex items-center justify-center space-x-2 pt-1">
            <button
              onClick={onOpenAddLead}
              className="px-3.5 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs cursor-pointer"
            >
              Add First Lead
            </button>
            {onSeedSampleData && (
              <button
                onClick={onSeedSampleData}
                className="px-3.5 py-2 rounded-xl bg-white dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] text-[#087F68] font-semibold text-xs hover:bg-[#E8F5EF] cursor-pointer"
              >
                Load Demo Leads
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
