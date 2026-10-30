import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Sparkles,
  X,
  Send,
  Mic,
  MicOff,
  Copy,
  Check,
  RotateCcw,
  Trash2,
  Square,
  AlertTriangle,
  ArrowRight,
  Calendar,
  CheckCircle2,
  Clock,
  FileText,
  MessageSquare,
  ExternalLink,
  ShieldCheck,
  Tag,
} from 'lucide-react';
import { Lead, UserProfile, ChatMessage, ProposedAction, LeadStage } from '../types';
import { buildChatContextSnapshot } from '../utils/chatContext';
import { api } from '../services/api';

interface AskQuoteBackModalProps {
  user: UserProfile | null;
  leads: Lead[];
  onClose: () => void;
  onLeadUpdated: () => void;
}

const SUGGESTION_CHIPS = [
  'Aaj kis ko follow-up karna hai?',
  'Is mahine ka summary',
  'Sabse zyada pending quotation kiska hai?',
  'Price objection ka reply likho',
];

export const AskQuoteBackModal: React.FC<AskQuoteBackModalProps> = ({
  user,
  leads,
  onClose,
  onLeadUpdated,
}) => {
  const sessionKey = user?.id ? `quoteback_chat_${user.id}` : 'quoteback_chat_guest';

  // Load chat history from sessionStorage
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch {}
    return [];
  });

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionSuccessNotice, setActionSuccessNotice] = useState<string | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [speechSupported, setSpeechSupported] = useState(false);

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<any>(null);

  // Sync to sessionStorage
  useEffect(() => {
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(messages));
    } catch {}
  }, [messages, sessionKey]);

  // Auto-scroll on new message or stream chunk
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isStreaming]);

  // Check Web Speech API support
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (SpeechRecognition) {
      setSpeechSupported(true);
      try {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.lang = user?.languagePreference === 'hi' ? 'hi-IN' : 'en-IN';

        recognition.onresult = (event: any) => {
          let transcript = '';
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          if (transcript) {
            setInput(prev => (prev ? `${prev} ${transcript}` : transcript));
          }
        };

        recognition.onerror = () => {
          setIsListening(false);
        };

        recognition.onend = () => {
          setIsListening(false);
        };

        recognitionRef.current = recognition;
      } catch {
        setSpeechSupported(false);
      }
    }
  }, [user]);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) return;
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.lang = user?.languagePreference === 'hi' ? 'hi-IN' : 'en-IN';
        recognitionRef.current.start();
        setIsListening(true);
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleClearChat = () => {
    if (isStreaming && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setMessages([]);
    try {
      sessionStorage.removeItem(sessionKey);
    } catch {}
  };

  const handleStopStream = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsStreaming(false);
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || input).trim();
    if (!prompt || isStreaming) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }

    const userMessageId = `msg_${Date.now()}_user`;
    const assistantMessageId = `msg_${Date.now()}_assistant`;

    const userMsg: ChatMessage = {
      id: userMessageId,
      role: 'user',
      text: prompt,
      timestamp: new Date().toISOString(),
    };

    const initialAssistantMsg: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      text: '',
      timestamp: new Date().toISOString(),
    };

    const updatedMessages = [...messages, userMsg, initialAssistantMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      // Build client-side sanitized context snapshot (No phone, No email)
      const contextSnapshot = buildChatContextSnapshot(user, leads);

      // Prepare conversation history (up to last 6 turns)
      const history = messages.slice(-6).map(m => ({
        role: m.role,
        text: m.text,
      }));

      let accumulated = '';
      let receivedActions: ProposedAction[] = [];

      const result = await api.sendChatMessage({
        message: prompt,
        context: contextSnapshot,
        history,
        signal: controller.signal,
        onChunk: chunk => {
          accumulated += chunk;
          setMessages(prev =>
            prev.map(m => (m.id === assistantMessageId ? { ...m, text: accumulated } : m))
          );
        },
        onActions: actions => {
          receivedActions = actions;
          setMessages(prev =>
            prev.map(m => (m.id === assistantMessageId ? { ...m, actions } : m))
          );
        },
      });

      // Finalize assistant message
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMessageId
            ? {
                ...m,
                text: result.text || accumulated,
                actions: result.actions?.length ? result.actions : receivedActions,
                errorCode: result.errorCode,
              }
            : m
        )
      );
    } catch (err: any) {
      if (err.name === 'AbortError') {
        // Stream aborted by user
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? { ...m, text: m.text || 'Generation stopped.' }
              : m
          )
        );
      } else {
        const code = err.errorCode || 'AI_UNAVAILABLE';
        let fallbackText = 'Maaf kijiye, abhi response generate nahi ho paya.';
        if (code === 'AI_KEY_MISSING') {
          fallbackText = 'Gemini API key is not configured on the server. Please check Settings.';
        } else if (code === 'AI_QUOTA') {
          fallbackText = 'AI limit thodi der ke liye reach ho gayi hai. Kripya 1 minute baad try karein.';
        } else if (code === 'AI_LIMIT_DAILY') {
          fallbackText = 'Aaj ka chat limit (40 messages) pura ho gaya hai. Kal reset hoga.';
        } else if (code === 'AI_TIMEOUT') {
          fallbackText = 'AI response time out ho gaya (20 seconds). Kripya dobara try karein.';
        }

        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMessageId
              ? {
                  ...m,
                  text: fallbackText,
                  error: err.message,
                  errorCode: code,
                  isFallback: true,
                }
              : m
          )
        );
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Find lead client-side to look up phone number for WhatsApp
  const findLeadClientSide = (leadId: string): Lead | undefined => {
    return leads.find(l => l.id === leadId);
  };

  const handleOpenWhatsAppDraft = (leadId: string, draftText: string) => {
    const lead = findLeadClientSide(leadId);
    if (!lead || !lead.phone) {
      alert('Could not locate customer phone number for this lead.');
      return;
    }
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '');
    const waPhone = cleanPhone.length === 10 ? `91${cleanPhone}` : cleanPhone;
    const url = `https://wa.me/${waPhone}?text=${encodeURIComponent(draftText)}`;
    window.open(url, '_blank');
  };

  // Action execution (Zero backend modifications: uses existing client api methods)
  const handleConfirmAction = async (msgId: string, action: ProposedAction) => {
    try {
      const targetLead = findLeadClientSide(action.leadId);
      const leadName = targetLead?.customerName || 'Lead';

      if (action.type === 'update_stage' && action.stage) {
        await api.updateLead(action.leadId, { stage: action.stage as LeadStage });
        setActionSuccessNotice(`Stage updated to "${action.stage}" for ${leadName}`);
      } else if (action.type === 'schedule_followup' && action.date) {
        await api.updateLead(action.leadId, {
          nextFollowUpDate: action.date,
          nextFollowUpTime: action.time || '11:00',
          followUpCompleted: false,
        });
        await api.addActivity(
          action.leadId,
          'followup_rescheduled',
          `Follow-up scheduled for ${action.date} at ${action.time || '11:00'} via Ask QuoteBack`
        );
        setActionSuccessNotice(`Follow-up scheduled on ${action.date} for ${leadName}`);
      } else if (action.type === 'add_note' && action.note) {
        await api.addActivity(action.leadId, 'note', action.note);
        setActionSuccessNotice(`Note added to ${leadName}`);
      } else if (action.type === 'draft_message' && action.text) {
        handleOpenWhatsAppDraft(action.leadId, action.text);
      }

      // Mark action confirmed in state
      setMessages(prev =>
        prev.map(m => {
          if (m.id !== msgId || !m.actions) return m;
          return {
            ...m,
            actions: m.actions.map(a =>
              a.id === action.id ? { ...a, status: 'confirmed' } : a
            ),
          };
        })
      );

      onLeadUpdated();
      setTimeout(() => setActionSuccessNotice(null), 4000);
    } catch (err: any) {
      alert(`Action failed: ${err.message || 'Please try again.'}`);
    }
  };

  const handleDismissAction = (msgId: string, actionId?: string) => {
    setMessages(prev =>
      prev.map(m => {
        if (m.id !== msgId || !m.actions) return m;
        return {
          ...m,
          actions: m.actions.map(a =>
            a.id === actionId ? { ...a, status: 'dismissed' } : a
          ),
        };
      })
    );
  };

  // Simple Markdown Renderer (Bold, Bullets, Linebreaks)
  const renderFormattedMarkdown = (content: string) => {
    const lines = content.split('\n');
    return lines.map((line, idx) => {
      const trimmed = line.trim();
      const isBullet = trimmed.startsWith('* ') || trimmed.startsWith('- ');
      const textToParse = isBullet ? trimmed.substring(2) : line;

      // Parse bold **text**
      const parts = textToParse.split(/(\*\*.*?\*\*)/g);
      const formattedParts = parts.map((part, pIdx) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <strong key={pIdx} className="font-bold text-[#18211F] dark:text-white">
              {part.slice(2, -2)}
            </strong>
          );
        }
        return part;
      });

      if (isBullet) {
        return (
          <li key={idx} className="ml-4 list-disc my-0.5 leading-relaxed">
            {formattedParts}
          </li>
        );
      }

      if (!trimmed) {
        return <div key={idx} className="h-2" />;
      }

      return (
        <p key={idx} className="my-1 leading-relaxed">
          {formattedParts}
        </p>
      );
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end sm:justify-center items-center p-0 sm:p-4">
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        className="w-full max-w-2xl h-[92vh] sm:h-[85vh] bg-white dark:bg-[#18211F] rounded-t-3xl sm:rounded-3xl shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] flex flex-col overflow-hidden"
      >
        {/* Header Bar */}
        <div className="px-4 py-3 border-b border-[#E6EAE7] dark:border-[#26312E] bg-white/80 dark:bg-[#18211F]/80 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#087F68] to-[#12A588] text-white flex items-center justify-center shadow-xs">
              <Sparkles className="w-4 h-4 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h2 className="text-sm font-bold text-[#18211F] dark:text-white">
                  Ask QuoteBack
                </h2>
                <span className="px-1.5 py-0.2 bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] rounded-full text-[10px] font-bold">
                  AI
                </span>
              </div>
              <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">
                {user?.businessName || 'Interior Studio'} • Sales & Quotation Coach
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-1">
            {messages.length > 0 && (
              <>
                <button
                  onClick={handleClearChat}
                  title="New conversation"
                  aria-label="New conversation"
                  className="p-1.5 rounded-xl hover:bg-[#F4F6F4] dark:hover:bg-[#222C28] text-[#6B7470] dark:text-[#9BA5A0] transition cursor-pointer"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button
                  onClick={handleClearChat}
                  title="Clear chat history"
                  aria-label="Clear chat"
                  className="p-1.5 rounded-xl hover:bg-[#FDF2F3] text-[#6B7470] hover:text-[#C83C4B] transition cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              aria-label="Close Ask QuoteBack"
              className="p-1.5 rounded-xl hover:bg-[#F4F6F4] dark:hover:bg-[#222C28] text-[#6B7470] dark:text-[#9BA5A0] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Global Action Confirmation Toast */}
        <AnimatePresence>
          {actionSuccessNotice && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-[#E8F5EF] dark:bg-[#087F68]/20 border-b border-[#087F68]/30 px-4 py-2 flex items-center justify-between text-xs text-[#087F68] dark:text-[#38D6AB] font-semibold"
            >
              <div className="flex items-center space-x-1.5 truncate">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="truncate">{actionSuccessNotice}</span>
              </div>
              <button
                onClick={() => setActionSuccessNotice(null)}
                className="text-[11px] opacity-70 hover:opacity-100 ml-2"
              >
                Dismiss
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Messages Scroll Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            /* Empty State */
            <div className="h-full flex flex-col justify-center items-center text-center px-4 py-6">
              <div className="w-14 h-14 rounded-2xl bg-[#E8F5EF] dark:bg-[#087F68]/15 text-[#087F68] dark:text-[#38D6AB] flex items-center justify-center mb-3 shadow-xs">
                <Sparkles className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-[#18211F] dark:text-white mb-1">
                Namaste {user?.name?.split(' ')[0] || user?.businessName || 'Partner'}!
              </h3>
              <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] max-w-sm mb-6 leading-relaxed">
                Mai aapka QuoteBack AI sales assistant hoon. Quotations follow-up, pending leads, ya revenue analysis ke bare me kuch bhi poochhein.
              </p>

              {/* Suggestion Chips */}
              <div className="w-full max-w-md space-y-2">
                <p className="text-[11px] font-bold text-[#6B7470] dark:text-[#9BA5A0] text-left uppercase tracking-wider">
                  Quick Questions
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SUGGESTION_CHIPS.map((chip, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleSendMessage(chip)}
                      className="p-3 text-left rounded-2xl border border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#202A27] hover:border-[#087F68] dark:hover:border-[#087F68] hover:bg-[#F4F9F6] dark:hover:bg-[#1C2623] transition text-xs font-semibold text-[#18211F] dark:text-[#D5DDD8] flex items-center justify-between group shadow-xs cursor-pointer"
                    >
                      <span className="truncate pr-2">{chip}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-[#087F68] opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 transition shrink-0" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* Message List */
            messages.map(msg => (
              <div
                key={msg.id}
                className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[85%] sm:max-w-[78%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#087F68] text-white rounded-tr-xs shadow-xs'
                      : 'bg-[#F4F6F4] dark:bg-[#202A27] text-[#18211F] dark:text-[#D5DDD8] rounded-tl-xs border border-[#E6EAE7] dark:border-[#2B3733]'
                  }`}
                >
                  {/* Assistant response body */}
                  {msg.role === 'assistant' ? (
                    <div>
                      {renderFormattedMarkdown(msg.text || (isStreaming ? 'Thinking...' : ''))}

                      {/* Error or Fallback Warning */}
                      {msg.errorCode && (
                        <div className="mt-2.5 p-2 rounded-xl bg-[#FDF2F3] dark:bg-[#C83C4B]/15 border border-[#F7D2D6] dark:border-[#C83C4B]/30 text-[#C83C4B] dark:text-[#F38B95] flex items-center justify-between">
                          <div className="flex items-center space-x-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span className="text-[11px] font-semibold">
                              Code: {msg.errorCode}
                            </span>
                          </div>
                          <button
                            onClick={() => handleSendMessage(messages[messages.length - 2]?.text)}
                            className="text-[10px] font-bold underline hover:opacity-80"
                          >
                            Retry
                          </button>
                        </div>
                      )}

                      {/* Message actions footer */}
                      {msg.text && (
                        <div className="mt-2 pt-2 border-t border-[#E6EAE7]/60 dark:border-[#2B3733]/60 flex items-center justify-between text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">
                          <span className="text-[10px] opacity-75">
                            {new Date(msg.timestamp).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                          <button
                            onClick={() => handleCopy(msg.text, msg.id)}
                            className="flex items-center space-x-1 hover:text-[#087F68] dark:hover:text-[#38D6AB] transition cursor-pointer"
                          >
                            {copiedId === msg.id ? (
                              <>
                                <Check className="w-3 h-3 text-[#087F68]" />
                                <span className="text-[#087F68] font-bold">Copied</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3" />
                                <span>Copy</span>
                              </>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  ) : (
                    /* User message */
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  )}
                </div>

                {/* Proposed Actions Cards */}
                {msg.actions && msg.actions.length > 0 && (
                  <div className="mt-2 w-full max-w-[85%] sm:max-w-[78%] space-y-2">
                    {msg.actions.map(action => {
                      const targetLead = findLeadClientSide(action.leadId);
                      const isConfirmed = action.status === 'confirmed';
                      const isDismissed = action.status === 'dismissed';

                      if (isDismissed) return null;

                      return (
                        <div
                          key={action.id}
                          className={`p-3 rounded-2xl border text-xs transition ${
                            isConfirmed
                              ? 'bg-[#E8F5EF] dark:bg-[#087F68]/15 border-[#087F68]/30 text-[#087F68] dark:text-[#38D6AB]'
                              : 'bg-white dark:bg-[#1D2623] border-[#087F68]/30 shadow-xs'
                          }`}
                        >
                          <div className="flex items-start justify-between">
                            <div className="flex items-center space-x-1.5 font-bold text-[#18211F] dark:text-white">
                              {action.type === 'update_stage' && <Tag className="w-3.5 h-3.5 text-[#087F68]" />}
                              {action.type === 'schedule_followup' && <Calendar className="w-3.5 h-3.5 text-[#087F68]" />}
                              {action.type === 'add_note' && <FileText className="w-3.5 h-3.5 text-[#087F68]" />}
                              {action.type === 'draft_message' && <MessageSquare className="w-3.5 h-3.5 text-[#087F68]" />}
                              <span className="capitalize">
                                {action.type.replace('_', ' ')}: {targetLead?.customerName || 'Lead'}
                              </span>
                            </div>

                            {isConfirmed ? (
                              <span className="flex items-center space-x-1 text-[10px] font-bold text-[#087F68] dark:text-[#38D6AB]">
                                <Check className="w-3 h-3" />
                                <span>Confirmed</span>
                              </span>
                            ) : null}
                          </div>

                          <div className="mt-1.5 text-[#6B7470] dark:text-[#9BA5A0]">
                            {action.type === 'update_stage' && (
                              <p>
                                Change stage to <span className="font-bold text-[#18211F] dark:text-white">"{action.stage}"</span>
                              </p>
                            )}
                            {action.type === 'schedule_followup' && (
                              <p>
                                Schedule follow-up for{' '}
                                <span className="font-bold text-[#18211F] dark:text-white">
                                  {action.date} at {action.time || '11:00'}
                                </span>
                              </p>
                            )}
                            {action.type === 'add_note' && (
                              <p className="italic">"{action.note}"</p>
                            )}
                            {action.type === 'draft_message' && (
                              <div className="mt-1 p-2 bg-[#F7F8F6] dark:bg-[#151D1A] rounded-xl text-[11px] font-sans border border-[#E6EAE7] dark:border-[#28332F]">
                                "{action.text}"
                              </div>
                            )}
                          </div>

                          {/* Action Button Row */}
                          {!isConfirmed && (
                            <div className="mt-2.5 flex items-center justify-end space-x-2">
                              {action.type === 'draft_message' ? (
                                <button
                                  type="button"
                                  onClick={() => handleConfirmAction(msg.id, action)}
                                  className="px-3 py-1.5 rounded-xl bg-[#25D366] hover:bg-[#20BA5A] text-white text-[11px] font-bold flex items-center space-x-1 shadow-xs cursor-pointer"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                  <span>Send on WhatsApp</span>
                                </button>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDismissAction(msg.id, action.id)}
                                    className="px-2.5 py-1 rounded-xl border border-[#E6EAE7] dark:border-[#2B3733] text-[11px] font-semibold text-[#6B7470] hover:text-[#18211F] cursor-pointer"
                                  >
                                    Dismiss
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleConfirmAction(msg.id, action)}
                                    className="px-3 py-1 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white text-[11px] font-bold shadow-xs flex items-center space-x-1 cursor-pointer"
                                  >
                                    <Check className="w-3 h-3" />
                                    <span>Confirm</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))
          )}

          {/* Typing Indicator */}
          {isStreaming && (
            <div className="flex items-center space-x-2 text-xs text-[#6B7470] dark:text-[#9BA5A0] pt-1">
              <div className="w-2 h-2 rounded-full bg-[#087F68] animate-bounce" />
              <div
                className="w-2 h-2 rounded-full bg-[#087F68] animate-bounce"
                style={{ animationDelay: '0.2s' }}
              />
              <div
                className="w-2 h-2 rounded-full bg-[#087F68] animate-bounce"
                style={{ animationDelay: '0.4s' }}
              />
              <span className="text-[11px] font-semibold ml-1">Analyzing pipeline...</span>
              <button
                onClick={handleStopStream}
                className="ml-2 px-2 py-0.5 rounded-lg border border-[#C83C4B]/40 text-[#C83C4B] text-[10px] font-bold hover:bg-[#FDF2F3] flex items-center space-x-1 cursor-pointer"
              >
                <Square className="w-2.5 h-2.5 fill-current" />
                <span>Stop</span>
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar & Footer */}
        <div className="p-3 border-t border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#18211F]">
          <form
            onSubmit={e => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center space-x-1.5"
          >
            {/* Voice Input Button (Web Speech API) */}
            {speechSupported && (
              <button
                type="button"
                onClick={toggleVoiceInput}
                title={isListening ? 'Listening... click to stop' : 'Voice input (Hindi/English)'}
                className={`p-2.5 rounded-2xl transition cursor-pointer ${
                  isListening
                    ? 'bg-[#C83C4B] text-white animate-pulse'
                    : 'bg-[#F4F6F4] dark:bg-[#202A27] text-[#6B7470] hover:text-[#087F68]'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>
            )}

            {/* Message input */}
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder={isListening ? 'Listening...' : 'Poochhein (e.g. Aaj kis ko call karna hai?)...'}
              disabled={isStreaming}
              className="flex-1 px-3.5 py-2.5 rounded-2xl bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] text-xs text-[#18211F] dark:text-white placeholder-[#9BA5A0] focus:outline-none focus:ring-2 focus:ring-[#087F68]/30 disabled:opacity-60"
            />

            {/* Send or Stop */}
            {isStreaming ? (
              <button
                type="button"
                onClick={handleStopStream}
                className="p-2.5 rounded-2xl bg-[#C83C4B] hover:bg-[#B03340] text-white shadow-xs transition cursor-pointer"
              >
                <Square className="w-4 h-4 fill-current" />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className="p-2.5 rounded-2xl bg-[#087F68] hover:bg-[#066956] text-white shadow-xs transition disabled:opacity-40 cursor-pointer"
              >
                <Send className="w-4 h-4" />
              </button>
            )}
          </form>

          {/* Privacy & Trust Footnote */}
          <div className="mt-2 flex items-center justify-center space-x-1 text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">
            <ShieldCheck className="w-3 h-3 text-[#087F68]" />
            <span>Chat Google Gemini se process hoti hai. Phone/email share nahi hote.</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
