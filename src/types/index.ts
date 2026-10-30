export type LeadStage = 
  | 'New'
  | 'Contacted'
  | 'Site Visit Scheduled'
  | 'Quotation Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost';

export type LeadSource = 
  | 'WhatsApp'
  | 'Instagram'
  | 'Phone Call'
  | 'Website'
  | 'Referral'
  | 'Walk-in'
  | 'Other';

export type ProjectType =
  | 'Interior Design'
  | 'Modular Kitchen'
  | 'Renovation'
  | 'Furniture'
  | 'Turnkey Project'
  | 'Architecture'
  | 'Other';

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  photoURL?: string;
  isProfileComplete?: boolean;
  businessName: string;
  businessType: string;
  languagePreference: 'en' | 'hi' | 'hinglish';
  timeZone: string;
  reminderTime: string;
  themePreference?: 'light' | 'dark' | 'system';
  notificationEnabled?: boolean;
  authProvider?: 'google' | 'email' | 'other';
  aiUsageThisMonth: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadPriority = 'High' | 'Medium' | 'Low';

export interface Lead {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  source: LeadSource | string;
  projectType: ProjectType | string;
  estimatedValue: number;
  quotationAmount?: number;
  quotationSentDate?: string;
  stage: LeadStage;
  priority?: LeadPriority;
  tags?: string[];
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextFollowUpTime?: string; // HH:mm
  followUpCompleted?: boolean;
  notes?: string;
  lossReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Quotation {
  id: string;
  userId: string;
  leadId: string;
  amount: number;
  description?: string;
  sentDate: string;
  validUntilDate?: string;
  status: 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';
  createdAt: string;
  updatedAt: string;
}

export interface Activity {
  id: string;
  userId: string;
  leadId: string;
  type: string;
  details: string;
  timestamp: string;
}

export type FollowUpFilterTab = 'overdue' | 'today' | 'upcoming' | 'completed';

export type MessagePurpose =
  | 'Quotation follow-up'
  | 'First enquiry response'
  | 'Friendly follow-up after no response'
  | 'Site visit confirmation'
  | 'Meeting reminder'
  | 'Budget concern follow-up'
  | 'Negotiation follow-up'
  | 'Re-engagement after a long gap'
  | 'Thank-you after a successful deal'
  | 'Custom message';

export type MessageTone = 
  | 'Professional'
  | 'Friendly'
  | 'Polite'
  | 'Concise'
  | 'Persuasive without pressure';

export type MessageLanguage = 'en' | 'hi' | 'hinglish';

export type ProposedActionType = 'update_stage' | 'schedule_followup' | 'add_note' | 'draft_message';

export interface ProposedAction {
  id?: string;
  type: ProposedActionType;
  leadId: string;
  stage?: LeadStage;
  date?: string; // YYYY-MM-DD
  time?: string; // HH:mm
  note?: string;
  text?: string;
  status?: 'pending' | 'confirmed' | 'dismissed';
}

export interface ChatLeadSnapshot {
  id: string;
  customerName: string;
  stage: LeadStage;
  projectType: string;
  estimatedValue: number;
  quotationAmount?: number;
  nextFollowUpDate?: string;
  daysSinceQuotation?: number;
  priority?: LeadPriority;
  lastNote?: string;
}

export interface ChatStatsSnapshot {
  activeLeads: number;
  overdueCount: number;
  dueTodayCount: number;
  pendingQuotationValue: number;
  wonValueThisMonth: number;
  winRatePercent: number;
}

export interface ChatContextSnapshot {
  businessName: string;
  businessType: string;
  language: string;
  todayDate: string;
  timeZone: string;
  stats: ChatStatsSnapshot;
  leads: ChatLeadSnapshot[];
}

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  timestamp: string;
  actions?: ProposedAction[];
  isFallback?: boolean;
  errorCode?: string;
  error?: string;
}
