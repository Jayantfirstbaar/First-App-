import React, { useState, useEffect } from 'react';
import { Lead, UserProfile, LeadStage } from './types';
import { api } from './services/api';
import { categorizeFollowUp } from './utils/calculations';
import { TopAppBar } from './components/TopAppBar';
import { Navigation, NavTab } from './components/Navigation';
import { AndroidFrame } from './components/AndroidFrame';
import { HomeView } from './components/views/HomeView';
import { LeadsView } from './components/views/LeadsView';
import { FollowUpsView } from './components/views/FollowUpsView';
import { ReportsView } from './components/views/ReportsView';
import { LeadModal } from './components/LeadModal';
import { LeadDetailModal } from './components/LeadDetailModal';
import { AIMessageModal } from './components/AIMessageModal';
import { FollowUpActionModal } from './components/FollowUpActionModal';
import { SettingsModal } from './components/SettingsModal';
import { OnboardingModal } from './components/OnboardingModal';
import { AuthView } from './components/AuthView';
import { useAuth } from './contexts/AuthContext';

export default function App() {
  const { user: firebaseUser, loading: authLoading, getIdToken } = useAuth();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<NavTab>('home');
  const [isAndroidFrame, setIsAndroidFrame] = useState(true);

  // Available test accounts for multi-tenant isolation testing (Flow H)
  const [availableAccounts, setAvailableAccounts] = useState<
    Array<{ id: string; name: string; businessName: string; email: string }>
  >([]);

  // Modals state
  const [showAddLeadModal, setShowAddLeadModal] = useState(false);
  const [editingLead, setEditingLead] = useState<Lead | null>(null);
  const [selectedLeadForDetail, setSelectedLeadForDetail] = useState<Lead | null>(null);
  const [selectedLeadForAI, setSelectedLeadForAI] = useState<Lead | null>(null);
  const [selectedLeadForFollowUpAction, setSelectedLeadForFollowUpAction] = useState<Lead | null>(null);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);

  // Notification Banner
  const [notificationBanner, setNotificationBanner] = useState<{ title: string; message: string; isOverdue: boolean } | null>(null);

  const todayStr = new Date().toISOString().split('T')[0];

  const loadData = async () => {
    try {
      const currentUser = await api.getCurrentUser();
      setUser(currentUser);

      const userLeads = await api.getLeads();
      setLeads(userLeads);

      const accounts = await api.getDemoAccounts();
      setAvailableAccounts(accounts);

      // Check if user has overdue follow-ups to show notification reminder
      const overdue = userLeads.filter(l => categorizeFollowUp(l, todayStr) === 'overdue');
      const dueToday = userLeads.filter(l => categorizeFollowUp(l, todayStr) === 'today');

      if (overdue.length > 0) {
        setNotificationBanner({
          title: `${overdue.length} Overdue Follow-Up${overdue.length > 1 ? 's' : ''}`,
          message: `Keep quotations moving. Tap to review ${overdue[0].customerName}'s quotation.`,
          isOverdue: true,
        });
      } else if (dueToday.length > 0) {
        setNotificationBanner({
          title: `${dueToday.length} Follow-Up${dueToday.length > 1 ? 's' : ''} Due Today`,
          message: `Send your scheduled follow-up to ${dueToday[0].customerName}.`,
          isOverdue: false,
        });
      }
    } catch (err) {
      console.error('Error loading initial data:', err);
      // Show onboarding if no valid user
      setShowOnboardingModal(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const syncTokenAndLoad = async () => {
      if (firebaseUser && firebaseUser.emailVerified) {
        const token = await getIdToken();
        if (token) {
          api.setToken(token);
          loadData();
        }
      }
    };
    syncTokenAndLoad();
  }, [firebaseUser, getIdToken]);

  // Authenticated route guard
  if (authLoading) return (
    <div className="min-h-screen bg-[#F7F8F6] dark:bg-[#121816] flex flex-col items-center justify-center text-[#18211F] dark:text-[#EAEFEA] space-y-3">
      <div className="w-11 h-11 rounded-2xl bg-[#087F68] flex items-center justify-center font-bold text-white text-base shadow-sm animate-pulse">
        QB
      </div>
      <p className="text-xs font-semibold tracking-wide text-[#6B7470] dark:text-[#9BA5A0]">
        Loading Authentication...
      </p>
    </div>
  );

  if (!firebaseUser || !firebaseUser.emailVerified) return <AuthView />;

  const handleSwitchUser = async (targetUserId: string) => {
    setLoading(true);
    try {
      const switchedUser = await api.switchUser(targetUserId);
      setUser(switchedUser);
      const userLeads = await api.getLeads();
      setLeads(userLeads);
      setSelectedLeadForDetail(null);
      setSelectedLeadForAI(null);
    } catch (err) {
      console.error('Failed to switch user:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLead = async (leadData: Partial<Lead>) => {
    if (editingLead) {
      const updated = await api.updateLead(editingLead.id, leadData);
      setLeads(prev => prev.map(l => (l.id === updated.id ? updated : l)));
      if (selectedLeadForDetail?.id === updated.id) {
        setSelectedLeadForDetail(updated);
      }
    } else {
      const created = await api.createLead(leadData);
      setLeads(prev => [created, ...prev]);
    }
    setShowAddLeadModal(false);
    setEditingLead(null);
  };

  const handleDeleteLead = async (leadId: string) => {
    await api.deleteLead(leadId);
    setLeads(prev => prev.filter(l => l.id !== leadId));
    setSelectedLeadForDetail(null);
  };

  const handleBulkDeleteLeads = async (leadIds: string[]) => {
    for (const id of leadIds) {
      await api.deleteLead(id);
    }
    setLeads(prev => prev.filter(l => !leadIds.includes(l.id)));
    if (selectedLeadForDetail && leadIds.includes(selectedLeadForDetail.id)) {
      setSelectedLeadForDetail(null);
    }
  };

  const handleBulkUpdateStage = async (leadIds: string[], newStage: LeadStage) => {
    for (const id of leadIds) {
      await api.updateLead(id, { stage: newStage });
    }
    setLeads(prev => prev.map(l => leadIds.includes(l.id) ? { ...l, stage: newStage } : l));
    if (selectedLeadForDetail && leadIds.includes(selectedLeadForDetail.id)) {
      setSelectedLeadForDetail(prev => prev ? { ...prev, stage: newStage } : null);
    }
  };

  const handleUpdateLeadStage = async (leadId: string, newStage: LeadStage) => {
    const updated = await api.updateLead(leadId, { stage: newStage });
    setLeads(prev => prev.map(l => l.id === updated.id ? updated : l));
    if (selectedLeadForDetail?.id === updated.id) {
      setSelectedLeadForDetail(updated);
    }
  };

  // Follow-up calculations
  const overdueCount = leads.filter(l => categorizeFollowUp(l, todayStr) === 'overdue').length;
  const dueTodayCount = leads.filter(l => categorizeFollowUp(l, todayStr) === 'today').length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F8F6] dark:bg-[#121816] flex flex-col items-center justify-center text-[#18211F] dark:text-[#EAEFEA] space-y-3">
        <div className="w-11 h-11 rounded-2xl bg-[#087F68] flex items-center justify-center font-bold text-white text-base shadow-sm animate-pulse">
          QB
        </div>
        <p className="text-xs font-semibold tracking-wide text-[#6B7470] dark:text-[#9BA5A0]">
          Loading QuoteBack AI...
        </p>
      </div>
    );
  }

  const activeLeadsCount = leads.filter(l => l.stage !== 'Won' && l.stage !== 'Lost').length;

  return (
    <div className="min-h-screen bg-[#F7F8F6] dark:bg-[#121816] font-sans antialiased text-[#18211F] dark:text-[#EAEFEA] selection:bg-[#087F68] selection:text-white overflow-x-hidden">
      {/* Top App Bar */}
      <TopAppBar
        user={user}
        isAndroidFrame={isAndroidFrame}
        onToggleFrame={() => setIsAndroidFrame(!isAndroidFrame)}
        onOpenSettings={() => setShowSettingsModal(true)}
        onSwitchUser={handleSwitchUser}
        availableAccounts={availableAccounts}
        dueTodayCount={dueTodayCount}
        overdueCount={overdueCount}
      />

      {/* In-App Notification Priority Banner */}
      {notificationBanner && (
        <div
          className={`px-4 py-2 text-xs flex items-center justify-between border-b transition ${
            notificationBanner.isOverdue
              ? 'bg-[#FDF2F3] dark:bg-[#C83C4B]/15 text-[#C83C4B] dark:text-[#F38B95] border-[#F7D2D6] dark:border-[#C83C4B]/30'
              : 'bg-[#E8F5EF] dark:bg-[#087F68]/15 text-[#087F68] dark:text-[#45C3A5] border-[#CBE7DC] dark:border-[#087F68]/30'
          }`}
        >
          <div
            onClick={() => setActiveTab('followups')}
            className="flex-1 cursor-pointer truncate"
          >
            <span className="font-bold mr-1.5">{notificationBanner.title}:</span>
            <span className="opacity-95">{notificationBanner.message}</span>
          </div>
          <button
            onClick={() => setNotificationBanner(null)}
            className="ml-3 text-[11px] font-semibold opacity-70 hover:opacity-100 transition whitespace-nowrap"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Main Container wrapped in Android frame or fluid responsive */}
      <AndroidFrame
        isAndroidFrame={isAndroidFrame}
        bottomNav={
          <Navigation
            activeTab={activeTab}
            onChangeTab={tab => setActiveTab(tab)}
            onQuickAddLead={() => {
              setEditingLead(null);
              setShowAddLeadModal(true);
            }}
            overdueCount={overdueCount}
            dueTodayCount={dueTodayCount}
            isFloating={!isAndroidFrame}
          />
        }
      >
        <main className="min-h-[75vh]">
          {activeTab === 'home' && (
            <HomeView
              user={user}
              leads={leads}
              onOpenAddLead={() => {
                setEditingLead(null);
                setShowAddLeadModal(true);
              }}
              onSelectLead={lead => setSelectedLeadForDetail(lead)}
              onOpenAIMessage={lead => setSelectedLeadForAI(lead)}
              onNavigateTab={tab => setActiveTab(tab)}
              onSeedSampleData={async () => {
                await api.seedSampleLeads();
                loadData();
              }}
            />
          )}

          {activeTab === 'leads' && (
            <LeadsView
              leads={leads}
              onOpenAddLead={() => {
                setEditingLead(null);
                setShowAddLeadModal(true);
              }}
              onSelectLead={lead => setSelectedLeadForDetail(lead)}
              onOpenAIMessage={lead => setSelectedLeadForAI(lead)}
              onUpdateLeadStage={handleUpdateLeadStage}
              onBulkDeleteLeads={handleBulkDeleteLeads}
              onBulkUpdateStage={handleBulkUpdateStage}
            />
          )}

          {activeTab === 'followups' && (
            <FollowUpsView
              leads={leads}
              onSelectLead={lead => setSelectedLeadForDetail(lead)}
              onOpenAIMessage={lead => setSelectedLeadForAI(lead)}
              onOpenFollowUpAction={lead => setSelectedLeadForFollowUpAction(lead)}
            />
          )}

          {activeTab === 'reports' && (
            <ReportsView
              leads={leads}
            />
          )}
        </main>
      </AndroidFrame>

      {/* Add / Edit Lead Modal */}
      {showAddLeadModal && (
        <LeadModal
          initialLead={editingLead}
          existingLeads={leads}
          onClose={() => {
            setShowAddLeadModal(false);
            setEditingLead(null);
          }}
          onSave={handleSaveLead}
        />
      )}

      {/* Lead Detail Modal */}
      {selectedLeadForDetail && (
        <LeadDetailModal
          lead={selectedLeadForDetail}
          user={user}
          onClose={() => setSelectedLeadForDetail(null)}
          onEditLead={lead => {
            setSelectedLeadForDetail(null);
            setEditingLead(lead);
            setShowAddLeadModal(true);
          }}
          onDeleteLead={handleDeleteLead}
          onOpenAIMessage={lead => setSelectedLeadForAI(lead)}
          onOpenFollowUpAction={lead => setSelectedLeadForFollowUpAction(lead)}
          onLeadUpdated={loadData}
        />
      )}

      {/* AI Message Generator Modal */}
      {selectedLeadForAI && (
        <AIMessageModal
          lead={selectedLeadForAI}
          user={user}
          onClose={() => setSelectedLeadForAI(null)}
          onActivityAdded={loadData}
        />
      )}

      {/* Follow-Up Action / Reschedule Modal */}
      {selectedLeadForFollowUpAction && (
        <FollowUpActionModal
          lead={selectedLeadForFollowUpAction}
          onClose={() => setSelectedLeadForFollowUpAction(null)}
          onFollowUpCompleted={loadData}
        />
      )}

      {/* Settings & Business Profile Modal */}
      {showSettingsModal && (
        <SettingsModal
          user={user}
          onClose={() => setShowSettingsModal(false)}
          onProfileUpdated={loadData}
          onLeadsReloadNeeded={loadData}
        />
      )}

      {/* Welcome & First-time Onboarding Modal */}
      {showOnboardingModal && (
        <OnboardingModal
          onComplete={newUser => {
            setUser(newUser);
            setShowOnboardingModal(false);
            loadData();
          }}
        />
      )}
    </div>
  );
}
