import React, { useState } from 'react';
import { Lead, LeadSource, ProjectType, LeadStage, LeadPriority } from '../types';
import { validateAndCleanIndianPhone } from '../utils/calculations';
import { X, AlertTriangle } from 'lucide-react';

interface LeadModalProps {
  initialLead?: Lead | null;
  existingLeads: Lead[];
  onClose: () => void;
  onSave: (leadData: Partial<Lead>) => Promise<void>;
}

const SOURCES: LeadSource[] = ['WhatsApp', 'Instagram', 'Phone Call', 'Website', 'Referral', 'Walk-in', 'Other'];
const PROJECT_TYPES: ProjectType[] = ['Interior Design', 'Modular Kitchen', 'Renovation', 'Furniture', 'Turnkey Project', 'Architecture', 'Other'];
const STAGES: LeadStage[] = ['New', 'Contacted', 'Site Visit Scheduled', 'Quotation Sent', 'Negotiation', 'Won', 'Lost'];

export const LeadModal: React.FC<LeadModalProps> = ({
  initialLead,
  existingLeads,
  onClose,
  onSave,
}) => {
  const isEditing = Boolean(initialLead);

  const [customerName, setCustomerName] = useState(initialLead?.customerName || '');
  const [phone, setPhone] = useState(initialLead?.phone || '');
  const [source, setSource] = useState<LeadSource>((initialLead?.source as LeadSource) || 'WhatsApp');
  const [projectType, setProjectType] = useState<ProjectType>((initialLead?.projectType as ProjectType) || 'Interior Design');
  const [estimatedValue, setEstimatedValue] = useState<string>(initialLead?.estimatedValue ? String(initialLead.estimatedValue) : '');
  const [quotationAmount, setQuotationAmount] = useState<string>(initialLead?.quotationAmount ? String(initialLead.quotationAmount) : '');
  const [stage, setStage] = useState<LeadStage>(initialLead?.stage || 'New');
  const [priority, setPriority] = useState<LeadPriority>(initialLead?.priority || 'Medium');
  const [tags, setTags] = useState<string[]>(initialLead?.tags || []);
  const [tagInput, setTagInput] = useState('');
  
  // Follow-up defaults: tomorrow at 11:00 AM if not set
  const defaultFollowUp = () => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  };

  const [nextFollowUpDate, setNextFollowUpDate] = useState(initialLead?.nextFollowUpDate || defaultFollowUp());
  const [nextFollowUpTime, setNextFollowUpTime] = useState(initialLead?.nextFollowUpTime || '11:00');
  const [notes, setNotes] = useState(initialLead?.notes || '');
  const [lossReason, setLossReason] = useState(initialLead?.lossReason || '');

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Phone validation check
  const phoneValidation = validateAndCleanIndianPhone(phone);

  // Check for duplicate phone among other leads
  const duplicateLead = existingLeads.find(
    l => l.id !== initialLead?.id && validateAndCleanIndianPhone(l.phone).cleaned === phoneValidation.cleaned && phoneValidation.cleaned.length > 5
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      setError('Customer name is required');
      return;
    }

    if (!phone.trim()) {
      setError('Phone number is required');
      return;
    }

    if (!phoneValidation.isValid) {
      setError('Please enter a valid 10-digit Indian phone number or valid international number');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave({
        customerName: customerName.trim(),
        phone: phoneValidation.cleaned,
        source,
        projectType,
        estimatedValue: Number(estimatedValue) || 0,
        quotationAmount: quotationAmount ? Number(quotationAmount) : undefined,
        stage,
        priority,
        tags,
        nextFollowUpDate: stage === 'Won' || stage === 'Lost' ? undefined : nextFollowUpDate,
        nextFollowUpTime: stage === 'Won' || stage === 'Lost' ? undefined : nextFollowUpTime,
        notes: notes.trim(),
        lossReason: stage === 'Lost' ? lossReason : undefined,
      });
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to save lead');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between">
          <h3 className="font-bold text-[#18211F] dark:text-white text-sm sm:text-base">
            {isEditing ? 'Edit Enquiry Details' : 'Add New Customer Enquiry'}
          </h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
          {error && (
            <div className="p-2.5 bg-[#FDF2F3] border border-[#F7D2D6] rounded-xl text-[#C83C4B] text-xs">
              {error}
            </div>
          )}

          {/* Customer Name */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Customer Name <span className="text-[#C83C4B]">*</span>
            </label>
            <input
              type="text"
              required
              value={customerName}
              onChange={e => setCustomerName(e.target.value)}
              placeholder="e.g. Vikram Malhotra / Sunita Verma"
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
            />
          </div>

          {/* Phone Number & India Validation */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA]">
                Phone Number (WhatsApp) <span className="text-[#C83C4B]">*</span>
              </label>
              {phone && phoneValidation.isValid && (
                <span className="text-[10px] text-[#087F68] font-bold">
                  {phoneValidation.formattedDisplay}
                </span>
              )}
            </div>
            <input
              type="tel"
              required
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9820198201 or +91 98201 98201"
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
            />
            {duplicateLead && (
              <div className="mt-1.5 p-2 bg-[#FEF9EE] border border-[#FDE6B8] rounded-lg flex items-center space-x-1.5 text-[#D97706] text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 text-[#D97706] shrink-0" />
                <span>Notice: Existing lead found with this number ({duplicateLead.customerName}).</span>
              </div>
            )}
          </div>

          {/* Source & Project Type */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Enquiry Source
              </label>
              <select
                value={source}
                onChange={e => setSource(e.target.value as LeadSource)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                {SOURCES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Project Category
              </label>
              <select
                value={projectType}
                onChange={e => setProjectType(e.target.value as ProjectType)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                {PROJECT_TYPES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Estimated Value & Quotation Amount in INR */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Estimated Deal Value (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={estimatedValue}
                onChange={e => setEstimatedValue(e.target.value)}
                placeholder="e.g. 500000"
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              />
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Quotation Amount (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1000"
                value={quotationAmount}
                onChange={e => setQuotationAmount(e.target.value)}
                placeholder="e.g. 450000"
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              />
            </div>
          </div>

          {/* Pipeline Stage & Priority */}
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Sales Stage
              </label>
              <select
                value={stage}
                onChange={e => setStage(e.target.value as LeadStage)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                {STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Priority Level
              </label>
              <select
                value={priority}
                onChange={e => setPriority(e.target.value as LeadPriority)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                <option value="High">🔴 High Priority</option>
                <option value="Medium">🟡 Medium Priority</option>
                <option value="Low">🟢 Low Priority</option>
              </select>
            </div>
          </div>

          {/* Tags Manager */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Custom Tags (Kitchen, Renovation, Commercial, etc.)
            </label>
            <div className="flex gap-1.5 mb-1.5">
              <input
                type="text"
                value={tagInput}
                onChange={e => setTagInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    const trimmed = tagInput.trim();
                    if (trimmed && !tags.includes(trimmed)) {
                      setTags([...tags, trimmed]);
                      setTagInput('');
                    }
                  }
                }}
                placeholder="Type tag & press enter..."
                className="flex-1 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white placeholder:text-[#6B7470]"
              />
              <button
                type="button"
                onClick={() => {
                  const trimmed = tagInput.trim();
                  if (trimmed && !tags.includes(trimmed)) {
                    setTags([...tags, trimmed]);
                    setTagInput('');
                  }
                }}
                className="px-3 py-2 bg-[#087F68] hover:bg-[#066956] text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                Add
              </button>
            </div>

            {/* Quick Suggestion Tags */}
            <div className="flex flex-wrap gap-1 mb-1.5">
              {['Kitchen', 'Renovation', 'Commercial', 'Turnkey', 'Wardrobe', 'Villas'].map(suggest => {
                const isSelected = tags.includes(suggest);
                return (
                  <button
                    key={suggest}
                    type="button"
                    onClick={() => {
                      if (!isSelected) {
                        setTags([...tags, suggest]);
                      } else {
                        setTags(tags.filter(t => t !== suggest));
                      }
                    }}
                    className={`px-2 py-0.5 rounded-lg text-[10px] font-medium transition cursor-pointer ${
                      isSelected
                        ? 'bg-[#087F68] text-white font-bold'
                        : 'bg-[#F2F4F2] dark:bg-[#202A27] text-[#6B7470] dark:text-[#A1ACA6] hover:bg-[#E6EAE7]'
                    }`}
                  >
                    {isSelected ? '✓ ' : '+ '}{suggest}
                  </button>
                );
              })}
            </div>

            {/* Active Tags Display */}
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {tags.map(t => (
                  <span
                    key={t}
                    className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-lg bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] text-[11px] font-medium border border-[#CBE7DC] dark:border-[#087F68]/30"
                  >
                    <span>{t}</span>
                    <button
                      type="button"
                      onClick={() => setTags(tags.filter(item => item !== t))}
                      className="hover:text-[#C83C4B] transition"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Loss Reason (if marked Lost) */}
          {stage === 'Lost' && (
            <div>
              <label className="block text-[11px] font-semibold text-[#C83C4B] mb-1">
                Reason for Lost Deal
              </label>
              <select
                value={lossReason}
                onChange={e => setLossReason(e.target.value)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                <option value="">Select a reason</option>
                <option value="Budget too high / Quote exceeded expectations">Budget too high / Quote exceeded expectations</option>
                <option value="Went with competitor">Went with competitor</option>
                <option value="Postponed / cancelled project">Postponed / cancelled project</option>
                <option value="No response after multiple follow-ups">No response after multiple follow-ups</option>
                <option value="Scope or design mismatch">Scope or design mismatch</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}

          {/* Next Follow-Up Schedule (if not Won/Lost) */}
          {stage !== 'Won' && stage !== 'Lost' && (
            <div className="p-3 bg-[#E8F5EF] dark:bg-[#087F68]/15 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-xl space-y-2">
              <span className="text-[11px] font-bold text-[#087F68]">
                Next Follow-Up Appointment
              </span>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[10px] text-[#6B7470] mb-0.5">Date</label>
                  <input
                    type="date"
                    value={nextFollowUpDate}
                    onChange={e => setNextFollowUpDate(e.target.value)}
                    className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-[#6B7470] mb-0.5">Time</label>
                  <input
                    type="time"
                    value={nextFollowUpTime}
                    onChange={e => setNextFollowUpTime(e.target.value)}
                    className="w-full bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-lg p-1.5 text-xs text-[#18211F] dark:text-white"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Project Notes & Client Requirements
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. 3BHK flat in Whitefield. Likes acrylic kitchen finish with pantry pull-out. Sent quote for ₹4.5L."
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
            />
          </div>

          {/* Submit & Cancel Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl text-xs text-[#6B7470] hover:text-[#18211F] transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] disabled:opacity-50 text-white font-bold text-xs shadow-xs transition active:scale-95"
            >
              {saving ? 'Saving...' : isEditing ? 'Update Lead' : 'Save Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
