import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import dotenv from 'dotenv';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { filterLeadsForExport, generateLeadsCsv } from './src/utils/calculations.js';

import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

// Initialize Firebase Admin with project ID and database ID
if (getApps().length === 0) {
  try {
    initializeApp({
      projectId: firebaseConfig.projectId,
    });
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
  }
}

const firestore = getFirestore(firebaseConfig.firestoreDatabaseId);

const app = express();
const PORT = 3000;

// Security hardening
app.use(helmet({
  contentSecurityPolicy: false, // Vite inline dev scripts
}));
app.use(express.json({ limit: '100kb' }));

// GEMINI Config
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DAILY_AI_LIMIT = 30;

// In-memory rate limiting for AI endpoint (max 10 requests per minute per UID)
const aiRateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkInMemoryRateLimit(uid: string): { allowed: boolean; retryAfterSec?: number } {
  const now = Date.now();
  const userRate = aiRateLimitMap.get(uid);

  if (!userRate || now > userRate.resetAt) {
    aiRateLimitMap.set(uid, { count: 1, resetAt: now + 60000 });
    return { allowed: true };
  }

  if (userRate.count >= 10) {
    const retryAfterSec = Math.ceil((userRate.resetAt - now) / 1000);
    return { allowed: false, retryAfterSec };
  }

  userRate.count += 1;
  return { allowed: true };
}

export interface AuthenticatedRequest extends Request {
  uid: string;
  userEmail?: string;
}

// Authentication Middleware - Mandatory Firebase ID Token Verification
app.use('/api', async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid token format' });
  }

  const token = authHeader.substring(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Empty token' });
  }

  try {
    const decoded = await getAuth().verifyIdToken(token);
    if (!decoded.email_verified) {
      console.warn('Auth Middleware Notice: Email not verified for uid:', decoded.uid);
      return res.status(401).json({ error: 'Unauthorized: Email address is not verified' });
    }

    (req as AuthenticatedRequest).uid = decoded.uid;
    (req as AuthenticatedRequest).userEmail = decoded.email;
    next();
  } catch (error: any) {
    console.error('Auth Middleware Token Verification Failed:', error?.message || error);
    return res.status(401).json({ error: 'Unauthorized: Token verification failed' });
  }
});

// --- REST API ENDPOINTS (FIRESTORE BACKED) ---

// 1. Get Current User Profile (creates initial profile if missing)
app.get('/api/auth/me', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const email = (req as AuthenticatedRequest).userEmail || '';
    const userRef = firestore.collection('users').doc(uid);
    const userSnap = await userRef.get();

    if (!userSnap.exists) {
      const rawName = email.split('@')[0] || 'Studio Partner';
      const formattedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
      const now = new Date().toISOString();

      const initialProfile = {
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
        authProvider: 'google',
        createdAt: now,
        updatedAt: now,
      };

      await userRef.set(initialProfile);
      return res.json({ user: initialProfile });
    }

    res.json({ user: userSnap.data() });
  } catch (err) {
    next(err);
  }
});

// 2. Update User Profile
app.put('/api/auth/profile', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const userRef = firestore.collection('users').doc(uid);

    const {
      name,
      phoneNumber,
      photoURL,
      isProfileComplete,
      businessName,
      businessType,
      languagePreference,
      timeZone,
      reminderTime,
      themePreference,
      notificationEnabled,
      authProvider,
    } = req.body;

    const updates: Record<string, any> = {
      updatedAt: new Date().toISOString(),
    };

    if (name !== undefined) updates.name = String(name).slice(0, 100);
    if (phoneNumber !== undefined) updates.phoneNumber = String(phoneNumber).slice(0, 20);
    if (photoURL !== undefined) updates.photoURL = String(photoURL);
    if (isProfileComplete !== undefined) updates.isProfileComplete = Boolean(isProfileComplete);
    if (businessName !== undefined) updates.businessName = String(businessName).slice(0, 100);
    if (businessType !== undefined) updates.businessType = String(businessType).slice(0, 100);
    if (languagePreference !== undefined) updates.languagePreference = languagePreference;
    if (timeZone !== undefined) updates.timeZone = String(timeZone).slice(0, 50);
    if (reminderTime !== undefined) updates.reminderTime = String(reminderTime).slice(0, 10);
    if (themePreference !== undefined) updates.themePreference = themePreference;
    if (notificationEnabled !== undefined) updates.notificationEnabled = Boolean(notificationEnabled);
    if (authProvider !== undefined) updates.authProvider = authProvider;

    await userRef.set(updates, { merge: true });
    const updatedSnap = await userRef.get();
    res.json({ user: updatedSnap.data() });
  } catch (err) {
    next(err);
  }
});

