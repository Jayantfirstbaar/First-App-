import React, { useState, useEffect } from 'react';
import { Lead, Activity, UserProfile, LeadStage } from '../types';
import { api } from '../services/api';
import { formatINR, validateAndCleanIndianPhone, categorizeFollowUp } from '../utils/calculations';
import {
  X,
  Phone,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Calendar,
  Clock,
  PlusCircle,
  FileText,
  AlertCircle,
  Edit2,
  Trash2,
  ChevronRight,
} from 'lucide-react';

interface LeadDetailModalProps {
  lead: Lead;
  user: UserProfile | null;
  onClose: () => void;
  onEditLead: (lead: Lead) => void;
  onDeleteLead: (leadId: string) => void;
  onOpenAIMessage: (lead: Lead) => void;
  onOpenFollowUpAction: (lead: Lead) => void;
  onLeadUpdated: () => void;
}

const STAGES: LeadStage[] = [
  'New',
  'Contacted',
  'Site Visit Scheduled',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
];

export const LeadDetailModal: React.FC<LeadDetailModalProps> = ({
  lead,
  user,
  onClose,
  onEditLead,
  onDeleteLead,
  onOpenAIMessage,
  onOpenFollowUpAction,
  onLeadUpdated,
}) => {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [newNote, setNewNote] = useState('');
  const [submittingNote, setSubmittingNote] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showStatusConfirm, setShowStatusConfirm] = useState<LeadStage | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'details' | 'timeline'>('details');

  const phoneInfo = validateAndCleanIndianPhone(lead.phone);
  const todayStr = new Date().toISOString().split('T')[0];
  const followUpStatus = categorizeFollowUp(lead, todayStr);

  const loadActivities = async () => {
    setLoadingActivities(true);
    try {
      const data = await api.getActivities(lead.id);
      setActivities(data);
    } catch (err) {
      console.error('Error fetching activities:', err);
    } finally {
      setLoadingActivities(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, [lead.id]);

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNote.trim()) return;

    setSubmittingNote(true);
    try {
      await api.addActivity(lead.id, 'note', newNote.trim());
      setNewNote('');
      await loadActivities();
      onLeadUpdated();
    } catch (err) {
      console.error('Error adding note:', err);
    } finally {
      setSubmittingNote(false);
    }
  };

  const handleStageChange = async (targetStage: LeadStage) => {
    if (targetStage === 'Won' || targetStage === 'Lost') {
      setShowStatusConfirm(targetStage);
      return;
    }

    try {
      await api.updateLead(lead.id, { stage: targetStage });
      onLeadUpdated();
      await loadActivities();
    } catch (err) {
      console.error('Error updating stage:', err);
    }
  };

  const confirmStatusChange = async (stage: LeadStage, lossReason?: string) => {
    try {
      await api.updateLead(lead.id, { stage, lossReason });
      setShowStatusConfirm(null);
      onLeadUpdated();
      await loadActivities();
    } catch (err) {
      console.error('Error confirming status:', err);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Top Header Bar */}
        <div className="px-4 py-3.5 border-b border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-9 h-9 rounded-full bg-[#E8F5EF] text-[#087F68] font-bold text-xs flex items-center justify-center shrink-0 border border-[#CBE7DC]">
              {getInitials(lead.customerName)}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5 flex-wrap">
                <h3 className="font-bold text-[#18211F] dark:text-white text-sm sm:text-base truncate">
                  {lead.customerName}
                </h3>
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold uppercase tracking-wider shrink-0 ${
                    lead.stage === 'Won'
                      ? 'bg-[#E8F5EF] text-[#087F68]'
                      : lead.stage === 'Lost'
                      ? 'bg-[#FDF2F3] text-[#C83C4B]'
                      : 'bg-[#F2F4F2] text-[#6B7470]'
                  }`}
                >
                  {lead.stage}
                </span>
              </div>
              <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate">
                {lead.projectType} • Source: {lead.source}
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1 shrink-0">
            <button
              onClick={() => onEditLead(lead)}
              title="Edit lead"
              className="p-1.5 rounded-xl text-[#6B7470] hover:text-[#18211F] hover:bg-[#F2F4F2] transition"
            >
              <Edit2 className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              title="Delete lead"
              className="p-1.5 rounded-xl text-[#C83C4B] hover:bg-[#FDF2F3] transition"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#6B7470] hover:text-[#18211F] transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
          {/* Quick Primary Actions: Call, WhatsApp, AI Message */}
          <div className="grid grid-cols-3 gap-2">
            <a
              href={`tel:${phoneInfo.cleaned}`}
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#F4F6F4] dark:bg-[#202A27] hover:bg-[#E8EBE8] text-[#18211F] dark:text-[#EAEFEA] font-semibold transition"
            >
              <Phone className="w-3.5 h-3.5 text-[#087F68] mb-1" />
              <span className="text-[11px]">Call</span>
            </a>

            <a
              href={`https://wa.me/${phoneInfo.whatsAppNumber}`}
              target="_blank"
              rel="noreferrer"
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#E8F5EF] hover:bg-[#D5EFE3] text-[#087F68] font-semibold transition"
            >
              <MessageSquare className="w-3.5 h-3.5 mb-1" />
              <span className="text-[11px]">WhatsApp</span>
            </a>

            <button
              onClick={() => onOpenAIMessage(lead)}
              className="flex flex-col items-center justify-center p-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold shadow-xs active:scale-95 transition"
            >
              <Sparkles className="w-3.5 h-3.5 mb-1" />
              <span className="text-[11px]">AI Follow-Up</span>
            </button>
          </div>

          {/* Quotation & Deal Financials */}
          <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] rounded-xl grid grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] text-[#6B7470]">Estimated Budget</span>
              <div className="text-sm font-bold text-[#18211F] dark:text-white mt-0.5">
                {formatINR(lead.estimatedValue)}
              </div>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470]">Quotation Amount</span>
              <div className="text-sm font-bold text-[#087F68] mt-0.5">
                {lead.quotationAmount ? formatINR(lead.quotationAmount) : 'Not quoted yet'}
              </div>
            </div>
          </div>

          {/* Follow-Up Status Card */}
          {lead.stage !== 'Won' && lead.stage !== 'Lost' && (
            <div
              className={`p-3 rounded-xl border flex items-center justify-between gap-2 ${
                followUpStatus === 'overdue'
                  ? 'bg-[#FDF2F3] border-[#F7D2D6] text-[#C83C4B]'
                  : followUpStatus === 'today'
                  ? 'bg-[#FEF9EE] border-[#FDE6B8] text-[#D97706]'
                  : 'bg-[#F7F8F6] dark:bg-[#202A27]/60 border-[#E6EAE7] dark:border-[#26312E]'
              }`}
            >
              <div className="flex items-center space-x-2 min-w-0">
                <Clock className="w-4 h-4 shrink-0" />
                <div className="min-w-0">
                  <div className="font-bold text-xs truncate">
                    {followUpStatus === 'overdue'
                      ? 'Follow-Up Overdue'
                      : followUpStatus === 'today'
                      ? 'Follow-Up Due Today'
                      : 'Scheduled Follow-Up'}
                  </div>
                  <div className="text-[10px] opacity-85 truncate">
                    {lead.nextFollowUpDate
                      ? `${lead.nextFollowUpDate} at ${lead.nextFollowUpTime || '11:00'}`
                      : 'No date scheduled'}
                  </div>
                </div>
              </div>

              <button
                onClick={() => onOpenFollowUpAction(lead)}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] font-semibold text-[11px] text-[#18211F] dark:text-[#EAEFEA] shadow-xs hover:bg-[#F2F4F2] transition"
              >
                Reschedule
              </button>
            </div>
          )}

          {/* Sales Stage Progression Control */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1.5">
              Move Pipeline Stage
            </label>
            <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none">
              {STAGES.map(s => {
                const isActive = lead.stage === s;
                return (
                  <button
                    key={s}
                    onClick={() => handleStageChange(s)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                      isActive
                        ? s === 'Won'
                          ? 'bg-[#087F68] text-white'
                          : s === 'Lost'
                          ? 'bg-[#C83C4B] text-white'
                          : 'bg-[#18211F] dark:bg-[#087F68] text-white'
                        : 'bg-[#F2F4F2] dark:bg-[#202A27] text-[#6B7470] hover:bg-[#E8EBE8]'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Customer Notes */}
          {lead.notes && (
            <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] rounded-xl">
              <span className="text-[10px] font-bold text-[#6B7470] block mb-1">
                Project Notes:
              </span>
              <p className="text-xs text-[#18211F] dark:text-[#EAEFEA] leading-relaxed whitespace-pre-line">
                {lead.notes}
              </p>
            </div>
          )}

          {/* Add Activity / Log Note */}
          <form onSubmit={handleAddNote} className="pt-1">
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Add Call Log / Interaction Note
            </label>
            <div className="flex space-x-2">
              <input
                type="text"
                value={newNote}
                onChange={e => setNewNote(e.target.value)}
                placeholder="e.g. Discussed layout on phone, requested revised quote..."
                className="flex-1 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
              />
              <button
                type="submit"
                disabled={submittingNote || !newNote.trim()}
                className="px-3 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-xs disabled:opacity-50 transition"
              >
                Log
              </button>
            </div>
          </form>

          {/* Scheduled Emails & Pending Communications Section */}
          {(() => {
            const scheduledEmails = activities.filter(act => act.type === 'scheduled_email');
            if (scheduledEmails.length === 0) return null;

            const parseScheduled = (details: string) => {
              try {
                const data = JSON.parse(details);
                return {
                  subject: data.subject || 'Scheduled Communication',
                  body: data.body || '',
                  scheduledAt: data.scheduledAt || '',
                  status: data.status || 'Scheduled',
                };
              } catch {
                return {
                  subject: 'Scheduled Email',
                  body: details,
                  scheduledAt: 'Upcoming',
                  status: 'Scheduled',
                };
              }
            };

            return (
              <div className="bg-[#E8F5EF]/60 dark:bg-[#087F68]/10 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-2xl p-3 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-[#087F68] dark:text-[#38D6AB] flex items-center space-x-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Scheduled Emails & Pending ({scheduledEmails.length})</span>
                  </span>
                  <span className="text-[10px] bg-[#087F68] text-white px-2 py-0.5 rounded-full font-semibold">
                    Pending
                  </span>
                </div>

                <div className="space-y-2">
                  {scheduledEmails.map(act => {
                    const item = parseScheduled(act.details);
                    return (
                      <div
                        key={act.id}
                        className="p-2.5 rounded-xl bg-white dark:bg-[#18211F] border border-[#CBE7DC] dark:border-[#087F68]/30 shadow-xs space-y-1 text-xs"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-[#18211F] dark:text-white truncate">
                            {item.subject}
                          </span>
                          <span className="text-[10px] font-semibold text-[#087F68] dark:text-[#38D6AB] flex items-center space-x-1 shrink-0">
                            <Clock className="w-3 h-3" />
                            <span>{item.scheduledAt}</span>
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] line-clamp-2 leading-relaxed">
                          {item.body}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Activity Timeline */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#18211F] dark:text-white">
                Activity History ({activities.length})
              </span>
            </div>

            {loadingActivities ? (
              <div className="p-3 text-center text-xs text-[#6B7470]">Loading timeline...</div>
            ) : activities.length === 0 ? (
              <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/40 rounded-xl text-center text-xs text-[#6B7470]">
                No activity records yet.
              </div>
            ) : (
              <div className="space-y-2 relative border-l-2 border-[#E6EAE7] dark:border-[#26312E] ml-2.5 pl-3">
                {activities.map(act => {
                  const isScheduled = act.type === 'scheduled_email';
                  let parsedDetails = act.details;
                  if (isScheduled) {
                    try {
                      const data = JSON.parse(act.details);
                      parsedDetails = `Subject: ${data.subject || 'Scheduled Email'} | Scheduled at: ${data.scheduledAt || ''}\n${data.body || ''}`;
                    } catch {}
                  }

                  return (
                    <div key={act.id} className="relative text-xs">
                      <div className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ring-2 ring-white dark:ring-[#18211F] ${isScheduled ? 'bg-indigo-500' : 'bg-[#087F68]'}`} />
                      <div className="p-2 rounded-xl bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E]">
                        <div className="flex items-center justify-between text-[10px] text-[#6B7470] mb-0.5">
                          <span className={`font-bold uppercase tracking-wider ${isScheduled ? 'text-indigo-600 dark:text-indigo-400' : 'text-[#087F68]'}`}>
                            {act.type.replace(/_/g, ' ')}
                          </span>
                          <span>{new Date(act.timestamp).toLocaleDateString()}</span>
                        </div>
                        <p className="text-[#18211F] dark:text-[#EAEFEA] leading-snug whitespace-pre-line">
                          {parsedDetails}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#18211F] rounded-2xl max-w-sm w-full p-4 border border-[#E6EAE7] dark:border-[#26312E] shadow-2xl text-center space-y-2.5">
              <div className="w-9 h-9 rounded-full bg-[#FDF2F3] text-[#C83C4B] mx-auto flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-[#18211F] dark:text-white text-sm">
                Delete Customer Enquiry?
              </h4>
              <p className="text-xs text-[#6B7470]">
                Are you sure you want to permanently delete {lead.customerName}?
              </p>
              <div className="flex items-center justify-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs text-[#6B7470]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    onDeleteLead(lead.id);
                  }}
                  className="px-4 py-1.5 rounded-xl bg-[#C83C4B] text-white text-xs font-bold"
                >
                  Confirm Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Status Won/Lost Confirmation Dialog */}
        {showStatusConfirm && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#18211F] rounded-2xl max-w-sm w-full p-4 border border-[#E6EAE7] dark:border-[#26312E] shadow-2xl text-center space-y-2.5">
              <div
                className={`w-9 h-9 rounded-full mx-auto flex items-center justify-center ${
                  showStatusConfirm === 'Won'
                    ? 'bg-[#E8F5EF] text-[#087F68]'
                    : 'bg-[#FDF2F3] text-[#C83C4B]'
                }`}
              >
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-[#18211F] dark:text-white text-sm">
                Mark Deal as {showStatusConfirm}?
              </h4>
              <p className="text-xs text-[#6B7470]">
                {showStatusConfirm === 'Won'
                  ? `Congratulations! This will book ${formatINR(lead.quotationAmount || lead.estimatedValue)} as recorded revenue.`
                  : 'Marking as lost will update your conversion reports and remove active follow-up alarms.'}
              </p>
              <div className="flex items-center justify-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowStatusConfirm(null)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs text-[#6B7470]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => confirmStatusChange(showStatusConfirm)}
                  className={`px-4 py-1.5 rounded-xl text-white text-xs font-bold shadow-xs ${
                    showStatusConfirm === 'Won' ? 'bg-[#087F68] hover:bg-[#066956]' : 'bg-[#C83C4B] hover:bg-[#B33543]'
                  }`}
                >
                  Confirm {showStatusConfirm}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
