import React, { useState } from 'react';
import { Lead, FollowUpFilterTab } from '../../types';
import { formatINR, validateAndCleanIndianPhone, categorizeFollowUp } from '../../utils/calculations';
import {
  Clock,
  AlertCircle,
  Calendar,
  CheckCircle2,
  Sparkles,
  MessageSquare,
  ChevronRight,
  Phone,
} from 'lucide-react';

interface FollowUpsViewProps {
  leads: Lead[];
  onSelectLead: (lead: Lead) => void;
  onOpenAIMessage: (lead: Lead) => void;
  onOpenFollowUpAction: (lead: Lead) => void;
}

export const FollowUpsView: React.FC<FollowUpsViewProps> = ({
  leads,
  onSelectLead,
  onOpenAIMessage,
  onOpenFollowUpAction,
}) => {
  const [activeTab, setActiveTab] = useState<FollowUpFilterTab>('today');
  const todayStr = new Date().toISOString().split('T')[0];

  const overdueLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'overdue');
  const dueTodayLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'today');
  const upcomingLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'upcoming');
  const completedLeads = leads.filter(l => categorizeFollowUp(l, todayStr) === 'completed');

  const currentList =
    activeTab === 'overdue'
      ? overdueLeads
      : activeTab === 'today'
      ? dueTodayLeads
      : activeTab === 'upcoming'
      ? upcomingLeads
      : completedLeads;

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="p-3.5 sm:p-5 space-y-3.5 max-w-4xl mx-auto overflow-x-hidden">
      {/* Title */}
      <div>
        <h1 className="text-lg sm:text-xl font-black text-[#18211F] dark:text-white tracking-tight">
          Follow-Up Tasks
        </h1>
        <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5">
          Never miss a promising client because you forgot to follow up.
        </p>
      </div>

      {/* Tabs: Overdue, Due Today, Upcoming, Completed */}
      <div className="grid grid-cols-4 gap-1 p-1 bg-white dark:bg-[#18211F] rounded-2xl border border-[#E6EAE7] dark:border-[#26312E] shadow-xs text-xs">
        <button
          onClick={() => setActiveTab('overdue')}
          className={`py-1.5 px-1 rounded-xl font-semibold flex flex-col items-center justify-center transition ${
            activeTab === 'overdue'
              ? 'bg-[#FDF2F3] dark:bg-[#C83C4B]/20 text-[#C83C4B] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F]'
          }`}
        >
          <span className="text-[11px]">Overdue</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded-full mt-0.5 ${
              overdueLeads.length > 0 ? 'bg-[#C83C4B] text-white font-bold' : 'bg-[#F2F4F2] dark:bg-[#202A27]'
            }`}
          >
            {overdueLeads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('today')}
          className={`py-1.5 px-1 rounded-xl font-semibold flex flex-col items-center justify-center transition ${
            activeTab === 'today'
              ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F]'
          }`}
        >
          <span className="text-[11px]">Due Today</span>
          <span
            className={`text-[9px] px-1.5 py-0.2 rounded-full mt-0.5 ${
              dueTodayLeads.length > 0 ? 'bg-[#D97706] text-white font-bold' : 'bg-[#F2F4F2] dark:bg-[#202A27]'
            }`}
          >
            {dueTodayLeads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('upcoming')}
          className={`py-1.5 px-1 rounded-xl font-semibold flex flex-col items-center justify-center transition ${
            activeTab === 'upcoming'
              ? 'bg-[#F2F4F2] dark:bg-[#222C28] text-[#18211F] dark:text-white font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F]'
          }`}
        >
          <span className="text-[11px]">Upcoming</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F2F4F2] dark:bg-[#202A27] mt-0.5">
            {upcomingLeads.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('completed')}
          className={`py-1.5 px-1 rounded-xl font-semibold flex flex-col items-center justify-center transition ${
            activeTab === 'completed'
              ? 'bg-[#F2F4F2] dark:bg-[#222C28] text-[#18211F] dark:text-white font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F]'
          }`}
        >
          <span className="text-[11px]">Done</span>
          <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-[#F2F4F2] dark:bg-[#202A27] mt-0.5">
            {completedLeads.length}
          </span>
        </button>
      </div>

      {/* List Content */}
      {currentList.length === 0 ? (
        <div className="py-12 text-center rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] space-y-2">
          <CheckCircle2 className="w-7 h-7 text-[#087F68] mx-auto" />
          <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm">
            {activeTab === 'overdue'
              ? 'Zero Overdue Follow-ups!'
              : activeTab === 'today'
              ? 'No Follow-ups Due Today'
              : activeTab === 'upcoming'
              ? 'No Upcoming Follow-ups Scheduled'
              : 'No Completed Follow-ups Yet'}
          </h3>
          <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] max-w-xs mx-auto">
            {activeTab === 'overdue'
              ? 'Great job keeping on top of your customer quotation pipeline.'
              : 'Check other tabs or schedule next appointments from lead details.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {currentList.map(lead => {
            const phoneInfo = validateAndCleanIndianPhone(lead.phone);
            const val = lead.quotationAmount || lead.estimatedValue;
            const initials = getInitials(lead.customerName);

            return (
              <div
                key={lead.id}
                className="p-3.5 rounded-2xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-2.5 hover:border-[#087F68]/40 transition"
              >
                {/* Header row with customer avatar and appointment time */}
                <div className="flex items-start justify-between gap-2">
                  <div
                    onClick={() => onSelectLead(lead)}
                    className="flex items-center space-x-2.5 min-w-0 flex-1 cursor-pointer"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#E8F5EF] text-[#087F68] font-bold text-xs flex items-center justify-center shrink-0 border border-[#CBE7DC]">
                      {initials}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <h3 className="font-bold text-[#18211F] dark:text-white text-xs sm:text-sm truncate">
                          {lead.customerName}
                        </h3>
                        <span className="text-[9px] px-1.5 py-0.2 rounded-full font-bold bg-[#F2F4F2] dark:bg-[#202A27] text-[#6B7470] uppercase shrink-0">
                          {lead.stage}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] mt-0.5 truncate flex items-center space-x-1.5">
                        <span className="font-semibold text-[#18211F] dark:text-[#CBD3CF]">{formatINR(val)}</span>
                        <span>•</span>
                        <span className="truncate">{lead.projectType}</span>
                      </div>
                    </div>
                  </div>

                  {lead.nextFollowUpDate && (
                    <div className="text-right text-[11px] shrink-0">
                      <div className="font-semibold text-[#18211F] dark:text-[#CBD3CF] flex items-center space-x-1 justify-end">
                        <Clock className="w-3 h-3 text-[#6B7470]" />
                        <span>{lead.nextFollowUpDate}</span>
                      </div>
                      <span className="text-[10px] text-[#6B7470]">{lead.nextFollowUpTime || '11:00 AM'}</span>
                    </div>
                  )}
                </div>

                {/* Notes or quotation detail */}
                {lead.notes && (
                  <p className="text-[11px] text-[#6B7470] dark:text-[#CBD3CF] bg-[#F7F8F6] dark:bg-[#202A27]/60 p-2 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] leading-relaxed line-clamp-2">
                    {lead.notes}
                  </p>
                )}

                {/* Direct Action Buttons */}
                <div className="pt-0.5 flex items-center justify-between gap-1.5">
                  <div className="flex items-center space-x-1.5">
                    <button
                      onClick={() => onOpenAIMessage(lead)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-[11px] flex items-center space-x-1 shadow-xs active:scale-95 transition"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>AI Message</span>
                    </button>

                    <a
                      href={`https://wa.me/${phoneInfo.whatsAppNumber}`}
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1.5 rounded-xl bg-[#E8F5EF] hover:bg-[#D5EFE3] text-[#087F68] font-semibold text-[11px] flex items-center space-x-1 transition"
                    >
                      <MessageSquare className="w-3 h-3" />
                      <span>WhatsApp</span>
                    </a>
                  </div>

                  <div className="flex items-center space-x-1">
                    <button
                      onClick={() => onOpenFollowUpAction(lead)}
                      className="px-2.5 py-1.5 rounded-xl bg-[#F2F4F2] dark:bg-[#222C28] text-[#18211F] dark:text-[#EAEFEA] font-semibold text-[11px] hover:bg-[#E6EAE7] transition"
                    >
                      {activeTab === 'completed' ? 'Reschedule' : 'Complete'}
                    </button>

                    <button
                      onClick={() => onSelectLead(lead)}
                      className="p-1.5 rounded-lg text-[#6B7470] hover:text-[#18211F] transition"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
