import React, { useState } from 'react';
import { Lead } from '../types';
import { api } from '../services/api';
import { CheckCircle2, Clock, X } from 'lucide-react';

interface FollowUpActionModalProps {
  lead: Lead;
  onClose: () => void;
  onFollowUpCompleted: () => void;
}

export const FollowUpActionModal: React.FC<FollowUpActionModalProps> = ({
  lead,
  onClose,
  onFollowUpCompleted,
}) => {
  const [customerResponded, setCustomerResponded] = useState(true);
  const [needsNextFollowUp, setNeedsNextFollowUp] = useState(true);

  // default date in 3 days
  const defaultNextDate = () => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().split('T')[0];
  };

  const [nextDate, setNextDate] = useState(defaultNextDate());
  const [nextTime, setNextTime] = useState('11:00');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.completeFollowUp(lead.id, {
        customerResponded,
        nextFollowUpDate: needsNextFollowUp ? nextDate : undefined,
        nextFollowUpTime: needsNextFollowUp ? nextTime : undefined,
        note: note.trim() || undefined,
      });
      onFollowUpCompleted();
      onClose();
    } catch (err) {
      console.error('Error completing follow-up:', err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-4 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-[#E6EAE7] dark:border-[#26312E]">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8F5EF] text-[#087F68] flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#18211F] dark:text-white text-sm">
                Follow-Up: {lead.customerName}
              </h3>
              <p className="text-[10px] text-[#6B7470]">{lead.projectType}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleComplete} className="pt-3 space-y-3.5 text-xs sm:text-sm">
          {/* Question 1: Did customer respond? */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Did the customer respond to your follow-up?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustomerResponded(true)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  customerResponded
                    ? 'bg-[#E8F5EF] border-[#087F68] text-[#087F68]'
                    : 'bg-[#F7F8F6] dark:bg-[#202A27] border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470]'
                }`}
              >
                Yes, Responded
              </button>
              <button
                type="button"
                onClick={() => setCustomerResponded(false)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  !customerResponded
                    ? 'bg-[#FEF9EE] border-[#D97706] text-[#D97706]'
                    : 'bg-[#F7F8F6] dark:bg-[#202A27] border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470]'
                }`}
              >
                No Response Yet
              </button>
            </div>
          </div>

          {/* Question 2: Is another follow-up required? */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Is another follow-up needed?
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setNeedsNextFollowUp(true)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  needsNextFollowUp
                    ? 'bg-[#E8F5EF] border-[#087F68] text-[#087F68]'
                    : 'bg-[#F7F8F6] dark:bg-[#202A27] border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470]'
                }`}
              >
                Schedule Next
              </button>
              <button
                type="button"
                onClick={() => setNeedsNextFollowUp(false)}
                className={`py-2 rounded-xl text-xs font-semibold border transition ${
                  !needsNextFollowUp
                    ? 'bg-[#F2F4F2] dark:bg-[#222C28] border-[#18211F] text-[#18211F] dark:text-white font-bold'
                    : 'bg-[#F7F8F6] dark:bg-[#202A27] border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470]'
                }`}
              >
                Mark Complete
              </button>
            </div>
          </div>

          {/* Next follow-up picker */}
          {needsNextFollowUp && (
            <div className="p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl space-y-1.5">
              <div className="flex items-center space-x-1.5 text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA]">
                <Clock className="w-3.5 h-3.5 text-[#087F68]" />
                <span>Next Follow-Up Appointment</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#6B7470] mb-0.5">Date</label>
                  <input
                    type="date"
                    required={needsNextFollowUp}
                    value={nextDate}
                    onChange={e => setNextDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6B7470] mb-0.5">Time</label>
                  <input
                    type="time"
                    value={nextTime}
                    onChange={e => setNextTime(e.target.value)}
                    className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Note */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Add Outcome Note (Optional)
            </label>
            <input
              type="text"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder="e.g. Sent revised PDF quote, reviewing with family"
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 text-xs text-[#6B7470] hover:text-[#18211F]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs"
            >
              {saving ? 'Updating...' : 'Save Follow-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
