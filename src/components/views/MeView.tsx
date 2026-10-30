import React, { useState } from 'react';
import { UserProfile } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { validateAndCleanIndianPhone, formatINR } from '../../utils/calculations';
import {
  User,
  Mail,
  Phone,
  Building,
  Camera,
  Sun,
  Moon,
  Monitor,
  Bell,
  Globe,
  ShieldCheck,
  HelpCircle,
  LogOut,
  Trash2,
  Lock,
  Edit2,
  CheckCircle2,
  AlertCircle,
  X,
  ChevronRight,
  Sparkles,
  Zap,
  Clock,
  FileText,
  DollarSign,
  Info,
  RefreshCw,
} from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../services/firebase';
import { AIStatusRow } from '../AIStatusRow';

interface MeViewProps {
  user: UserProfile | null;
  onProfileUpdated: () => void;
  onLeadsReloadNeeded: () => void;
  onThemeChanged: (theme: 'light' | 'dark' | 'system') => void;
}

export const MeView: React.FC<MeViewProps> = ({
  user,
  onProfileUpdated,
  onLeadsReloadNeeded,
  onThemeChanged,
}) => {
  const { logout, getIdToken } = useAuth();

  // Modals & Dialogs state
  const [showEditPersonalModal, setShowEditPersonalModal] = useState(false);
  const [showEditBusinessModal, setShowEditBusinessModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSignOutConfirm, setShowSignOutConfirm] = useState(false);
  const [showDeleteAccountConfirm, setShowDeleteAccountConfirm] = useState(false);
  const [deleteConfirmationInput, setDeleteConfirmationInput] = useState('');

  // Edit Personal Profile Form State
  const [editName, setEditName] = useState(user?.name || '');
  const [editPhone, setEditPhone] = useState(user?.phoneNumber || '');
  const [editPhotoURL, setEditPhotoURL] = useState<string | undefined>(user?.photoURL);
  const [savingPersonal, setSavingPersonal] = useState(false);
  const [personalError, setPersonalError] = useState<string | null>(null);

  // Edit Business Profile Form State
  const [editBusinessName, setEditBusinessName] = useState(user?.businessName || '');
  const [editBusinessType, setEditBusinessType] = useState(user?.businessType || 'Interior Design');
  const [editLanguage, setEditLanguage] = useState<'en' | 'hi' | 'hinglish'>(user?.languagePreference || 'hinglish');
  const [editReminderTime, setEditReminderTime] = useState(user?.reminderTime || '10:00');
  const [savingBusiness, setSavingBusiness] = useState(false);
  const [businessError, setBusinessError] = useState<string | null>(null);

  // Status banners
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Theme state
  const [themeMode, setThemeMode] = useState<'light' | 'dark' | 'system'>(user?.themePreference || 'light');

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  const handlePersonalPhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setPersonalError('Image must be smaller than 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 256, 256);
        const compressed = canvas.toDataURL('image/jpeg', 0.8);
        setEditPhotoURL(compressed);
        setPersonalError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSavePersonalProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setPersonalError(null);

    if (!editName.trim()) {
      setPersonalError('Name is required.');
      return;
    }

    let cleanedPhone = editPhone;
    if (editPhone.trim()) {
      const val = validateAndCleanIndianPhone(editPhone);
      if (!val.isValid) {
        setPersonalError('Please enter a valid 10-digit mobile number.');
        return;
      }
      cleanedPhone = val.whatsAppNumber;
    }

    setSavingPersonal(true);
    try {
      const updates = {
        name: editName.trim(),
        phoneNumber: cleanedPhone,
        photoURL: editPhotoURL || null as any,
      };

      await api.updateProfile(updates);

      setStatusMessage('Personal profile updated successfully!');
      setShowEditPersonalModal(false);
      onProfileUpdated();
    } catch (err: any) {
      setPersonalError(err.message || 'Failed to update personal profile.');
    } finally {
      setSavingPersonal(false);
    }
  };

  const handleSaveBusinessProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusinessError(null);

    if (!editBusinessName.trim()) {
      setBusinessError('Business name is required.');
      return;
    }

    setSavingBusiness(true);
    try {
      const updates = {
        businessName: editBusinessName.trim(),
        businessType: editBusinessType,
        languagePreference: editLanguage,
        reminderTime: editReminderTime,
      };

      await api.updateProfile(updates);

      setStatusMessage('Business profile saved successfully!');
      setShowEditBusinessModal(false);
      onProfileUpdated();
    } catch (err: any) {
      setBusinessError(err.message || 'Failed to save business profile.');
    } finally {
      setSavingBusiness(false);
    }
  };

  const handleThemeChange = async (newTheme: 'light' | 'dark' | 'system') => {
    setThemeMode(newTheme);
    onThemeChanged(newTheme);
    try {
      await api.updateProfile({ themePreference: newTheme });
    } catch {}
  };

  const handleSignOut = async () => {
    setShowSignOutConfirm(false);
    await logout();
    window.location.reload();
  };

  const handleDeleteAccount = async () => {
    if (deleteConfirmationInput !== 'DELETE') return;
    try {
      await api.deleteAccount();
      await logout();
      window.location.reload();
    } catch (err: any) {
      setStatusMessage('Error deleting account: ' + err.message);
      setShowDeleteAccountConfirm(false);
    }
  };

  const handleTestNotification = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('QuoteBack AI Daily Reminder', {
          body: 'Namaste! Check today\'s pending client quotations and follow-up tasks.',
        });
        setStatusMessage('Browser reminder alert sent!');
      } else {
        setStatusMessage('Notification permission was denied in your browser settings.');
      }
    } else {
      setStatusMessage('Notification API is not supported by this browser.');
    }
  };

  if (!user) return null;

  const phoneInfo = user.phoneNumber ? validateAndCleanIndianPhone(user.phoneNumber) : null;

  return (
    <div className="p-3.5 sm:p-5 space-y-4 max-w-2xl mx-auto overflow-x-hidden">
      {/* Status Banner */}
      {statusMessage && (
        <div className="p-3 bg-[#E8F5EF] dark:bg-[#087F68]/20 border border-[#CBE7DC] dark:border-[#087F68]/30 rounded-2xl text-[#087F68] dark:text-[#38D6AB] text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2 min-w-0">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span className="truncate">{statusMessage}</span>
          </div>
          <button onClick={() => setStatusMessage(null)} className="p-1 hover:opacity-75">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header Profile Summary Card */}
      <div className="bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-3xl p-4 sm:p-6 shadow-xs relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-center sm:items-start space-y-3 sm:space-y-0 sm:space-x-4 text-center sm:text-left">
          {/* Avatar */}
          <div className="relative shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt={user.name}
                className="w-20 h-20 sm:w-22 sm:h-22 rounded-full object-cover border-2 border-[#087F68] shadow-md"
              />
            ) : (
              <div className="w-20 h-20 sm:w-22 sm:h-22 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] font-black text-2xl flex items-center justify-center border-2 border-[#087F68]/40 shadow-xs">
                {getInitials(user.name)}
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setEditName(user.name);
                setEditPhone(user.phoneNumber || '');
                setEditPhotoURL(user.photoURL);
                setShowEditPersonalModal(true);
              }}
              className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#087F68] text-white shadow-lg hover:bg-[#066956] transition"
              title="Edit photo"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* User Details */}
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-1.5">
              <h1 className="text-lg sm:text-xl font-black text-[#18211F] dark:text-white tracking-tight truncate">
                {user.name}
              </h1>
              <span className="px-2 py-0.5 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] text-[10px] font-bold border border-[#CBE7DC] dark:border-[#087F68]/30">
                100% Free Plan
              </span>
            </div>

            <p className="text-xs font-semibold text-[#087F68] dark:text-[#38D6AB] truncate">
              {user.businessName || 'Interior Studio'}
            </p>

            <div className="flex flex-col sm:flex-row sm:items-center space-y-0.5 sm:space-y-0 sm:space-x-3 text-[11px] text-[#6B7470] dark:text-[#9BA5A0] pt-1">
              <span className="flex items-center justify-center sm:justify-start space-x-1 truncate">
                <Mail className="w-3 h-3 text-[#087F68]" />
                <span className="truncate">{user.email}</span>
              </span>
              {phoneInfo && (
                <span className="flex items-center justify-center sm:justify-start space-x-1 truncate">
                  <Phone className="w-3 h-3 text-[#087F68]" />
                  <span>{phoneInfo.formattedDisplay}</span>
                </span>
              )}
            </div>
          </div>

          {/* Edit Profile Quick Action Button */}
          <button
            type="button"
            onClick={() => {
              setEditName(user.name);
              setEditPhone(user.phoneNumber || '');
              setEditPhotoURL(user.photoURL);
              setShowEditPersonalModal(true);
            }}
            className="px-3 py-1.5 rounded-xl border border-[#E6EAE7] dark:border-[#26312E] bg-[#FAFBFA] dark:bg-[#1E2825] hover:bg-[#F2F4F2] dark:hover:bg-[#25322E] text-[#18211F] dark:text-white text-xs font-semibold flex items-center space-x-1 shrink-0 self-center sm:self-start transition active:scale-95 cursor-pointer shadow-xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-[#087F68]" />
            <span>Edit Profile</span>
          </button>
        </div>
      </div>

      {/* Account & Business Profile Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* Account Details Card */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
            <h3 className="font-bold text-xs text-[#18211F] dark:text-white flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-[#087F68]" />
              <span>Personal Profile</span>
            </h3>
            <button
              onClick={() => {
                setEditName(user.name);
                setEditPhone(user.phoneNumber || '');
                setEditPhotoURL(user.photoURL);
                setShowEditPersonalModal(true);
              }}
              className="text-[10px] font-bold text-[#087F68] hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Full Name</span>
              <span className="font-semibold text-[#18211F] dark:text-white">{user.name}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Firebase Registered Email</span>
              <span className="font-semibold text-[#18211F] dark:text-white">{user.email}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Mobile Number</span>
              <span className="font-semibold text-[#18211F] dark:text-white">
                {phoneInfo ? phoneInfo.formattedDisplay : 'Not added yet'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Authentication Provider</span>
              <span className="inline-block mt-0.5 px-2 py-0.5 rounded-md bg-[#F2F4F2] dark:bg-[#202A27] text-[10px] font-bold text-[#18211F] dark:text-white capitalize">
                {user.authProvider || 'Firebase Authenticated'}
              </span>
            </div>
          </div>
        </div>

        {/* Business Profile Card */}
        <div className="p-4 rounded-3xl bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
            <h3 className="font-bold text-xs text-[#18211F] dark:text-white flex items-center space-x-1.5">
              <Building className="w-3.5 h-3.5 text-[#087F68]" />
              <span>Business Profile</span>
            </h3>
            <button
              onClick={() => {
                setEditBusinessName(user.businessName);
                setEditBusinessType(user.businessType);
                setEditLanguage(user.languagePreference);
                setEditReminderTime(user.reminderTime);
                setShowEditBusinessModal(true);
              }}
              className="text-[10px] font-bold text-[#087F68] hover:underline"
            >
              Edit
            </button>
          </div>

          <div className="space-y-2 text-xs">
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Business / Studio Name</span>
              <span className="font-semibold text-[#18211F] dark:text-white">{user.businessName}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Category</span>
              <span className="font-semibold text-[#18211F] dark:text-white">{user.businessType}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Preferred AI Follow-Up Language</span>
              <span className="font-semibold text-[#18211F] dark:text-white capitalize">
                {user.languagePreference === 'hi' ? 'Hindi (हिंदी)' : user.languagePreference === 'hinglish' ? 'Hinglish' : 'English'}
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0] block">Daily Follow-Up Reminder</span>
              <span className="font-semibold text-[#18211F] dark:text-white">{user.reminderTime} AM</span>
            </div>
          </div>
        </div>
      </div>

      {/* Settings Sections List */}
      <div className="bg-white dark:bg-[#18211F] border border-[#E6EAE7] dark:border-[#26312E] rounded-3xl p-4 shadow-xs space-y-4">
        <h3 className="font-bold text-xs text-[#18211F] dark:text-white border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
          Application Preferences & Settings
        </h3>

        {/* 1. Appearance / Theme */}
        <div className="space-y-2">
          <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA]">
            Appearance
          </label>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: 'light', label: 'Light', icon: Sun },
              { id: 'dark', label: 'Dark', icon: Moon },
              { id: 'system', label: 'System', icon: Monitor },
            ].map(opt => {
              const Icon = opt.icon;
              const isActive = themeMode === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleThemeChange(opt.id as any)}
                  className={`p-2.5 rounded-2xl border text-xs font-semibold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ${
                    isActive
                      ? 'border-[#087F68] bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] font-bold shadow-xs'
                      : 'border-[#E6EAE7] dark:border-[#26312E] bg-[#FAFBFA] dark:bg-[#1E2825] text-[#6B7470] dark:text-[#9BA5A0] hover:border-[#087F68]/40'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Notifications & Reminders */}
        <div className="pt-2 border-t border-[#F2F4F2] dark:border-[#26312E] space-y-2">
          <div className="flex items-center justify-between">
            <div>
              <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA]">
                Follow-up Notifications & Test
              </label>
              <p className="text-[10px] text-[#6B7470] dark:text-[#9BA5A0]">
                Daily reminder at {user.reminderTime} AM
              </p>
            </div>
            <button
              type="button"
              onClick={handleTestNotification}
              className="px-3 py-1.5 bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs rounded-xl shadow-xs transition active:scale-95 cursor-pointer"
            >
              Test Alert
            </button>
          </div>
        </div>

        {/* 3. Preferences (Language & Currency) */}
        <div className="pt-2 border-t border-[#F2F4F2] dark:border-[#26312E] space-y-2">
          <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA]">
            Regional & Language Preferences
          </label>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 bg-[#FAFBFA] dark:bg-[#1E2825] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl flex items-center justify-between">
              <span className="text-[#6B7470] dark:text-[#9BA5A0]">Currency Display</span>
              <span className="font-bold text-[#18211F] dark:text-white">INR (₹ Indian Rupee)</span>
            </div>
            <div className="p-2.5 bg-[#FAFBFA] dark:bg-[#1E2825] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl flex items-center justify-between">
              <span className="text-[#6B7470] dark:text-[#9BA5A0]">Default Language</span>
              <span className="font-bold text-[#087F68] dark:text-[#38D6AB] capitalize">{user.languagePreference}</span>
            </div>
          </div>
        </div>

        {/* 4. AI Engine Status */}
        <div className="pt-2 border-t border-[#F2F4F2] dark:border-[#26312E]">
          <AIStatusRow />
        </div>

        {/* 5. Privacy, Terms & Support Action Links */}
        <div className="pt-2 border-t border-[#F2F4F2] dark:border-[#26312E] space-y-1">
          <button
            onClick={() => setShowPrivacyModal(true)}
            className="w-full p-2.5 rounded-2xl hover:bg-[#F2F4F2] dark:hover:bg-[#202A27] text-left flex items-center justify-between text-xs font-semibold text-[#18211F] dark:text-white transition cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#087F68]" />
              <span>Privacy Policy & Data Storage</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#9BA5A0]" />
          </button>

          <button
            onClick={() => setShowTermsModal(true)}
            className="w-full p-2.5 rounded-2xl hover:bg-[#F2F4F2] dark:hover:bg-[#202A27] text-left flex items-center justify-between text-xs font-semibold text-[#18211F] dark:text-white transition cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <FileText className="w-4 h-4 text-[#087F68]" />
              <span>Terms of Service</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#9BA5A0]" />
          </button>

          <button
            onClick={() => setShowHelpModal(true)}
            className="w-full p-2.5 rounded-2xl hover:bg-[#F2F4F2] dark:hover:bg-[#202A27] text-left flex items-center justify-between text-xs font-semibold text-[#18211F] dark:text-white transition cursor-pointer"
          >
            <span className="flex items-center space-x-2">
              <HelpCircle className="w-4 h-4 text-[#087F68]" />
              <span>Help Center & App Info (v1.2.0 Free)</span>
            </span>
            <ChevronRight className="w-4 h-4 text-[#9BA5A0]" />
          </button>
        </div>

        {/* 5. Account Actions: Sign Out & Delete Account */}
        <div className="pt-3 border-t border-[#F2F4F2] dark:border-[#26312E] flex flex-col sm:flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setShowSignOutConfirm(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl border border-[#E6EAE7] dark:border-[#26312E] bg-white dark:bg-[#18211F] hover:bg-[#FDF2F3] text-[#C83C4B] font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer shadow-xs"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>

          <button
            type="button"
            onClick={() => setShowDeleteAccountConfirm(true)}
            className="w-full sm:w-auto px-4 py-2.5 rounded-2xl bg-[#FDF2F3] dark:bg-[#C83C4B]/20 hover:bg-[#F7D2D6] text-[#C83C4B] font-bold text-xs flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Delete Account</span>
          </button>
        </div>
      </div>

      {/* Edit Personal Profile Modal */}
      {showEditPersonalModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-3">
              <h3 className="font-bold text-sm text-[#18211F] dark:text-white flex items-center space-x-1.5">
                <User className="w-4 h-4 text-[#087F68]" />
                <span>Edit Personal Profile</span>
              </h3>
              <button onClick={() => setShowEditPersonalModal(false)} className="p-1 text-[#6B7470]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSavePersonalProfile} className="space-y-4">
              {/* Photo Upload */}
              <div className="flex flex-col items-center space-y-2">
                <div className="relative">
                  {editPhotoURL ? (
                    <img src={editPhotoURL} alt="Preview" className="w-20 h-20 rounded-full object-cover border-2 border-[#087F68]" />
                  ) : (
                    <div className="w-20 h-20 rounded-full bg-[#E8F5EF] text-[#087F68] font-bold text-xl flex items-center justify-center border-2 border-[#087F68]">
                      {getInitials(editName)}
                    </div>
                  )}
                  <label htmlFor="modal-photo" className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#087F68] text-white cursor-pointer hover:bg-[#066956]">
                    <Camera className="w-3.5 h-3.5" />
                    <input id="modal-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={handlePersonalPhotoSelect} className="hidden" />
                  </label>
                </div>
                {editPhotoURL && (
                  <button type="button" onClick={() => setEditPhotoURL(undefined)} className="text-[10px] text-[#C83C4B] hover:underline font-bold">
                    Remove Photo
                  </button>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Full Name <span className="text-[#C83C4B]">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Registered Email (Firebase Account)
                </label>
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full p-2.5 bg-[#F2F4F2] dark:bg-[#1C2522] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#6B7470] cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Mobile Number (WhatsApp)
                </label>
                <input
                  type="tel"
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="e.g. 9810012345"
                  className="w-full p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white"
                />
              </div>

              {personalError && (
                <div className="p-2.5 bg-[#FDF2F3] text-[#C83C4B] rounded-xl text-xs border border-[#F7D2D6]">
                  {personalError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditPersonalModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs font-semibold text-[#6B7470]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingPersonal}
                  className="px-4 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white text-xs font-bold shadow-xs flex items-center space-x-1"
                >
                  {savingPersonal ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Business Profile Modal */}
      {showEditBusinessModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-3">
              <h3 className="font-bold text-sm text-[#18211F] dark:text-white flex items-center space-x-1.5">
                <Building className="w-4 h-4 text-[#087F68]" />
                <span>Edit Business Profile</span>
              </h3>
              <button onClick={() => setShowEditBusinessModal(false)} className="p-1 text-[#6B7470]">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveBusinessProfile} className="space-y-3.5 text-xs">
              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Business / Studio Name
                </label>
                <input
                  type="text"
                  required
                  value={editBusinessName}
                  onChange={e => setEditBusinessName(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Primary Category
                </label>
                <select
                  value={editBusinessType}
                  onChange={e => setEditBusinessType(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white"
                >
                  <option value="Interior Design">Interior Design Studio</option>
                  <option value="Modular Kitchen">Modular Kitchen & Wardrobes</option>
                  <option value="Turnkey Fitout">Turnkey Residential Fitouts</option>
                  <option value="Architecture Studio">Architectural Firm</option>
                  <option value="Custom Furniture">Custom Furniture Manufacturing</option>
                  <option value="Home Renovation">Home Renovation Contractor</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Preferred AI Follow-Up Language
                </label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'hinglish', label: 'Hinglish' },
                    { id: 'en', label: 'English' },
                    { id: 'hi', label: 'Hindi' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setEditLanguage(opt.id as any)}
                      className={`p-2 rounded-xl text-center border text-xs font-semibold transition ${
                        editLanguage === opt.id
                          ? 'border-[#087F68] bg-[#E8F5EF] text-[#087F68] font-bold'
                          : 'border-[#E6EAE7] text-[#6B7470]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
                  Daily Morning Follow-Up Reminder
                </label>
                <input
                  type="time"
                  value={editReminderTime}
                  onChange={e => setEditReminderTime(e.target.value)}
                  className="w-full p-2.5 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs text-[#18211F] dark:text-white"
                />
              </div>

              {businessError && (
                <div className="p-2.5 bg-[#FDF2F3] text-[#C83C4B] rounded-xl border border-[#F7D2D6]">
                  {businessError}
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowEditBusinessModal(false)}
                  className="px-3.5 py-1.5 rounded-xl border border-[#E6EAE7] text-xs font-semibold text-[#6B7470]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingBusiness}
                  className="px-4 py-1.5 rounded-xl bg-[#087F68] hover:bg-[#066956] text-white text-xs font-bold shadow-xs flex items-center space-x-1"
                >
                  {savingBusiness ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : 'Save Profile'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign Out Confirmation Modal */}
      {showSignOutConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#FDF2F3] text-[#C83C4B] mx-auto flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#18211F] dark:text-white">
              Sign out of QuoteBack AI?
            </h3>
            <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0]">
              You will be returned to the authentication screen. Your business leads and quotations will remain saved.
            </p>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setShowSignOutConfirm(false)}
                className="px-4 py-2 rounded-xl border border-[#E6EAE7] text-xs font-semibold text-[#6B7470]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 py-2 rounded-xl bg-[#C83C4B] hover:bg-[#B03340] text-white text-xs font-bold"
              >
                Confirm Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Confirmation Modal */}
      {showDeleteAccountConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-sm w-full p-5 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] text-center space-y-3">
            <div className="w-10 h-10 rounded-full bg-[#FDF2F3] text-[#C83C4B] mx-auto flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-bold text-sm text-[#18211F] dark:text-white">
              Delete Account & All Leads?
            </h3>
            <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] leading-relaxed">
              This action is permanent and cannot be undone. All your customer leads, quotations, and activity timelines will be deleted.
            </p>
            <div className="text-xs text-left pt-1">
              <label className="block text-[10px] font-bold text-[#C83C4B] mb-1">
                Type <code className="bg-red-50 px-1 py-0.5 rounded font-bold">DELETE</code> to confirm:
              </label>
              <input
                type="text"
                value={deleteConfirmationInput}
                onChange={e => setDeleteConfirmationInput(e.target.value)}
                placeholder="DELETE"
                className="w-full p-2 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-xl text-xs font-mono text-center"
              />
            </div>
            <div className="flex items-center justify-center space-x-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteAccountConfirm(false);
                  setDeleteConfirmationInput('');
                }}
                className="px-4 py-2 rounded-xl border border-[#E6EAE7] text-xs font-semibold text-[#6B7470]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deleteConfirmationInput !== 'DELETE'}
                onClick={handleDeleteAccount}
                className="px-4 py-2 rounded-xl bg-[#C83C4B] hover:bg-[#B03340] text-white text-xs font-bold disabled:opacity-40"
              >
                Permanently Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Policy Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-5 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
              <h3 className="font-bold text-xs text-[#18211F] dark:text-white flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#087F68]" />
                <span>Privacy Policy & Data Security</span>
              </h3>
              <button onClick={() => setShowPrivacyModal(false)} className="p-1 text-[#6B7470]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#6B7470] dark:text-[#9BA5A0] space-y-2 leading-relaxed">
              <p><strong>1. Strict Data Isolation:</strong> Your customer leads, phone numbers, and quotation figures are private and isolated to your authenticated account ID ({user.id}). No other user can access your studio records.</p>
              <p><strong>2. No Web Scraping or Snooping:</strong> QuoteBack AI never scrapes WhatsApp chats, reads background device contacts, or accesses private messaging data.</p>
              <p><strong>3. Zero-Cost Infrastructure:</strong> All server operations are powered by standard free cloud hosting and Google Cloud Firestore infrastructure.</p>
              <p><strong>4. AI Assistant & Gemini Privacy:</strong> In "Ask QuoteBack", your business context summary and lead stages are processed by Google Gemini strictly to answer your sales and follow-up questions in real time. Customer phone numbers, email addresses, and private contact info are NEVER sent to Gemini. Your conversation data is not used for AI model training.</p>
            </div>
          </div>
        </div>
      )}

      {/* Terms of Service Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-5 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-3 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
              <h3 className="font-bold text-xs text-[#18211F] dark:text-white flex items-center space-x-1.5">
                <FileText className="w-4 h-4 text-[#087F68]" />
                <span>Terms of Service</span>
              </h3>
              <button onClick={() => setShowTermsModal(false)} className="p-1 text-[#6B7470]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#6B7470] dark:text-[#9BA5A0] space-y-2 leading-relaxed">
              <p><strong>1. Free Usage Guarantee:</strong> QuoteBack AI is provided 100% free of charge for interior design studios and contractors without mandatory paid plans.</p>
              <p><strong>2. Editorial Control:</strong> All AI-generated follow-up messages are drafts. You retain complete control to edit messages before sending them on WhatsApp.</p>
            </div>
          </div>
        </div>
      )}

      {/* Help Center & Support Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#18211F] rounded-3xl max-w-md w-full p-5 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-3">
            <div className="flex items-center justify-between border-b border-[#F2F4F2] dark:border-[#26312E] pb-2">
              <h3 className="font-bold text-xs text-[#18211F] dark:text-white flex items-center space-x-1.5">
                <HelpCircle className="w-4 h-4 text-[#087F68]" />
                <span>About QuoteBack AI v1.2.0</span>
              </h3>
              <button onClick={() => setShowHelpModal(false)} className="p-1 text-[#6B7470]">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="text-xs text-[#6B7470] dark:text-[#9BA5A0] space-y-2 leading-relaxed">
              <p><strong>QuoteBack AI v1.2.0 (Free Community Edition)</strong></p>
              <p>Designed specifically for Indian interior designers, modular kitchen studios, and renovation contractors to track quotations and automate follow-ups in conversational Hinglish.</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
