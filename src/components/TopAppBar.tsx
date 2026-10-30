import React, { useState } from 'react';
import { UserProfile } from '../types';
import { Smartphone, Monitor, Bell, Crown, Settings as SettingsIcon, Users, CheckCircle2 } from 'lucide-react';

interface TopAppBarProps {
  user: UserProfile | null;
  isAndroidFrame: boolean;
  onToggleFrame: () => void;
  onOpenSettings: () => void;
  onSwitchUser: (userId: string) => void;
  availableAccounts: Array<{ id: string; name: string; businessName: string; email: string }>;
  dueTodayCount: number;
  overdueCount: number;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  user,
  isAndroidFrame,
  onToggleFrame,
  onOpenSettings,
  onSwitchUser,
  availableAccounts,
  dueTodayCount,
  overdueCount,
}) => {
  const [showAccountDropdown, setShowAccountDropdown] = useState(false);

  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        new Notification('QuoteBack AI Reminders Active', {
          body: `You have ${dueTodayCount} follow-ups due today and ${overdueCount} overdue.`,
          icon: '/favicon.ico',
        });
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-[#18211F] text-[#18211F] dark:text-[#EAEFEA] border-b border-[#E6EAE7] dark:border-[#26312E] shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between">
        {/* Brand & Studio Identity */}
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-xl bg-[#087F68] text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-xs">
            QB
          </div>
          <div className="leading-tight">
            <div className="flex items-center space-x-1.5">
              <span className="font-bold text-sm tracking-tight text-[#18211F] dark:text-white">
                QuoteBack AI
              </span>
            </div>
            <p className="text-[11px] text-[#6B7470] dark:text-[#9BA5A0] truncate max-w-[150px] sm:max-w-xs font-normal">
              {user?.businessName || 'Interior Studio'}
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center space-x-1 sm:space-x-1.5">
          {/* Tenant Switcher (Flow H multi-tenant security verification) */}
          <div className="relative">
            <button
              onClick={() => setShowAccountDropdown(!showAccountDropdown)}
              title="Switch user account (Test data isolation)"
              aria-label="Switch account"
              className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition flex items-center space-x-1.5 text-xs font-medium"
            >
              <Users className="w-3.5 h-3.5 text-[#087F68]" />
              <span className="hidden sm:inline">Switch Tenant</span>
            </button>

            {showAccountDropdown && (
              <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-[#1C2522] border border-[#E6EAE7] dark:border-[#2D3935] rounded-2xl shadow-xl py-1.5 z-50 text-xs">
                <div className="px-3 py-1.5 border-b border-[#E6EAE7] dark:border-[#2D3935] text-[#6B7470] dark:text-[#8D9792] font-semibold uppercase tracking-wider text-[10px]">
                  Multi-Tenant Accounts (Isolated DB)
                </div>
                {availableAccounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => {
                      onSwitchUser(acc.id);
                      setShowAccountDropdown(false);
                    }}
                    className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-[#F4F6F4] dark:hover:bg-[#24302C] transition ${
                      user?.id === acc.id ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] font-semibold' : 'text-[#18211F] dark:text-[#D5DDD8]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-xs">{acc.businessName}</div>
                      <div className="text-[11px] text-[#6B7470] dark:text-[#8D9792]">{acc.name}</div>
                    </div>
                    {user?.id === acc.id && <CheckCircle2 className="w-3.5 h-3.5 text-[#087F68]" />}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Device Frame View Toggle */}
          <button
            onClick={onToggleFrame}
            title={isAndroidFrame ? 'Switch to Full-Width View' : 'Preview in Android Phone Frame'}
            aria-label="Toggle frame"
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition"
          >
            {isAndroidFrame ? <Monitor className="w-4 h-4 text-[#D97706]" /> : <Smartphone className="w-4 h-4 text-[#087F68]" />}
          </button>

          {/* Notification Alert Trigger */}
          <button
            onClick={requestNotificationPermission}
            title={`${dueTodayCount} due today, ${overdueCount} overdue`}
            aria-label="Notifications"
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition relative"
          >
            <Bell className="w-4 h-4" />
            {(overdueCount > 0 || dueTodayCount > 0) && (
              <span
                className={`absolute top-1.5 right-1.5 w-2 h-2 rounded-full ${
                  overdueCount > 0 ? 'bg-[#C83C4B] ring-2 ring-white dark:ring-[#18211F]' : 'bg-[#D97706]'
                }`}
              />
            )}
          </button>

          {/* Settings Button */}
          <button
            onClick={onOpenSettings}
            title="Business Settings & Profile"
            aria-label="Settings"
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
