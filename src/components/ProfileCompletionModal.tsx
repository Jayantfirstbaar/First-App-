import React, { useState } from 'react';
import { UserProfile } from '../types';
import { api } from '../services/api';
import { validateAndCleanIndianPhone } from '../utils/calculations';
import { Sparkles, User, Mail, Phone, Building, Camera, ArrowRight, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface ProfileCompletionModalProps {
  user: UserProfile;
  onComplete: (updatedUser: UserProfile) => void;
}

export const ProfileCompletionModal: React.FC<ProfileCompletionModalProps> = ({ user, onComplete }) => {
  const [fullName, setFullName] = useState(user.name || '');
  const [phoneNumber, setPhoneNumber] = useState(user.phoneNumber || '');
  const [businessName, setBusinessName] = useState(user.businessName || `${user.name || 'Studio'}'s Business`);
  const [businessType, setBusinessType] = useState(user.businessType || 'Interior Design');
  const [photoURL, setPhotoURL] = useState<string | undefined>(user.photoURL);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile image must be smaller than 5MB.');
      return;
    }

    if (!['image/jpeg', 'image/png', 'image/webp', 'image/jpg'].includes(file.type)) {
      setError('Please upload a JPG, PNG, or WebP image.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & crop square canvas avatar to 256x256 JPEG (~30-60KB max)
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        const minDim = Math.min(img.width, img.height);
        const startX = (img.width - minDim) / 2;
        const startY = (img.height - minDim) / 2;

        ctx.drawImage(img, startX, startY, minDim, minDim, 0, 0, 256, 256);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setPhotoURL(compressedDataUrl);
        setError(null);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Please enter your full name.');
      return;
    }

    const phoneValidation = validateAndCleanIndianPhone(phoneNumber);
    if (!phoneValidation.isValid) {
      setError('Please enter a valid 10-digit mobile number.');
      return;
    }

    setSaving(true);
    try {
      const updates: Partial<UserProfile> = {
        name: fullName.trim(),
        phoneNumber: phoneValidation.whatsAppNumber,
        photoURL: photoURL || null as any,
        businessName: businessName.trim() || `${fullName.trim()}'s Studio`,
        businessType,
        isProfileComplete: true,
      };

      // Save via API (which uses sanitizeFirestorePayload so no undefined fields exist)
      const updated = await api.updateProfile(updates);
      onComplete(updated);
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      let friendlyMessage = 'Failed to save profile. Please check your details and try again.';
      if (err.message) {
        if (err.message.includes('permission') || err.message.includes('PERMISSION_DENIED')) {
          friendlyMessage = 'Permission error. Please ensure you are logged in properly.';
        } else if (err.message.includes('network') || err.message.includes('Failed to fetch')) {
          friendlyMessage = 'Network connection issue. Please verify your internet connection.';
        }
      }
      setError(friendlyMessage);
    } finally {
      setSaving(false);
    }
  };

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white dark:bg-[#18211F] rounded-[36px] max-w-md w-full p-6 sm:p-8 shadow-2xl border border-[#E6EAE7] dark:border-[#26312E] space-y-6 animate-in zoom-in-95 duration-200 my-auto">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-12 h-12 bg-[#E8F5EF] text-[#087F68] rounded-2xl flex items-center justify-center mx-auto shadow-md shadow-[#087F68]/10">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-black text-[#18211F] dark:text-white tracking-tight">
            Complete Your Profile
          </h2>
          <p className="text-xs text-[#6B7470] dark:text-[#9BA5A0] leading-relaxed">
            Welcome to QuoteBack AI! Let&apos;s quickly set up your business identity for sending quotations and follow-ups.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Avatar Upload */}
          <div className="flex flex-col items-center space-y-2">
            <div className="relative group cursor-pointer">
              {photoURL ? (
                <img
                  src={photoURL}
                  alt="Profile"
                  className="w-20 h-20 rounded-full object-cover border-2 border-[#087F68] shadow-md"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] font-black text-2xl flex items-center justify-center border-2 border-[#087F68]/40">
                  {getInitials(fullName || user.email)}
                </div>
              )}
              <label
                htmlFor="avatar-upload"
                className="absolute bottom-0 right-0 p-1.5 rounded-full bg-[#087F68] text-white shadow-lg cursor-pointer hover:bg-[#066956] transition"
                title="Upload photo"
              >
                <Camera className="w-3.5 h-3.5" />
                <input
                  id="avatar-upload"
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
              </label>
            </div>
            <span className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0]">
              Tap camera icon to upload profile photo (optional)
            </span>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Full Name <span className="text-[#C83C4B]">*</span>
            </label>
            <div className="relative">
              <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
              <input
                type="text"
                required
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="e.g. Rajesh Sharma"
                className="w-full pl-10 pr-3.5 py-3 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl text-xs text-[#18211F] dark:text-white outline-none focus:ring-2 focus:ring-[#087F68]"
              />
            </div>
          </div>

          {/* Read-only Email */}
          <div>
            <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Authenticated Email (Read-only)
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9BA5A0]" />
              <input
                type="email"
                disabled
                value={user.email}
                className="w-full pl-10 pr-3.5 py-3 bg-[#F2F4F2] dark:bg-[#1C2522] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl text-xs text-[#6B7470] cursor-not-allowed"
              />
            </div>
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Mobile Number (for WhatsApp) <span className="text-[#C83C4B]">*</span>
            </label>
            <div className="relative">
              <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
              <input
                type="tel"
                required
                value={phoneNumber}
                onChange={e => setPhoneNumber(e.target.value)}
                placeholder="e.g. 98100 12345"
                className="w-full pl-10 pr-3.5 py-3 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl text-xs text-[#18211F] dark:text-white outline-none focus:ring-2 focus:ring-[#087F68]"
              />
            </div>
            <p className="text-[10px] text-[#6B7470] mt-1">10-digit Indian mobile number (+91)</p>
          </div>

          {/* Business Name */}
          <div>
            <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Studio / Business Name
            </label>
            <div className="relative">
              <Building className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7470]" />
              <input
                type="text"
                value={businessName}
                onChange={e => setBusinessName(e.target.value)}
                placeholder="e.g. Sharma Luxury Interiors"
                className="w-full pl-10 pr-3.5 py-3 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl text-xs text-[#18211F] dark:text-white outline-none focus:ring-2 focus:ring-[#087F68]"
              />
            </div>
          </div>

          {/* Business Type */}
          <div>
            <label className="block text-[11px] font-bold text-[#18211F] dark:text-[#EAEFEA] mb-1">
              Primary Service Category
            </label>
            <select
              value={businessType}
              onChange={e => setBusinessType(e.target.value)}
              className="w-full p-3 bg-[#F7F8F6] dark:bg-[#202A27] border border-[#E6EAE7] dark:border-[#26312E] rounded-2xl text-xs text-[#18211F] dark:text-white outline-none focus:ring-2 focus:ring-[#087F68]"
            >
              <option value="Interior Design">Interior Design Studio</option>
              <option value="Modular Kitchen">Modular Kitchen & Wardrobes</option>
              <option value="Turnkey Fitout">Turnkey Residential Fitouts</option>
              <option value="Architecture Studio">Architectural Firm</option>
              <option value="Custom Furniture">Custom Furniture Manufacturing</option>
              <option value="Home Renovation">Home Renovation Contractor</option>
            </select>
          </div>

          {error && (
            <div className="p-3 bg-[#FDF2F3] border border-[#F7D2D6] rounded-xl text-[#C83C4B] text-xs flex items-center space-x-2 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full py-4 bg-[#087F68] hover:bg-[#066956] text-white font-bold text-xs rounded-2xl shadow-lg shadow-[#087F68]/20 flex items-center justify-center space-x-2 transition active:scale-95 disabled:opacity-50 cursor-pointer"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Save Profile & Continue</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
