import React from 'react';
import { UserProfile } from '../types';
import { Smartphone, Monitor, Bell, Settings as SettingsIcon } from 'lucide-react';

interface TopAppBarProps {
  user: UserProfile | null;
  isAndroidFrame: boolean;
  onToggleFrame: () => void;
  onOpenSettings: () => void;
  onOpenMeTab?: () => void;
  dueTodayCount: number;
  overdueCount: number;
}

export const TopAppBar: React.FC<TopAppBarProps> = ({
  user,
  isAndroidFrame,
  onToggleFrame,
  onOpenSettings,
  onOpenMeTab,
  dueTodayCount,
  overdueCount,
}) => {
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

  const getInitials = (name: string) => {
    return (name || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
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
          {/* Device Frame View Toggle */}
          <button
            onClick={onToggleFrame}
            title={isAndroidFrame ? 'Switch to Full-Width View' : 'Preview in Android Phone Frame'}
            aria-label="Toggle frame"
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition cursor-pointer"
          >
            {isAndroidFrame ? <Monitor className="w-4 h-4 text-[#D97706]" /> : <Smartphone className="w-4 h-4 text-[#087F68]" />}
          </button>

          {/* Notification Alert Trigger */}
          <button
            onClick={requestNotificationPermission}
            title={`${dueTodayCount} due today, ${overdueCount} overdue`}
            aria-label="Notifications"
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition relative cursor-pointer"
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
            className="p-1.5 sm:p-2 rounded-xl bg-[#F4F6F4] hover:bg-[#E8EBE8] dark:bg-[#222C28] dark:hover:bg-[#2B3733] text-[#18211F] dark:text-[#D5DDD8] transition cursor-pointer"
          >
            <SettingsIcon className="w-4 h-4" />
          </button>

          {/* User Profile Avatar / Me Tab Quick Launcher */}
          {user && (
            <button
              onClick={onOpenMeTab || onOpenSettings}
              title="My Profile & Preferences"
              aria-label="User profile"
              className="ml-1 p-0.5 rounded-full ring-2 ring-[#087F68]/30 hover:ring-[#087F68] transition cursor-pointer shrink-0"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={user.name}
                  className="w-7 h-7 rounded-full object-cover"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#E8F5EF] dark:bg-[#087F68]/20 text-[#087F68] dark:text-[#38D6AB] font-bold text-[11px] flex items-center justify-center">
                  {getInitials(user.name)}
                </div>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
