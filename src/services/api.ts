import { Lead, Quotation, Activity, UserProfile, MessagePurpose, MessageTone, MessageLanguage } from '../types';

const TOKEN_KEY = 'quoteback_auth_token';

export const api = {
  getToken(): string {
    return localStorage.getItem(TOKEN_KEY) || 'user_sharma';
  },

  setToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.getToken()}`,
    };
  },

  async getCurrentUser(): Promise<UserProfile> {
    const res = await fetch('/api/auth/me', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to fetch user');
    const data = await res.json();
    return data.user;
  },

  async login(email: string): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) throw new Error('Invalid email or password');
    const data = await res.json();
    this.setToken(data.token);
    return data;
  },

  async signup(profile: Partial<UserProfile>): Promise<{ token: string; user: UserProfile }> {
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(profile),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to sign up');
    }
    const data = await res.json();
    this.setToken(data.token);
    return data;
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const res = await fetch('/api/auth/profile', {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update profile');
    const data = await res.json();
    return data.user;
  },

  async getLeads(): Promise<Lead[]> {
    const res = await fetch('/api/leads', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load leads');
    const data = await res.json();
    return data.leads;
  },

  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    const res = await fetch('/api/leads', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(leadData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to create lead');
    }
    const data = await res.json();
    return data.lead;
  },

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('Failed to update lead');
    const data = await res.json();
    return data.lead;
  },

  async deleteLead(id: string): Promise<boolean> {
    const res = await fetch(`/api/leads/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to delete lead');
    return true;
  },

  async completeFollowUp(leadId: string, payload: { customerResponded: boolean; nextFollowUpDate?: string; nextFollowUpTime?: string; note?: string }): Promise<Lead> {
    const res = await fetch(`/api/leads/${leadId}/complete-followup`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Failed to complete follow up');
    const data = await res.json();
    return data.lead;
  },

  async getActivities(leadId: string): Promise<Activity[]> {
    const res = await fetch(`/api/leads/${leadId}/activities`, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load activities');
    const data = await res.json();
    return data.activities;
  },

  async addActivity(leadId: string, type: string, details: string): Promise<Activity> {
    const res = await fetch(`/api/leads/${leadId}/activities`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ type, details }),
    });
    if (!res.ok) throw new Error('Failed to record activity');
    const data = await res.json();
    return data.activity;
  },

  async getQuotations(): Promise<Quotation[]> {
    const res = await fetch('/api/quotations', { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to load quotations');
    const data = await res.json();
    return data.quotations;
  },

  async createQuotation(quoteData: Partial<Quotation>): Promise<Quotation> {
    const res = await fetch('/api/quotations', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(quoteData),
    });
    if (!res.ok) throw new Error('Failed to create quotation');
    const data = await res.json();
    return data.quotation;
  },

  async generateAIFollowUp(params: {
    customerName: string;
    businessName: string;
    projectType: string;
    quotationAmount?: number;
    timeSinceQuotation?: string;
    lastActivity?: string;
    objectionOrConcern?: string;
    purpose: MessagePurpose;
    tone: MessageTone;
    language: MessageLanguage;
  }): Promise<{ text: string; isFallback: boolean; remainingGenerations: number; errorNotice?: string }> {
    const res = await fetch('/api/gemini/generate-followup', {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(params),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to generate AI follow-up');
    }
    return res.json();
  },



  async seedSampleLeads(): Promise<void> {
    const res = await fetch('/api/demo/seed-sample-leads', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to seed sample leads');
  },

  async clearLeads(): Promise<void> {
    const res = await fetch('/api/demo/clear-leads', {
      method: 'POST',
      headers: this.getHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear leads');
  },

  async switchUser(targetUserId: string): Promise<UserProfile> {
    const res = await fetch('/api/demo/switch-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ targetUserId }),
    });
    if (!res.ok) throw new Error('Failed to switch user');
    const data = await res.json();
    this.setToken(data.token);
    return data.user;
  },

  async getDemoAccounts(): Promise<Array<{ id: string; name: string; businessName: string; email: string }>> {
    const res = await fetch('/api/demo/accounts');
    if (!res.ok) return [];
    const data = await res.json();
    return data.accounts;
  },

  getExportCsvUrl(options?: { status?: string; timeframe?: string; startDate?: string; endDate?: string }): string {
    const params = new URLSearchParams();
    if (options?.status && options.status !== 'all') params.set('status', options.status);
    if (options?.timeframe && options.timeframe !== 'all') params.set('timeframe', options.timeframe);
    if (options?.startDate) params.set('startDate', options.startDate);
    if (options?.endDate) params.set('endDate', options.endDate);
    const qs = params.toString();
    return `/api/export/leads-csv${qs ? `?${qs}` : ''}`;
  },

  async downloadCsv(options?: { status?: string; timeframe?: string; startDate?: string; endDate?: string }): Promise<void> {
    const url = this.getExportCsvUrl(options);
    const res = await fetch(url, { headers: this.getHeaders() });
    if (!res.ok) throw new Error('Failed to download CSV');
    const blob = await res.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const filterTag = options?.status && options.status !== 'all' ? `_${options.status.replace(/\s+/g, '_')}` : '';
    a.download = `QuoteBack_Leads${filterTag}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(blobUrl);
  },
};
