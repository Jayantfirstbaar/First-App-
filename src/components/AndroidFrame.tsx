import React from 'react';
import { Wifi, BatteryMedium, Signal } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  isAndroidFrame: boolean;
  bottomNav?: React.ReactNode;
}

export const AndroidFrame: React.FC<AndroidFrameProps> = ({ children, isAndroidFrame, bottomNav }) => {
  if (!isAndroidFrame) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] dark:bg-[#121816] text-[#18211F] dark:text-[#EAEFEA] flex flex-col justify-between overflow-x-hidden">
        <div className="flex-1 pb-20 w-full max-w-4xl mx-auto px-2 sm:px-4">
          {children}
        </div>
        <div className="fixed bottom-0 left-0 right-0 z-30">
          {bottomNav}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-68px)] bg-[#ECEFEA] dark:bg-[#111614] flex items-center justify-center p-2 sm:p-4 overflow-x-hidden">
      {/* Phone Shell */}
      <div className="relative w-full max-w-[412px] h-[780px] max-h-[calc(100vh-84px)] bg-[#1A2220] rounded-[44px] p-2.5 shadow-2xl ring-1 ring-black/10 dark:ring-white/10 flex flex-col overflow-hidden">
        {/* Hardware Bezel volume/power buttons */}
        <div className="hidden sm:block absolute -left-[2px] top-24 w-[3px] h-10 bg-[#2D3834] rounded-l-md" />
        <div className="hidden sm:block absolute -left-[2px] top-38 w-[3px] h-10 bg-[#2D3834] rounded-l-md" />
        <div className="hidden sm:block absolute -right-[2px] top-28 w-[3px] h-14 bg-[#2D3834] rounded-r-md" />

        {/* Screen Area */}
        <div className="relative flex-1 bg-[#F7F8F6] dark:bg-[#141B19] rounded-[36px] overflow-hidden flex flex-col border border-[#E6EAE7] dark:border-[#222C28]">
          {/* Android Status Bar */}
          <div className="bg-white dark:bg-[#18211F] text-[#18211F] dark:text-[#EAEFEA] px-5 pt-2 pb-1.5 flex items-center justify-between text-[11px] font-medium z-40 select-none shrink-0 border-b border-[#E6EAE7]/60 dark:border-[#26312E]">
            {/* Clock */}
            <span className="font-semibold text-xs tracking-tight">10:28</span>

            {/* Camera Punch-hole */}
            <div className="w-3.5 h-3.5 rounded-full bg-black ring-2 ring-[#222C28]/40" />

            {/* Status Icons */}
            <div className="flex items-center space-x-1.5 text-[#6B7470] dark:text-[#A1ACA6]">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <BatteryMedium className="w-3.5 h-3.5 text-[#087F68]" />
            </div>
          </div>

          {/* App Scrollable Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar relative">
            {children}
          </div>

          {/* Docked Navigation within the phone shell */}
          <div className="relative shrink-0 z-30">
            {bottomNav}
            {/* Android Gesture Bar */}
            <div className="h-3 bg-white/95 dark:bg-[#18211F]/95 flex items-center justify-center pb-1 border-t border-[#E6EAE7]/40 dark:border-[#26312E]/40">
              <div className="w-24 h-1 bg-[#CBD3CF] dark:bg-[#3D4C47] rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
