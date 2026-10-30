import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  getDocs,
  query,
  orderBy,
  where,
} from 'firebase/firestore';
import { db, auth } from './firebase';
import { Lead, Quotation, Activity, UserProfile, MessagePurpose, MessageTone, MessageLanguage } from '../types';
import { filterLeadsForExport, generateLeadsCsv } from '../utils/calculations';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path,
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(errInfo.error);
}

function requireAuthUid(): string {
  const user = auth.currentUser;
  if (!user || !user.uid) {
    throw new Error('User is not authenticated');
  }
  return user.uid;
}

export function sanitizeFirestorePayload<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      clean[key] = value;
    }
  }
  return clean;
}

export const api = {
  async getToken(): Promise<string | null> {
    if (auth.currentUser) {
      try {
        return await auth.currentUser.getIdToken();
      } catch (err) {
        console.warn('Failed to retrieve fresh Firebase ID token:', err);
      }
    }
    return null;
  },

  async getHeaders(): Promise<Record<string, string>> {
    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  },

  async getCurrentUser(): Promise<UserProfile> {
    const uid = requireAuthUid();
    const userDocPath = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const docSnap = await getDoc(userRef);

      if (docSnap.exists()) {
        return docSnap.data() as UserProfile;
      }

      const firebaseUser = auth.currentUser!;
      const email = firebaseUser.email || '';
      const rawName = firebaseUser.displayName || email.split('@')[0] || 'Studio Partner';
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const now = new Date().toISOString();

      const initialProfile: UserProfile = {
        id: uid,
        email,
        name: formattedName,
        businessName: `${formattedName}'s Studio`,
        businessType: 'Interior Design',
        languagePreference: 'hinglish',
        timeZone: 'Asia/Kolkata',
        reminderTime: '10:00',
        isProfileComplete: false,
        themePreference: 'light',
        notificationEnabled: true,
        authProvider: firebaseUser.providerData?.[0]?.providerId?.includes('google') ? 'google' : 'email',
        aiUsageThisMonth: 0,
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(userRef, sanitizeFirestorePayload(initialProfile));
      return initialProfile;
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, userDocPath);
      throw err;
    }
  },

  async updateProfile(updates: Partial<UserProfile>): Promise<UserProfile> {
    const uid = requireAuthUid();
    const userDocPath = `users/${uid}`;
    try {
      const userRef = doc(db, 'users', uid);
      const now = new Date().toISOString();
      const rawPayload: Record<string, any> = {
        ...updates,
        updatedAt: now,
      };
      const cleanPayload = sanitizeFirestorePayload(rawPayload);

      await setDoc(userRef, cleanPayload, { merge: true });
      const updatedSnap = await getDoc(userRef);
      return updatedSnap.data() as UserProfile;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, userDocPath);
      throw err;
    }
  },

  async deleteAccount(): Promise<boolean> {
    const uid = requireAuthUid();
    try {
      // Delete user leads and activities
      const leadsSnap = await getDocs(collection(db, 'users', uid, 'leads'));
      for (const leadDoc of leadsSnap.docs) {
        const activitiesSnap = await getDocs(collection(db, 'users', uid, 'leads', leadDoc.id, 'activities'));
        for (const actDoc of activitiesSnap.docs) {
          await deleteDoc(actDoc.ref);
        }
        await deleteDoc(leadDoc.ref);
      }

      // Delete quotations
      const quotesSnap = await getDocs(collection(db, 'users', uid, 'quotations'));
      for (const quoteDoc of quotesSnap.docs) {
        await deleteDoc(quoteDoc.ref);
      }

      // Delete user profile
      await deleteDoc(doc(db, 'users', uid));

      // Sign out / delete auth user
      if (auth.currentUser) {
        try {
          await auth.currentUser.delete();
        } catch {
          await auth.signOut();
        }
      }
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${uid}`);
      throw err;
    }
  },

  async getLeads(): Promise<Lead[]> {
    const uid = requireAuthUid();
    const leadsPath = `users/${uid}/leads`;
    try {
      const q = query(collection(db, 'users', uid, 'leads'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Lead));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, leadsPath);
      throw err;
    }
  },

  async createLead(leadData: Partial<Lead>): Promise<Lead> {
    const uid = requireAuthUid();
    const leadsPath = `users/${uid}/leads`;
    try {
      const now = new Date().toISOString();
      const leadRef = doc(collection(db, 'users', uid, 'leads'));

      const newLead: Lead = {
        id: leadRef.id,
        userId: uid,
        customerName: String(leadData.customerName || '').trim(),
        phone: String(leadData.phone || '').trim(),
        source: String(leadData.source || 'WhatsApp'),
        projectType: String(leadData.projectType || 'Interior Design'),
        estimatedValue: Number(leadData.estimatedValue) || 0,
        quotationAmount: leadData.quotationAmount ? Number(leadData.quotationAmount) : undefined,
        quotationSentDate: leadData.quotationSentDate || (leadData.quotationAmount ? now.split('T')[0] : undefined),
        stage: leadData.stage || 'New',
        priority: leadData.priority || 'Medium',
        tags: Array.isArray(leadData.tags) ? leadData.tags : [],
        nextFollowUpDate: leadData.nextFollowUpDate || undefined,
        nextFollowUpTime: leadData.nextFollowUpTime || '11:00',
        followUpCompleted: false,
        notes: String(leadData.notes || ''),
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(leadRef, sanitizeFirestorePayload(newLead));

      if (newLead.quotationAmount && newLead.quotationAmount > 0) {
        const quoteRef = doc(collection(db, 'users', uid, 'quotations'));
        await setDoc(quoteRef, sanitizeFirestorePayload({
          id: quoteRef.id,
          userId: uid,
          leadId: leadRef.id,
          amount: newLead.quotationAmount,
          description: `${newLead.projectType} Project Proposal`,
          sentDate: newLead.quotationSentDate || now.split('T')[0],
          status: 'Sent',
          createdAt: now,
          updatedAt: now,
        }));
      }

      const actRef = doc(collection(db, 'users', uid, 'leads', leadRef.id, 'activities'));
      await setDoc(actRef, sanitizeFirestorePayload({
        id: actRef.id,
        userId: uid,
        leadId: leadRef.id,
        type: 'lead_created',
        details: `Lead created from ${newLead.source} for ${newLead.projectType}`,
        timestamp: now,
      }));

      return newLead;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, leadsPath);
      throw err;
    }
  },

  async updateLead(id: string, updates: Partial<Lead>): Promise<Lead> {
    const uid = requireAuthUid();
    const leadPath = `users/${uid}/leads/${id}`;
    try {
      const leadRef = doc(db, 'users', uid, 'leads', id);
      const leadSnap = await getDoc(leadRef);

      if (!leadSnap.exists()) {
        throw new Error('Lead not found');
      }

      const oldData = leadSnap.data() as Lead;
      const now = new Date().toISOString();

      const payload: Record<string, any> = {
        ...updates,
        updatedAt: now,
      };

      await updateDoc(leadRef, sanitizeFirestorePayload(payload));

      if (updates.stage && updates.stage !== oldData.stage) {
        let actType = 'stage_changed';
        let details = `Stage updated from "${oldData.stage}" to "${updates.stage}"`;
        if (updates.stage === 'Won') {
          actType = 'deal_won';
          details = `Deal Won! Recorded revenue: ₹${updates.quotationAmount || oldData.quotationAmount || updates.estimatedValue || oldData.estimatedValue}`;
        } else if (updates.stage === 'Lost') {
          actType = 'deal_lost';
          details = `Deal marked as Lost. Reason: ${updates.lossReason || 'None specified'}`;
        }

        const actRef = doc(collection(db, 'users', uid, 'leads', id, 'activities'));
        await setDoc(actRef, sanitizeFirestorePayload({
          id: actRef.id,
          userId: uid,
          leadId: id,
          type: actType,
          details,
          timestamp: now,
        }));
      }

      const updatedSnap = await getDoc(leadRef);
      return { id: updatedSnap.id, ...updatedSnap.data() } as Lead;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, leadPath);
      throw err;
    }
  },

  async deleteLead(id: string): Promise<boolean> {
    const uid = requireAuthUid();
    const leadPath = `users/${uid}/leads/${id}`;
    try {
      const leadRef = doc(db, 'users', uid, 'leads', id);
      
      // Delete activities subcollection
      const activitiesSnap = await getDocs(collection(db, 'users', uid, 'leads', id, 'activities'));
      for (const actDoc of activitiesSnap.docs) {
        await deleteDoc(actDoc.ref);
      }

      // Delete linked quotations
      const quotesQuery = query(collection(db, 'users', uid, 'quotations'), where('leadId', '==', id));
      const quotesSnap = await getDocs(quotesQuery);
      for (const qDoc of quotesSnap.docs) {
        await deleteDoc(qDoc.ref);
      }

      await deleteDoc(leadRef);
      return true;
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, leadPath);
      throw err;
    }
  },

  async completeFollowUp(
    leadId: string,
    payload: { customerResponded: boolean; nextFollowUpDate?: string; nextFollowUpTime?: string; note?: string }
  ): Promise<Lead> {
    const uid = requireAuthUid();
    const leadPath = `users/${uid}/leads/${leadId}`;
    try {
      const leadRef = doc(db, 'users', uid, 'leads', leadId);
      const now = new Date().toISOString();

      const updates: Record<string, any> = {
        updatedAt: now,
        followUpCompleted: !payload.nextFollowUpDate,
      };

      if (payload.nextFollowUpDate) {
        updates.nextFollowUpDate = payload.nextFollowUpDate;
        updates.nextFollowUpTime = payload.nextFollowUpTime || '11:00';
        updates.followUpCompleted = false;
      }

      await updateDoc(leadRef, sanitizeFirestorePayload(updates));

      const detailText = `Follow-up completed. Customer response: ${payload.customerResponded ? 'Yes' : 'No response'}. ${
        payload.nextFollowUpDate ? `Next follow-up scheduled for ${payload.nextFollowUpDate} ${payload.nextFollowUpTime || ''}` : 'No further follow-up scheduled.'
      } ${payload.note ? `Note: ${payload.note}` : ''}`;

      const actRef = doc(collection(db, 'users', uid, 'leads', leadId, 'activities'));
      await setDoc(actRef, sanitizeFirestorePayload({
        id: actRef.id,
        userId: uid,
        leadId,
        type: 'followup_completed',
        details: detailText,
        timestamp: now,
      }));

      const updatedSnap = await getDoc(leadRef);
      return { id: updatedSnap.id, ...updatedSnap.data() } as Lead;
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, leadPath);
      throw err;
    }
  },

  async getActivities(leadId: string): Promise<Activity[]> {
    const uid = requireAuthUid();
    const actPath = `users/${uid}/leads/${leadId}/activities`;
    try {
      const q = query(collection(db, 'users', uid, 'leads', leadId, 'activities'), orderBy('timestamp', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Activity));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, actPath);
      throw err;
    }
  },

  async addActivity(leadId: string, type: string, details: string): Promise<Activity> {
    const uid = requireAuthUid();
    const actPath = `users/${uid}/leads/${leadId}/activities`;
    try {
      const now = new Date().toISOString();
      const actRef = doc(collection(db, 'users', uid, 'leads', leadId, 'activities'));
      const newActivity: Activity = {
        id: actRef.id,
        userId: uid,
        leadId,
        type: String(type || 'note'),
        details: String(details || ''),
        timestamp: now,
      };

      await setDoc(actRef, sanitizeFirestorePayload(newActivity));
      return newActivity;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, actPath);
      throw err;
    }
  },

  async getQuotations(): Promise<Quotation[]> {
    const uid = requireAuthUid();
    const quotesPath = `users/${uid}/quotations`;
    try {
      const q = query(collection(db, 'users', uid, 'quotations'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      return snap.docs.map(d => ({ id: d.id, ...d.data() } as Quotation));
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, quotesPath);
      throw err;
    }
  },

  async createQuotation(quoteData: Partial<Quotation>): Promise<Quotation> {
    const uid = requireAuthUid();
    const quotesPath = `users/${uid}/quotations`;
    try {
      const now = new Date().toISOString();
      const quoteRef = doc(collection(db, 'users', uid, 'quotations'));

      const newQuote: Quotation = {
        id: quoteRef.id,
        userId: uid,
        leadId: String(quoteData.leadId || ''),
        amount: Number(quoteData.amount) || 0,
        description: String(quoteData.description || ''),
        sentDate: quoteData.sentDate || now.split('T')[0],
        validUntilDate: quoteData.validUntilDate || undefined,
        status: quoteData.status || 'Sent',
        createdAt: now,
        updatedAt: now,
      };

      await setDoc(quoteRef, sanitizeFirestorePayload(newQuote));

      if (newQuote.leadId) {
        const leadRef = doc(db, 'users', uid, 'leads', newQuote.leadId);
        await updateDoc(leadRef, sanitizeFirestorePayload({
          quotationAmount: newQuote.amount,
          quotationSentDate: newQuote.sentDate,
          updatedAt: now,
        })).catch(() => {});
      }

      return newQuote;
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, quotesPath);
      throw err;
    }
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
  }): Promise<{ text: string; isFallback: boolean; remainingGenerations: number; reason?: string }> {
    const headers = await this.getHeaders();
    const res = await fetch('/api/gemini/generate-followup', {
      method: 'POST',
      headers,
      body: JSON.stringify(params),
    });

    if (!res.ok) {
      let errText = 'Failed to generate AI follow-up';
      try {
        const json = await res.json();
        errText = json.error || errText;
      } catch {}
      throw new Error(errText);
    }
    return res.json();
  },

  async downloadCsv(options?: { status?: string; timeframe?: string; startDate?: string; endDate?: string }): Promise<void> {
    const leads = await this.getLeads();
    const filtered = filterLeadsForExport(leads, {
      status: (options?.status || 'all') as string,
      timeframe: (options?.timeframe || 'all') as string,
      startDate: options?.startDate as string,
      endDate: options?.endDate as string,
    });

    const csvContent = generateLeadsCsv(filtered);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
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
