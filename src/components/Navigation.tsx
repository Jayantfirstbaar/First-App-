import React from 'react';
import { Home, Users, Clock, BarChart3, User, Plus, Sparkles } from 'lucide-react';

export type NavTab = 'home' | 'leads' | 'followups' | 'reports' | 'me';

interface NavigationProps {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
  onQuickAddLead: () => void;
  onOpenAskAI?: () => void;
  overdueCount: number;
  dueTodayCount: number;
  isFloating?: boolean;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onChangeTab,
  onQuickAddLead,
  onOpenAskAI,
  overdueCount,
  dueTodayCount,
  isFloating = false,
}) => {
  const followUpBadge = overdueCount + dueTodayCount;

  return (
    <div className={`w-full relative ${isFloating ? 'fixed bottom-0 left-0 right-0 z-30' : ''}`}>
      {/* Floating Action Button (FAB) positioned above navigation on Home & Leads */}
      {(activeTab === 'home' || activeTab === 'leads') && (
        <div className="absolute -top-14 right-5 z-40">
          <button
            onClick={onQuickAddLead}
            aria-label="Add new lead"
            className="w-12 h-12 rounded-2xl bg-[#087F68] hover:bg-[#066956] text-white shadow-lg shadow-[#087F68]/30 flex items-center justify-center transform active:scale-95 transition cursor-pointer"
          >
            <Plus className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* Mobile-Native Bottom Nav Container */}
      <nav
        aria-label="Bottom Navigation"
        className="w-full bg-white/95 dark:bg-[#18211F]/95 backdrop-blur-md border-t border-[#E6EAE7] dark:border-[#26312E] px-1 py-1.5 flex items-center justify-around shadow-xs"
      >
        {/* Destination 1: Home */}
        <button
          onClick={() => onChangeTab('home')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition cursor-pointer ${
            activeTab === 'home'
              ? 'text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F] dark:hover:text-[#EAEFEA]'
          }`}
        >
          <div className={`px-2 py-1 rounded-full transition ${activeTab === 'home' ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20' : ''}`}>
            <Home className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Home</span>
        </button>

        {/* Destination 2: Leads */}
        <button
          onClick={() => onChangeTab('leads')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl transition cursor-pointer ${
            activeTab === 'leads'
              ? 'text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F] dark:hover:text-[#EAEFEA]'
          }`}
        >
          <div className={`px-2 py-1 rounded-full transition ${activeTab === 'leads' ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20' : ''}`}>
            <Users className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Leads</span>
        </button>

        {/* Center Prominent Entry: Ask QuoteBack AI */}
        <button
          onClick={onOpenAskAI}
          aria-label="Ask QuoteBack AI"
          className="flex flex-col items-center justify-center -mt-2.5 px-1.5 group cursor-pointer"
        >
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#087F68] to-[#12A588] text-white shadow-md shadow-[#087F68]/30 flex items-center justify-center transform group-hover:scale-105 active:scale-95 transition">
            <Sparkles className="w-5 h-5 animate-pulse" />
          </div>
          <span className="text-[10px] mt-0.5 font-bold text-[#087F68] dark:text-[#38D6AB] tracking-tight">
            Ask
          </span>
        </button>

        {/* Destination 3: Follow-ups */}
        <button
          onClick={() => onChangeTab('followups')}
          className={`flex flex-col items-center justify-center py-1 px-2 rounded-2xl relative transition cursor-pointer ${
            activeTab === 'followups'
              ? 'text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F] dark:hover:text-[#EAEFEA]'
          }`}
        >
          <div className={`px-2 py-1 rounded-full relative transition ${activeTab === 'followups' ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20' : ''}`}>
            <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
            {followUpBadge > 0 && (
              <span
                className={`absolute -top-0.5 -right-0.5 px-1.5 py-0.2 rounded-full text-[9px] font-bold text-white ${
                  overdueCount > 0 ? 'bg-[#C83C4B]' : 'bg-[#D97706]'
                }`}
              >
                {followUpBadge}
              </span>
            )}
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Follow-ups</span>
        </button>

        {/* Destination 4: Reports */}
        <button
          onClick={() => onChangeTab('reports')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'reports'
              ? 'text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F] dark:hover:text-[#EAEFEA]'
          }`}
        >
          <div className={`px-2.5 py-1 rounded-full transition ${activeTab === 'reports' ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20' : ''}`}>
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Reports</span>
        </button>

        {/* Destination 5: Me */}
        <button
          onClick={() => onChangeTab('me')}
          className={`flex flex-col items-center justify-center py-1 px-2.5 rounded-2xl transition cursor-pointer ${
            activeTab === 'me'
              ? 'text-[#087F68] font-bold'
              : 'text-[#6B7470] dark:text-[#9BA5A0] hover:text-[#18211F] dark:hover:text-[#EAEFEA]'
          }`}
        >
          <div className={`px-2.5 py-1 rounded-full transition ${activeTab === 'me' ? 'bg-[#E8F5EF] dark:bg-[#087F68]/20' : ''}`}>
            <User className="w-4 h-4 sm:w-5 sm:h-5" />
          </div>
          <span className="text-[10px] mt-0.5 tracking-tight">Me</span>
        </button>
      </nav>
    </div>
  );
};
