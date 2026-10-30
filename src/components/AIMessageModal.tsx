import React, { useState, useEffect } from 'react';
import { Lead, MessagePurpose, MessageTone, MessageLanguage, UserProfile } from '../types';
import { api } from '../services/api';
import { validateAndCleanIndianPhone } from '../utils/calculations';
import { Sparkles, Copy, Check, MessageSquare, RefreshCw, X, AlertCircle, Bookmark, FileText, Calendar, Clock, Send } from 'lucide-react';

interface AIMessageModalProps {
  lead: Lead;
  user: UserProfile | null;
  onClose: () => void;
  onActivityAdded?: () => void;
}

const PURPOSES: MessagePurpose[] = [
  'Quotation follow-up',
  'First enquiry response',
  'Friendly follow-up after no response',
  'Site visit confirmation',
  'Meeting reminder',
  'Budget concern follow-up',
  'Negotiation follow-up',
  'Re-engagement after a long gap',
  'Thank-you after a successful deal',
  'Custom message',
];

const TONES: MessageTone[] = [
  'Friendly',
  'Professional',
  'Polite',
  'Concise',
  'Persuasive without pressure',
];

interface QuickTemplate {
  id: string;
  name: string;
  text: string;
}

export const AIMessageModal: React.FC<AIMessageModalProps> = ({
  lead,
  user,
  onClose,
  onActivityAdded,
}) => {
  const [purpose, setPurpose] = useState<MessagePurpose>('Quotation follow-up');
  const [tone, setTone] = useState<MessageTone>('Friendly');
  const [language, setLanguage] = useState<MessageLanguage>(user?.languagePreference || 'hinglish');
  const [objection, setObjection] = useState<string>('');
  
  const [generatedMessage, setGeneratedMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isFallback, setIsFallback] = useState<boolean>(false);
  const [fallbackReason, setFallbackReason] = useState<string | null>(null);
  const [fallbackNotice, setFallbackNotice] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const [showConfirmSentDialog, setShowConfirmSentDialog] = useState<boolean>(false);
  const [quotaExceeded, setQuotaExceeded] = useState<boolean>(false);

  // Scheduling Email State
  const [showScheduleDialog, setShowScheduleDialog] = useState<boolean>(false);
  const [scheduleDate, setScheduleDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  });
  const [scheduleTime, setScheduleTime] = useState<string>('10:00');
  const [scheduleSubject, setScheduleSubject] = useState<string>(`Follow-up: ${lead.projectType}`);
  const [scheduling, setScheduling] = useState<boolean>(false);
  const [scheduledSuccess, setScheduledSuccess] = useState<boolean>(false);

  const handleConfirmSchedule = async () => {
    if (!generatedMessage.trim()) return;
    setScheduling(true);
    try {
      const scheduledAt = `${scheduleDate} ${scheduleTime}`;
      const payload = JSON.stringify({
        subject: scheduleSubject.trim() || `Follow-up: ${lead.projectType}`,
        body: generatedMessage,
        scheduledAt,
        recipientName: lead.customerName,
        phone: lead.phone,
        status: 'Scheduled',
      });

      await api.addActivity(
        lead.id,
        'scheduled_email',
        payload
      );

      setScheduledSuccess(true);
      if (onActivityAdded) onActivityAdded();
      setTimeout(() => {
        setScheduledSuccess(false);
        setShowScheduleDialog(false);
        onClose();
      }, 1200);
    } catch (err: any) {
      setError(err.message || 'Failed to schedule email');
    } finally {
      setScheduling(false);
    }
  };

  const DEFAULT_TEMPLATES: QuickTemplate[] = [
    {
      id: 'quote-sent',
      name: 'Quote Sent',
      text: `Hi ${lead.customerName}, checking in regarding the quotation sent for your ${lead.projectType} project. Let me know if you have any questions or if you'd like to review any design options!`,
    },
    {
      id: 'meeting-conf',
      name: 'Meeting Confirmation',
      text: `Hi ${lead.customerName}, confirming our upcoming discussion / site visit for your ${lead.projectType}. Looking forward to connecting with you!`,
    },
    {
      id: 'project-inquiry',
      name: 'Project Inquiry',
      text: `Hi ${lead.customerName}, thank you for reaching out to us regarding your ${lead.projectType} project. We would love to discuss your requirements and share our portfolio.`,
    },
  ];

  const [customTemplates, setCustomTemplates] = useState<QuickTemplate[]>(() => {
    try {
      const stored = localStorage.getItem('quoteback_quick_templates');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  });

  const [newTemplateName, setNewTemplateName] = useState('');
  const [showSaveTemplateForm, setShowSaveTemplateForm] = useState(false);

  const allTemplates = [...DEFAULT_TEMPLATES, ...customTemplates];

  const handleApplyTemplate = (template: QuickTemplate) => {
    setGeneratedMessage(template.text);
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!newTemplateName.trim() || !generatedMessage.trim()) return;
    const newItem: QuickTemplate = {
      id: 'custom-' + Date.now(),
      name: newTemplateName.trim(),
      text: generatedMessage,
    };
    const updated = [...customTemplates, newItem];
    setCustomTemplates(updated);
    try {
      localStorage.setItem('quoteback_quick_templates', JSON.stringify(updated));
    } catch {}
    setNewTemplateName('');
    setShowSaveTemplateForm(false);
  };

  const handleDeleteCustomTemplate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    try {
      localStorage.setItem('quoteback_quick_templates', JSON.stringify(updated));
    } catch {}
  };

  const phoneInfo = validateAndCleanIndianPhone(lead.phone);

  const handleGenerate = async () => {
    setLoading(true);
    setError(null);
    setQuotaExceeded(false);

    try {
      // Calculate days since quotation
      let timeSinceQuotation = 'Recently sent';
      if (lead.quotationSentDate) {
        const diffMs = Date.now() - new Date(lead.quotationSentDate).getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        timeSinceQuotation = diffDays > 0 ? `${diffDays} days ago` : 'Sent today';
      }

      const res = await api.generateAIFollowUp({
        customerName: lead.customerName,
        businessName: user?.businessName || 'Our Studio',
        projectType: lead.projectType,
        quotationAmount: lead.quotationAmount || lead.estimatedValue,
        timeSinceQuotation,
        lastActivity: lead.notes || 'Follow-up pending',
        objectionOrConcern: objection || undefined,
        purpose,
        tone,
        language,
        timeZone: user?.timeZone || 'Asia/Kolkata',
      });

      setGeneratedMessage(res.text);
      setIsFallback(res.isFallback);
      setFallbackReason(res.reason || null);
      setFallbackNotice(res.hinglishNotice || null);
      setErrorCode(res.errorCode || null);

      // Record generation draft activity
      await api.addActivity(
        lead.id,
        'ai_message_generated',
        `Generated AI follow-up message in ${language.toUpperCase()} (${purpose})${res.isFallback ? ' [Template fallback]' : ''}`
      );
      if (onActivityAdded) onActivityAdded();
    } catch (err: any) {
      const code = err.errorCode || '';
      let friendlyHinglish = err.message || 'Message generate nahi ho paaya.';

      if (code === 'AI_LIMIT_DAILY' || err.message?.includes('DAILY_AI_LIMIT') || err.message?.includes('30')) {
        setQuotaExceeded(true);
        friendlyHinglish = 'Aaj ka daily AI limit (30 messages) pura ho gaya — kal reset hoga.';
      } else if (code === 'AI_QUOTA') {
        friendlyHinglish = 'AI thoda busy hai — kripya 1 minute baad dobara try karein.';
      } else if (code === 'AI_TIMEOUT') {
        friendlyHinglish = 'AI response timeout ho gaya (20s) — please dobara try karein.';
      } else if (code === 'AI_KEY_MISSING') {
        friendlyHinglish = 'Server par Gemini API key configured nahi hai — template use hua.';
      } else if (code === 'AI_UNAVAILABLE') {
        friendlyHinglish = 'AI service se connect nahi ho pa raha — template use karein.';
      }

      setError(friendlyHinglish);
      setErrorCode(code);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    handleGenerate();
  }, [purpose, tone, language]);

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleOpenWhatsApp = () => {
    if (!phoneInfo.isValid) {
      setError('Please provide a valid 10-digit phone number for WhatsApp.');
      return;
    }

    const encodedText = encodeURIComponent(generatedMessage);
    const whatsappUrl = `https://wa.me/${phoneInfo.whatsAppNumber}?text=${encodedText}`;

    // Open WhatsApp
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer');

    // Prompt user to verify if they sent the message
    setShowConfirmSentDialog(true);
  };

  const handleConfirmSent = async (didSend: boolean) => {
    setShowConfirmSentDialog(false);
    if (didSend) {
      await api.addActivity(
        lead.id,
        'whatsapp_sent_confirmed',
        `Sent follow-up message on WhatsApp to ${lead.customerName}`
      );
      if (onActivityAdded) onActivityAdded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="w-7 h-7 rounded-lg bg-[#E8F5EF] text-[#087F68] flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-[#18211F] dark:text-white text-sm">
                AI Follow-Up Generator
              </h3>
              <p className="text-[10px] text-[#6B7470]">
                For {lead.customerName} ({lead.projectType})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-4 overflow-y-auto space-y-3.5 text-xs sm:text-sm">
          {error && (
            <div className="p-3 bg-[#FDF2F3] dark:bg-[#C83C4B]/15 border border-[#F7D2D6] dark:border-[#C83C4B]/30 rounded-2xl text-[#C83C4B] dark:text-[#F38B95] text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                <span className="font-bold block">{error}</span>
                {errorCode && (
                  <span className="text-[10px] opacity-75 font-mono uppercase tracking-wider block mt-0.5">
                    Error Code: {errorCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {isFallback && !error && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 rounded-2xl text-amber-900 dark:text-amber-200 text-xs flex items-start space-x-2.5 shadow-xs animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="flex-1 min-w-0">
                <span className="font-bold block">
                  AI abhi available nahi — template use hua
                </span>
                <span className="text-[11px] opacity-90 block mt-0.5">
                  {fallbackNotice || fallbackReason || 'Gemini service unreachable. Quick fallback template loaded.'}
                </span>
                {errorCode && (
                  <span className="text-[10px] text-amber-700 dark:text-amber-400 font-mono block mt-0.5">
                    Code: {errorCode}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Quick Config Pickers */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Purpose */}
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Purpose
              </label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value as MessagePurpose)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                {PURPOSES.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Tone */}
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Tone
              </label>
              <select
                value={tone}
                onChange={e => setTone(e.target.value as MessageTone)}
                className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68]"
              >
                {TONES.map(t => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                Language
              </label>
              <div className="grid grid-cols-3 gap-1 bg-[#F2F4F2] dark:bg-[#202A27] p-0.5 rounded-xl">
                {(['en', 'hi', 'hinglish'] as MessageLanguage[]).map(lang => (
                  <button
                    key={lang}
                    type="button"
                    onClick={() => setLanguage(lang)}
                    className={`py-1.5 text-[10px] font-semibold rounded-lg capitalize transition ${
                      language === lang
                        ? 'bg-white dark:bg-[#18211F] text-[#087F68] shadow-xs'
                        : 'text-[#6B7470] hover:text-[#18211F]'
                    }`}
                  >
                    {lang === 'hi' ? 'Hindi' : lang === 'hinglish' ? 'Hinglish' : 'English'}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Optional Concern / Notes */}
          <div>
            <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Customer Concern or Context (Optional)
            </label>
            <input
              type="text"
              value={objection}
              onChange={e => setObjection(e.target.value)}
              placeholder="e.g. Budget concern, comparing with competitor, asking for discount"
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white placeholder:text-[#6B7470]"
            />
          </div>

          {/* Quick Templates Section */}
          <div className="bg-[#F7F8F6] dark:bg-[#202A27]/40 border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] flex items-center space-x-1">
                <Bookmark className="w-3.5 h-3.5 text-[#087F68]" />
                <span>Quick Templates</span>
              </span>
              <button
                type="button"
                onClick={() => setShowSaveTemplateForm(!showSaveTemplateForm)}
                className="text-[10px] font-semibold text-[#087F68] hover:underline"
              >
                {showSaveTemplateForm ? 'Cancel' : '+ Save Current'}
              </button>
            </div>

            {showSaveTemplateForm && (
              <div className="flex items-center space-x-2 pt-1">
                <input
                  type="text"
                  placeholder="Template Name (e.g. Festival Offer)"
                  value={newTemplateName}
                  onChange={e => setNewTemplateName(e.target.value)}
                  className="flex-1 bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl px-2.5 py-1 text-xs text-[#18211F] dark:text-white"
                />
                <button
                  type="button"
                  onClick={handleSaveCurrentAsTemplate}
                  disabled={!newTemplateName.trim() || !generatedMessage.trim()}
                  className="px-3 py-1 bg-[#087F68] text-white font-semibold text-xs rounded-xl disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            )}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {allTemplates.map(tmpl => {
                const isCustom = !DEFAULT_TEMPLATES.some(d => d.id === tmpl.id);
                return (
                  <div
                    key={tmpl.id}
                    onClick={() => handleApplyTemplate(tmpl)}
                    className="group relative inline-flex items-center space-x-1 px-2.5 py-1 rounded-xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] text-[11px] font-medium text-[#18211F] dark:text-[#EAEFEA] hover:border-[#087F68] hover:text-[#087F68] cursor-pointer transition shadow-xs"
                    title={tmpl.text}
                  >
                    <FileText className="w-3 h-3 text-[#6B7470]" />
                    <span>{tmpl.name}</span>
                    {isCustom && (
                      <span
                        onClick={e => handleDeleteCustomTemplate(tmpl.id, e)}
                        className="text-gray-400 hover:text-red-600 ml-1 font-bold text-xs"
                        title="Delete template"
                      >
                        ×
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Editable Output Preview */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] flex items-center space-x-1.5">
                <span>Message Preview (Editable)</span>
                {isFallback && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#F2F4F2] text-[#6B7470]">
                    Template Mode
                  </span>
                )}
                {!isFallback && generatedMessage && (
                  <span className="px-1.5 py-0.2 rounded text-[9px] bg-[#E8F5EF] text-[#087F68] font-bold">
                    Gemini AI
                  </span>
                )}
              </label>
              <button
                type="button"
                onClick={handleGenerate}
                disabled={loading}
                className="text-[#6B7470] hover:text-[#087F68] text-[11px] font-semibold flex items-center space-x-1"
              >
                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                <span>Regenerate</span>
              </button>
            </div>

            <textarea
              rows={5}
              value={generatedMessage}
              onChange={e => setGeneratedMessage(e.target.value)}
              disabled={loading}
              placeholder="Generating personalized message..."
              className="w-full bg-[#F7F8F6] dark:bg-[#202A27]/60 border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-3 text-xs text-[#18211F] dark:text-white focus:ring-1 focus:ring-[#087F68] leading-relaxed font-sans"
            />
          </div>

          {/* Recipient Details & WhatsApp Link Status */}
          <div className="p-2.5 bg-[#F7F8F6] dark:bg-[#202A27]/40 border border-[#E6EAE7] dark:border-[#26312E] rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-[#6B7470]">Recipient: </span>
              <span className="font-bold text-[#18211F] dark:text-white">{lead.customerName}</span>
              <span className="text-[#6B7470] ml-1">({phoneInfo.formattedDisplay})</span>
            </div>
            {!phoneInfo.isValid && (
              <span className="text-[#C83C4B] font-bold text-[10px]">Invalid Phone</span>
            )}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-3.5 border-t border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between gap-2 flex-wrap bg-[#F7F8F6] dark:bg-[#202A27]/60">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!generatedMessage || loading}
            className="px-3 py-2 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#18211F] text-[#18211F] dark:text-[#EAEFEA] font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-[#087F68]" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy'}</span>
          </button>

          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowScheduleDialog(true)}
              disabled={!generatedMessage || loading}
              className="px-3 py-2 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#18211F] hover:bg-[#F2F4F2] dark:hover:bg-[#202A27] text-[#18211F] dark:text-[#EAEFEA] font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition active:scale-95 disabled:opacity-50 cursor-pointer"
            >
              <Calendar className="w-3.5 h-3.5 text-[#087F68]" />
              <span>Schedule Email</span>
            </button>

            <button
              type="button"
              onClick={handleOpenWhatsApp}
              disabled={!generatedMessage || loading || !phoneInfo.isValid}
              className="px-3.5 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] disabled:opacity-50 text-white font-semibold text-xs flex items-center space-x-1.5 shadow-xs transition active:scale-95 cursor-pointer"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>WhatsApp</span>
            </button>
          </div>
        </div>

        {/* Schedule Email Dialog Overlay */}
        {showScheduleDialog && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-sm w-full p-4 border border-[#E6EAE7] dark:border-[#26312E] shadow-2xl space-y-3">
              <div className="flex items-center justify-between border-b border-[#E6EAE7] dark:border-[#26312E] pb-2.5">
                <div className="flex items-center space-x-2">
                  <div className="w-7 h-7 rounded-lg bg-[#E8F5EF] text-[#087F68] flex items-center justify-center">
                    <Calendar className="w-4 h-4" />
                  </div>
                  <h4 className="font-bold text-[#18211F] dark:text-white text-sm">
                    Schedule Email Communication
                  </h4>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScheduleDialog(false)}
                  className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {scheduledSuccess ? (
                <div className="p-4 text-center space-y-2">
                  <div className="w-10 h-10 rounded-full bg-[#E8F5EF] text-[#087F68] mx-auto flex items-center justify-center">
                    <Check className="w-5 h-5" />
                  </div>
                  <p className="font-bold text-xs text-[#087F68]">Email Scheduled Successfully!</p>
                  <p className="text-[11px] text-[#6B7470]">
                    Logged in {lead.customerName}&apos;s activity timeline for {scheduleDate} at {scheduleTime}.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5 text-xs">
                  <div>
                    <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                      Subject
                    </label>
                    <input
                      type="text"
                      value={scheduleSubject}
                      onChange={e => setScheduleSubject(e.target.value)}
                      placeholder="e.g. Revised Quotation for Kitchen Renovation"
                      className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                        Date
                      </label>
                      <input
                        type="date"
                        value={scheduleDate}
                        onChange={e => setScheduleDate(e.target.value)}
                        className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                        Time
                      </label>
                      <input
                        type="time"
                        value={scheduleTime}
                        onChange={e => setScheduleTime(e.target.value)}
                        className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="p-2 bg-[#F7F8F6] dark:bg-[#202A27]/50 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] text-[10px] text-[#6B7470]">
                    <span className="font-bold text-[#18211F] dark:text-white block mb-0.5">
                      Recipient: {lead.customerName}
                    </span>
                    Message preview will be stored in pending communications and tracked on the lead timeline.
                  </div>

                  <div className="flex items-center justify-end space-x-2 pt-1">
                    <button
                      type="button"
                      onClick={() => setShowScheduleDialog(false)}
                      className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs text-[#6B7470]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmSchedule}
                      disabled={scheduling}
                      className="px-4 py-1.5 rounded-xl bg-[#087F68] text-white text-xs font-bold shadow-xs flex items-center space-x-1"
                    >
                      {scheduling ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
                      <span>Confirm & Schedule</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Confirmation Dialog */}
        {showConfirmSentDialog && (
          <div className="absolute inset-0 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 z-50">
            <div className="bg-white dark:bg-[#18211F] rounded-2xl max-w-sm w-full p-4 border border-[#E6EAE7] dark:border-[#26312E] shadow-2xl text-center space-y-2.5">
              <div className="w-9 h-9 rounded-full bg-[#E8F5EF] text-[#087F68] mx-auto flex items-center justify-center">
                <MessageSquare className="w-4 h-4" />
              </div>
              <h4 className="font-bold text-[#18211F] dark:text-white text-sm">
                Did you send the message?
              </h4>
              <p className="text-xs text-[#6B7470]">
                WhatsApp was opened with your message prefilled. Confirming will log this follow-up interaction in {lead.customerName}&apos;s activity history.
              </p>
              <div className="flex items-center justify-center space-x-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleConfirmSent(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs text-[#6B7470]"
                >
                  Not Yet
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmSent(true)}
                  className="px-4 py-1.5 rounded-xl bg-[#087F68] text-white text-xs font-bold"
                >
                  Yes, Log Sent
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