// 3. Delete Account & All Firestore Subcollections
app.delete('/api/auth/account', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const userRef = firestore.collection('users').doc(uid);

    // Delete subcollections
    const leadsSnap = await userRef.collection('leads').get();
    for (const leadDoc of leadsSnap.docs) {
      const activitiesSnap = await leadDoc.ref.collection('activities').get();
      for (const actDoc of activitiesSnap.docs) {
        await actDoc.ref.delete();
      }
      await leadDoc.ref.delete();
    }

    const quotesSnap = await userRef.collection('quotations').get();
    for (const quoteDoc of quotesSnap.docs) {
      await quoteDoc.ref.delete();
    }

    await userRef.delete();

    // Delete auth account
    try {
      await getAuth().deleteUser(uid);
    } catch {}

    res.json({ success: true, message: 'Account and associated data successfully deleted' });
  } catch (err) {
    next(err);
  }
});

// 4. Get Leads
app.get('/api/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadsSnap = await firestore
      .collection('users')
      .doc(uid)
      .collection('leads')
      .orderBy('createdAt', 'desc')
      .get();

    const leads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ leads });
  } catch (err) {
    next(err);
  }
});

// 5. Create Lead
app.post('/api/leads', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const {
      customerName,
      phone,
      source,
      projectType,
      estimatedValue,
      quotationAmount,
      quotationSentDate,
      stage,
      priority,
      tags,
      nextFollowUpDate,
      nextFollowUpTime,
      notes,
    } = req.body;

    if (!customerName || !phone) {
      return res.status(400).json({ error: 'Customer name and phone number are required' });
    }

    const now = new Date().toISOString();
    const leadRef = firestore.collection('users').doc(uid).collection('leads').doc();

    const newLead = {
      id: leadRef.id,
      userId: uid,
      customerName: String(customerName).trim().slice(0, 100),
      phone: String(phone).trim().slice(0, 20),
      source: String(source || 'WhatsApp').slice(0, 50),
      projectType: String(projectType || 'Interior Design').slice(0, 50),
      estimatedValue: Number(estimatedValue) || 0,
      quotationAmount: quotationAmount ? Number(quotationAmount) : undefined,
      quotationSentDate: quotationSentDate || (quotationAmount ? now.split('T')[0] : undefined),
      stage: stage || 'New',
      priority: priority || 'Medium',
      tags: Array.isArray(tags) ? tags.map(t => String(t).slice(0, 30)) : [],
      nextFollowUpDate: nextFollowUpDate || undefined,
      nextFollowUpTime: nextFollowUpTime || '11:00',
      followUpCompleted: false,
      notes: String(notes || '').slice(0, 1000),
      createdAt: now,
      updatedAt: now,
    };

    await leadRef.set(newLead);

    // If quotationAmount is present, add quotation record
    if (newLead.quotationAmount && newLead.quotationAmount > 0) {
      const quoteRef = firestore.collection('users').doc(uid).collection('quotations').doc();
      await quoteRef.set({
        id: quoteRef.id,
        userId: uid,
        leadId: leadRef.id,
        amount: newLead.quotationAmount,
        description: `${newLead.projectType} Project Proposal`,
        sentDate: newLead.quotationSentDate || now.split('T')[0],
        status: 'Sent',
        createdAt: now,
        updatedAt: now,
      });
    }

    // Add activity record
    const actRef = leadRef.collection('activities').doc();
    await actRef.set({
      id: actRef.id,
      userId: uid,
      leadId: leadRef.id,
      type: 'lead_created',
      details: `Lead created from ${newLead.source} for ${newLead.projectType}`,
      timestamp: now,
    });

    res.status(201).json({ lead: newLead });
  } catch (err) {
    next(err);
  }
});

