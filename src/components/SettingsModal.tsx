import React, { useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Building,
  User,
  Globe,
  Clock,
  Bell,
  Download,
  Trash2,
  Database,
  FileText,
  LogOut,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';

interface SettingsModalProps {
  user: UserProfile | null;
  onClose: () => void;
  onProfileUpdated: () => void;
  onLeadsReloadNeeded: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  user,
  onClose,
  onProfileUpdated,
  onLeadsReloadNeeded,
}) => {
  const { logout } = useAuth();
  const [businessName, setBusinessName] = useState(user?.businessName || '');
  const [name, setName] = useState(user?.name || '');
  const [businessType, setBusinessType] = useState(user?.businessType || 'Interior Design');
  const [languagePreference, setLanguagePreference] = useState<'en' | 'hi' | 'hinglish'>(user?.languagePreference || 'hinglish');
  const [timeZone, setTimeZone] = useState(user?.timeZone || 'Asia/Kolkata');
  const [reminderTime, setReminderTime] = useState(user?.reminderTime || '10:00');

  const [saving, setSaving] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'profile' | 'data' | 'privacy'>('profile');

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setStatusMessage(null);
    try {
      await api.updateProfile({
        businessName,
        name,
        businessType,
        languagePreference,
        timeZone,
        reminderTime,
      });
      setStatusMessage('Profile saved successfully!');
      onProfileUpdated();
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleSeedSampleData = async () => {
    setSaving(true);
    try {
      await api.seedSampleLeads();
      setStatusMessage('Sample leads and quotations loaded!');
      onLeadsReloadNeeded();
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to seed sample data');
    } finally {
      setSaving(false);
    }
  };

  const handleClearAllData = async () => {
    if (!window.confirm('Are you sure you want to clear all your leads and quotations? This cannot be undone.')) {
      return;
    }
    setSaving(true);
    try {
      await api.clearLeads();
      setStatusMessage('All leads cleared. Database is now empty for fresh entry.');
      onLeadsReloadNeeded();
    } catch (err: any) {
      setStatusMessage(err.message || 'Failed to clear leads');
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('QuoteBack AI Test Reminder', {
          body: 'Namaste! Follow-up reminder for Rajiv Mehra quotation (₹12,00,000) is scheduled for today.',
        });
        setStatusMessage('Browser notification triggered successfully!');
      } else {
        setStatusMessage('Notification permission was denied. Please allow notifications in your browser.');
      }
    } else {
      setStatusMessage('Notification API not supported by this browser.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
      <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-lg w-full max-h-[92vh] flex flex-col shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between">
          <h3 className="font-bold text-[#18211F] dark:text-white text-sm sm:text-base">
            Business Settings & Preferences
          </h3>
          <button onClick={onClose} className="p-1 rounded-full text-[#6B7470] hover:text-[#18211F]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Strip */}
        <div className="flex border-b border-[#E6EAE7] dark:border-[#26312E] bg-[#F7F8F6] dark:bg-[#202A27] px-4 pt-2 text-xs">
          <button
            onClick={() => setActiveTab('profile')}
            className={`pb-2 px-3 font-semibold border-b-2 transition ${
              activeTab === 'profile'
                ? 'border-[#087F68] text-[#087F68] font-bold'
                : 'border-transparent text-[#6B7470] hover:text-[#18211F]'
            }`}
          >
            Profile & Reminders
          </button>
          <button
            onClick={() => setActiveTab('data')}
            className={`pb-2 px-3 font-semibold border-b-2 transition ${
              activeTab === 'data'
                ? 'border-[#087F68] text-[#087F68] font-bold'
                : 'border-transparent text-[#6B7470] hover:text-[#18211F]'
            }`}
          >
            Data & Sample Leads
          </button>
          <button
            onClick={() => setActiveTab('privacy')}
            className={`pb-2 px-3 font-semibold border-b-2 transition ${
              activeTab === 'privacy'
                ? 'border-[#087F68] text-[#087F68] font-bold'
                : 'border-transparent text-[#6B7470] hover:text-[#18211F]'
            }`}
          >
            Privacy & Security
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 text-xs sm:text-sm">
          {statusMessage && (
            <div className="p-2.5 bg-[#E8F5EF] dark:bg-[#087F68]/20 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-xl text-[#087F68] text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-[#087F68] shrink-0" />
              <span>{statusMessage}</span>
            </div>
          )}

          {activeTab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {/* Business Name */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Business / Studio Name
                </label>
                <input
                  type="text"
                  required
                  value={businessName}
                  onChange={e => setBusinessName(e.target.value)}
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                />
              </div>

              {/* Owner Name */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Owner / Sales Representative Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                />
              </div>

              {/* Business Type */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Primary Business Category
                </label>
                <select
                  value={businessType}
                  onChange={e => setBusinessType(e.target.value)}
                  className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                >
                  <option value="Interior Design">Interior Design Studio</option>
                  <option value="Modular Kitchen">Modular Kitchen & Wardrobes</option>
                  <option value="Turnkey Fitout">Turnkey Residential Fitouts</option>
                  <option value="Architecture Studio">Architectural Firm</option>
                  <option value="Custom Furniture">Custom Furniture Manufacturing</option>
                  <option value="Home Renovation">Home Renovation Contractor</option>
                </select>
              </div>

              {/* Preferred AI Language */}
              <div>
                <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Default AI Follow-Up Language
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'hinglish', label: 'Hinglish (Recommended)' },
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'Hindi (हिंदी)' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLanguagePreference(opt.id as any)}
                      className={`p-2 rounded-xl text-center border text-xs font-semibold transition ${
                        languagePreference === opt.id
                          ? 'border-[#087F68] bg-[#E8F5EF] text-[#087F68]'
                          : 'border-[#E6EAE7] dark:border-[#26312E] text-[#6B7470]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Daily Reminder Time */}
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                    Time Zone
                  </label>
                  <input
                    type="text"
                    disabled
                    value={timeZone}
                    className="w-full bg-[#F2F4F2] dark:bg-[#202A27]/50 border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#6B7470]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                    Daily Morning Reminder
                  </label>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={e => setReminderTime(e.target.value)}
                    className="w-full bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl p-2 text-xs text-[#18211F] dark:text-white"
                  />
                </div>
              </div>

              {/* Test Notification Trigger */}
              <div className="flex items-center justify-between p-2.5 bg-[#F7F8F6] dark:bg-[#202A27]/40 rounded-xl border border-[#E6EAE7] dark:border-[#26312E]">
                <div>
                  <div className="font-semibold text-xs text-[#18211F] dark:text-white">
                    Notifications Setup
                  </div>
                  <div className="text-[10px] text-[#6B7470]">
                    Test your device notification alerts
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleTestNotification}
                  className="px-2.5 py-1.5 rounded-lg bg-[#087F68] hover:bg-[#066956] text-white font-semibold text-[11px]"
                >
                  Send Test
                </button>
              </div>

              <div className="pt-1 flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs shadow-xs"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          )}

          {activeTab === 'data' && (
            <div className="space-y-3">
              {/* CSV Export */}
              <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/50 border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#18211F] dark:text-white text-xs">
                    Export Leads to CSV
                  </h4>
                  <p className="text-[10px] text-[#6B7470] mt-0.5">
                    Download all your enquiries and quotations.
                  </p>
                </div>
                <a
                  href={api.getExportCsvUrl()}
                  download
                  className="px-3 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white text-xs font-semibold flex items-center space-x-1 shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Export</span>
                </a>
              </div>

              {/* Sample Data Loader */}
              <div className="p-3 bg-[#E8F5EF] dark:bg-[#087F68]/15 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#087F68] text-xs">
                    Load Demo Sample Leads
                  </h4>
                  <p className="text-[10px] text-[#6B7470] mt-0.5">
                    Load 4 sample Indian interior design enquiries.
                  </p>
                </div>
                <button
                  onClick={handleSeedSampleData}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white text-xs font-semibold flex items-center space-x-1 shadow-xs"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>Load Demo</span>
                </button>
              </div>

              {/* Clear All Leads */}
              <div className="p-3 bg-[#FDF2F3] dark:bg-[#C83C4B]/15 border border-[#F7D2D6] dark:border-[#C83C4B]/30 rounded-2xl flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-[#C83C4B] text-xs">
                    Clear All Enquiries
                  </h4>
                  <p className="text-[10px] text-[#6B7470] mt-0.5">
                    Delete all leads to start with a blank pipeline.
                  </p>
                </div>
                <button
                  onClick={handleClearAllData}
                  disabled={saving}
                  className="px-3 py-1.5 rounded-xl bg-[#C83C4B] hover:bg-[#B33543] text-white text-xs font-semibold flex items-center space-x-1 shadow-xs"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Clear All</span>
                </button>
              </div>
            </div>
          )}

          {activeTab === 'privacy' && (
            <div className="space-y-3 text-xs text-[#6B7470] dark:text-[#CBD3CF] leading-relaxed">
              <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/60 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] space-y-1">
                <div className="flex items-center space-x-1.5 font-bold text-[#18211F] dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-[#087F68]" />
                  <span>Privacy Policy & Data Isolation</span>
                </div>
                <p>
                  QuoteBack AI stores only customer details entered directly by you. We never scrape Instagram, read private WhatsApp messages, or access device contacts.
                </p>
                <p>
                  Data is strictly isolated per business account.
                </p>
              </div>

              <div className="p-3 bg-[#F7F8F6] dark:bg-[#202A27]/60 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] space-y-1">
                <div className="font-bold text-[#18211F] dark:text-white">
                  Editorial Control
                </div>
                <p>
                  All generated AI follow-up drafts remain completely editable before sending via WhatsApp. You have full control over what is communicated to clients.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3.5 border-t border-[#E6EAE7] dark:border-[#26312E] flex items-center justify-between bg-[#F7F8F6] dark:bg-[#202A27]/60">
          <button
            onClick={async () => {
              await logout();
              api.clearToken();
              onClose();
            }}
            className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#18211F] text-[#C83C4B] text-xs font-bold shadow-xs hover:bg-red-50 transition"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
          <button
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl bg-[#18211F] dark:bg-[#222C28] text-white text-xs font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