// 6. Update Lead
app.put('/api/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadId = req.params.id;
    const leadRef = firestore.collection('users').doc(uid).collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const oldData = leadSnap.data()!;
    const now = new Date().toISOString();

    const {
      customerName,
      phone,
      source,
      projectType,
      estimatedValue,
      quotationAmount,
      quotationSentDate,
      stage,
      priority,
      tags,
      nextFollowUpDate,
      nextFollowUpTime,
      followUpCompleted,
      notes,
      lossReason,
    } = req.body;

    const updates: Record<string, any> = { updatedAt: now };

    if (customerName !== undefined) updates.customerName = String(customerName).trim().slice(0, 100);
    if (phone !== undefined) updates.phone = String(phone).trim().slice(0, 20);
    if (source !== undefined) updates.source = String(source).slice(0, 50);
    if (projectType !== undefined) updates.projectType = String(projectType).slice(0, 50);
    if (estimatedValue !== undefined) updates.estimatedValue = Number(estimatedValue);
    if (quotationAmount !== undefined) updates.quotationAmount = Number(quotationAmount);
    if (quotationSentDate !== undefined) updates.quotationSentDate = quotationSentDate;
    if (stage !== undefined) updates.stage = stage;
    if (priority !== undefined) updates.priority = priority;
    if (tags !== undefined) updates.tags = Array.isArray(tags) ? tags.map(t => String(t).slice(0, 30)) : [];
    if (nextFollowUpDate !== undefined) updates.nextFollowUpDate = nextFollowUpDate;
    if (nextFollowUpTime !== undefined) updates.nextFollowUpTime = nextFollowUpTime;
    if (followUpCompleted !== undefined) updates.followUpCompleted = Boolean(followUpCompleted);
    if (notes !== undefined) updates.notes = String(notes).slice(0, 1000);
    if (lossReason !== undefined) updates.lossReason = String(lossReason).slice(0, 500);

    await leadRef.update(updates);

    // Log stage change activity if applicable
    if (stage && stage !== oldData.stage) {
      let actType = 'stage_changed';
      let details = `Stage updated from "${oldData.stage}" to "${stage}"`;
      if (stage === 'Won') {
        actType = 'deal_won';
        details = `Deal Won! Sales revenue: ₹${updates.quotationAmount || oldData.quotationAmount || updates.estimatedValue || oldData.estimatedValue}`;
      } else if (stage === 'Lost') {
        actType = 'deal_lost';
        details = `Deal marked as Lost. Reason: ${updates.lossReason || 'None specified'}`;
      }

      const actRef = leadRef.collection('activities').doc();
      await actRef.set({
        id: actRef.id,
        userId: uid,
        leadId,
        type: actType,
        details,
        timestamp: now,
      });
    }

    const updatedSnap = await leadRef.get();
    res.json({ lead: { id: updatedSnap.id, ...updatedSnap.data() } });
  } catch (err) {
    next(err);
  }
});

// 7. Delete Lead
app.delete('/api/leads/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadId = req.params.id;
    const leadRef = firestore.collection('users').doc(uid).collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    // Delete lead activities subcollection
    const activitiesSnap = await leadRef.collection('activities').get();
    for (const actDoc of activitiesSnap.docs) {
      await actDoc.ref.delete();
    }

    // Delete linked quotations
    const quotesSnap = await firestore
      .collection('users')
      .doc(uid)
      .collection('quotations')
      .where('leadId', '==', leadId)
      .get();

    for (const quoteDoc of quotesSnap.docs) {
      await quoteDoc.ref.delete();
    }

    await leadRef.delete();
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// 8. Complete Follow-up
app.post('/api/leads/:id/complete-followup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadId = req.params.id;
    const leadRef = firestore.collection('users').doc(uid).collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();

    if (!leadSnap.exists) {
      return res.status(404).json({ error: 'Lead not found' });
    }

    const { customerResponded, nextFollowUpDate, nextFollowUpTime, note } = req.body;
    const now = new Date().toISOString();

    const updates: Record<string, any> = {
      updatedAt: now,
      followUpCompleted: !nextFollowUpDate,
    };

    if (nextFollowUpDate) {
      updates.nextFollowUpDate = nextFollowUpDate;
      updates.nextFollowUpTime = nextFollowUpTime || '11:00';
      updates.followUpCompleted = false;
    }

    await leadRef.update(updates);

    const detailText = `Follow-up completed. Customer response: ${customerResponded ? 'Yes' : 'No response'}. ${
      nextFollowUpDate ? `Next follow-up scheduled for ${nextFollowUpDate} ${nextFollowUpTime || ''}` : 'No further follow-up scheduled.'
    } ${note ? `Note: ${String(note).slice(0, 300)}` : ''}`;

    const actRef = leadRef.collection('activities').doc();
    await actRef.set({
      id: actRef.id,
      userId: uid,
      leadId,
      type: 'followup_completed',
      details: detailText,
      timestamp: now,
    });

    const updatedSnap = await leadRef.get();
    res.json({ lead: { id: updatedSnap.id, ...updatedSnap.data() } });
  } catch (err) {
    next(err);
  }
});

// 9. Lead Activities
app.get('/api/leads/:id/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadId = req.params.id;
    const activitiesSnap = await firestore
      .collection('users')
      .doc(uid)
      .collection('leads')
      .doc(leadId)
      .collection('activities')
      .orderBy('timestamp', 'desc')
      .get();

    const activities = activitiesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ activities });
  } catch (err) {
    next(err);
  }
});

app.post('/api/leads/:id/activities', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadId = req.params.id;
    const { type, details } = req.body;

    if (!details) {
      return res.status(400).json({ error: 'Details required' });
    }

    const now = new Date().toISOString();
    const actRef = firestore
      .collection('users')
      .doc(uid)
      .collection('leads')
      .doc(leadId)
      .collection('activities')
      .doc();

    const newActivity = {
      id: actRef.id,
      userId: uid,
      leadId,
      type: String(type || 'note').slice(0, 50),
      details: String(details).slice(0, 1000),
      timestamp: now,
    };

    await actRef.set(newActivity);
    res.status(201).json({ activity: newActivity });
  } catch (err) {
    next(err);
  }
});

// 10. Quotations
app.get('/api/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const quotesSnap = await firestore
      .collection('users')
      .doc(uid)
      .collection('quotations')
      .orderBy('createdAt', 'desc')
      .get();

    const quotations = quotesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ quotations });
  } catch (err) {
    next(err);
  }
});

app.post('/api/quotations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const { leadId, amount, description, sentDate, validUntilDate, status } = req.body;

    if (!leadId || !amount) {
      return res.status(400).json({ error: 'Lead ID and quotation amount are required' });
    }

    const now = new Date().toISOString();
    const quoteRef = firestore.collection('users').doc(uid).collection('quotations').doc();

    const newQuote = {
      id: quoteRef.id,
      userId: uid,
      leadId,
      amount: Number(amount),
      description: String(description || '').slice(0, 500),
      sentDate: sentDate || now.split('T')[0],
      validUntilDate: validUntilDate || undefined,
      status: status || 'Sent',
      createdAt: now,
      updatedAt: now,
    };

    await quoteRef.set(newQuote);

    // Update lead's quotation amount
    const leadRef = firestore.collection('users').doc(uid).collection('leads').doc(leadId);
    const leadSnap = await leadRef.get();
    if (leadSnap.exists) {
      await leadRef.update({
        quotationAmount: Number(amount),
        quotationSentDate: newQuote.sentDate,
        updatedAt: now,
      });
    }

    res.status(201).json({ quotation: newQuote });
  } catch (err) {
    next(err);
  }
});

// 11. AI Generator Endpoint (Server-Side Gemini with Rate Limits & Quotas)
app.post('/api/gemini/generate-followup', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;

    // Check In-memory Rate Limit (max 10 requests per min)
    const rateCheck = checkInMemoryRateLimit(uid);
    if (!rateCheck.allowed) {
      return res.status(429).json({
        error: `Rate limit exceeded. Please wait ${rateCheck.retryAfterSec} seconds.`,
      });
    }

    const {
      customerName,
      businessName,
      projectType,
      quotationAmount,
      timeSinceQuotation,
      lastActivity,
      objectionOrConcern,
      purpose,
      tone,
      language,
    } = req.body;

    const sanitize = (str: any, maxLen = 200): string => {
      if (!str) return '';
      return String(str)
        .replace(/[<>{}\\]/g, '') // strip potential injection chars
        .slice(0, maxLen);
    };

    const cleanCustName = sanitize(customerName, 50) || 'Valued Client';
    const cleanBizName = sanitize(businessName, 50) || 'Design Studio';
    const cleanProj = sanitize(projectType, 50) || 'Interior Project';
    const cleanTime = sanitize(timeSinceQuotation, 50) || 'a few days ago';
    const cleanActivity = sanitize(lastActivity, 200) || 'Waiting for feedback';
    const cleanObjection = sanitize(objectionOrConcern, 200) || 'None';

    const validPurposes = [
      'Quotation follow-up',
      'First enquiry response',
      'Friendly follow-up after no response',
      'Site visit confirmation',
      'Meeting reminder',
      'Budget concern follow-up',
      'Negotiation follow-up',
      'Re-engagement after a long gap',
      'Thank-you after a successful deal',
      'Custom message',
    ];
    const finalPurpose = validPurposes.includes(purpose) ? purpose : 'Quotation follow-up';

    const validTones = ['Professional', 'Friendly', 'Polite', 'Concise', 'Persuasive without pressure'];
    const finalTone = validTones.includes(tone) ? tone : 'Polite';

    const validLangs = ['en', 'hi', 'hinglish'];
    const finalLang = validLangs.includes(language) ? language : 'hinglish';

    // Check Daily AI Quota in Firestore Transaction
    const todayStr = new Date().toISOString().split('T')[0];
    const userRef = firestore.collection('users').doc(uid);

    let currentDailyUsage = 0;

    await firestore.runTransaction(async (transaction) => {
      const userDoc = await transaction.get(userRef);
      const data = userDoc.data() || {};
      const aiUsage = data.aiUsage || {};

      if (aiUsage.date === todayStr) {
        currentDailyUsage = aiUsage.count || 0;
      } else {
        currentDailyUsage = 0;
      }

      if (currentDailyUsage >= DAILY_AI_LIMIT) {
        throw new Error('DAILY_AI_LIMIT_EXCEEDED');
      }
    });

    const getFallbackMessage = (): string => {
      const amtStr = quotationAmount ? `₹${Number(quotationAmount).toLocaleString('en-IN')}` : '';
      if (finalLang === 'hi') {
        return `नमस्ते ${cleanCustName} जी! आपके ${cleanProj} प्रोजेक्ट के लिए जो कोटेशन ${amtStr ? '(' + amtStr + ') ' : ''}शेयर किया था, क्या आपको उसे देखने का समय मिला? यदि कोई प्रश्न हो तो बताएं। सादर, ${cleanBizName}।`;
      }
      if (finalLang === 'hinglish') {
        return `Namaste ${cleanCustName} ji! Hope you are doing well. Aapke ${cleanProj} project ke liye jo quotation ${amtStr ? '(' + amtStr + ') ' : ''}share kiya tha, kya aapko review karne ka time mila? Agar koi adjustments chahiye, toh please let me know. Warm regards, ${cleanBizName}!`;
      }
      return `Hello ${cleanCustName}, hope you are doing well! Following up regarding the proposal ${amtStr ? 'for ' + amtStr + ' ' : ''}for your ${cleanProj} project. Please let us know if you have any questions! Best regards, ${cleanBizName}.`;
    };

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        text: getFallbackMessage(),
        isFallback: true,
        reason: 'Gemini API key is not configured on the server.',
        remainingGenerations: DAILY_AI_LIMIT - currentDailyUsage,
      });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const prompt = `You are a polite, persuasive sales consultant for an interior design studio in India.
Generate a concise, friendly WhatsApp follow-up message for a client.

Business Name: "${cleanBizName}"
Customer Name: "${cleanCustName}"
Project Type: "${cleanProj}"
Quotation Amount: ${quotationAmount ? '₹' + Number(quotationAmount).toLocaleString('en-IN') : 'Quotation shared'}
Time Since Quotation: "${cleanTime}"
Last Activity: "${cleanActivity}"
Known Concern / Objection: "${cleanObjection}"
Message Purpose: "${finalPurpose}"
Tone: "${finalTone}"
Language: "${finalLang}" (Options: 'en' for English, 'hi' for Hindi in Devanagari script, 'hinglish' for Romanized Hindi-English as used on WhatsApp in India).

Rules:
1. Under 80 words. Warm and respectful.
2. End with "${cleanBizName}".
3. Return ONLY the message text without intro quotes or explanations.`;

      const generatePromise = ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: prompt,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('AI request timeout')), 20000)
      );

      const response = await Promise.race([generatePromise, timeoutPromise]);
      const generatedText = response.text?.trim() || getFallbackMessage();

      // Successfully generated with Gemini — Increment usage in Firestore transaction
      await firestore.runTransaction(async (transaction) => {
        const userDoc = await transaction.get(userRef);
        const data = userDoc.data() || {};
        const aiUsage = data.aiUsage || {};

        const newCount = aiUsage.date === todayStr ? (aiUsage.count || 0) + 1 : 1;

        transaction.set(
          userRef,
          {
            aiUsage: {
              date: todayStr,
              count: newCount,
            },
          },
          { merge: true }
        );
      });

      res.json({
        text: generatedText,
        isFallback: false,
        remainingGenerations: DAILY_AI_LIMIT - (currentDailyUsage + 1),
      });
    } catch (geminiError: any) {
      console.warn('Notice: Gemini call failed or timed out:', geminiError?.message);
      // DO NOT increment usage on fallback!
      return res.json({
        text: getFallbackMessage(),
        isFallback: true,
        reason: 'Gemini service unavailable. Template fallback served.',
        remainingGenerations: DAILY_AI_LIMIT - currentDailyUsage,
      });
    }
  } catch (err: any) {
    if (err.message === 'DAILY_AI_LIMIT_EXCEEDED') {
      return res.status(403).json({
        error: `Daily AI generation limit reached (${DAILY_AI_LIMIT}/day). Please try again tomorrow.`,
        limitExceeded: true,
      });
    }
    next(err);
  }
});

// 12. Export Leads CSV
app.get('/api/export/leads-csv', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const uid = (req as AuthenticatedRequest).uid;
    const leadsSnap = await firestore
      .collection('users')
      .doc(uid)
      .collection('leads')
      .get();

    const userLeads = leadsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const { status, stage, timeframe, startDate, endDate } = req.query;

    const filtered = filterLeadsForExport(userLeads as any, {
      status: (status || stage || 'all') as string,
      timeframe: (timeframe || 'all') as string,
      startDate: startDate as string,
      endDate: endDate as string,
    });

    const csvContent = generateLeadsCsv(filtered as any);
    const statusSuffix = status && status !== 'all' ? `_${String(status).replace(/\s+/g, '_')}` : '';

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=QuoteBack_Leads${statusSuffix}_${Date.now()}.csv`);
    res.send(csvContent);
  } catch (err) {
    next(err);
  }
});

// Central error handler (sanitized output)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('API Error:', err?.message || err);
  res.status(500).json({ error: 'Internal server error' });
});

// --- VITE MIDDLEWARE INTEGRATION ---
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(express.static('dist'));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.resolve(process.cwd(), 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`QuoteBack AI Server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
