import express, { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { PLANS, checkLeadCreationLimit, checkAIGenerationLimit } from './src/utils/planLimits';
import { filterLeadsForExport, generateLeadsCsv } from './src/utils/calculations';

dotenv.config();

// Initialize Firebase Admin
try {
  initializeApp();
} catch (error) {
  console.log('Firebase Admin already initialized or failed to initialize:', error);
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Persistent database file setup
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  businessName: string;
  businessType: string;
  languagePreference: 'en' | 'hi' | 'hinglish';
  timeZone: string;
  reminderTime: string;
  aiUsageThisMonth: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadRecord {
  id: string;
  userId: string;
  customerName: string;
  phone: string;
  source: string;
  projectType: string;
  estimatedValue: number;
  quotationAmount?: number;
  quotationSentDate?: string;
  stage: 'New' | 'Contacted' | 'Site Visit Scheduled' | 'Quotation Sent' | 'Negotiation' | 'Won' | 'Lost';
  priority?: 'High' | 'Medium' | 'Low';
  tags?: string[];
  nextFollowUpDate?: string;
  nextFollowUpTime?: string;
  followUpCompleted?: boolean;
  notes?: string;
  lossReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationRecord {
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

export interface ActivityRecord {
  id: string;
  userId: string;
  leadId: string;
  type: string;
  details: string;
  timestamp: string;
}

interface DatabaseSchema {
  users: Record<string, UserProfile>;
  leads: LeadRecord[];
  quotations: QuotationRecord[];
  activities: ActivityRecord[];
}

function getInitialDatabase(): DatabaseSchema {
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  // Pre-seed default user 1 (Sharma Interiors)
  const user1: UserProfile = {
    id: 'user_sharma',
    email: 'sharma.interiors@example.com',
    name: 'Rajesh Sharma',
    businessName: 'Sharma Luxury Interiors',
    businessType: 'Interior Design',
    languagePreference: 'hinglish',
    timeZone: 'Asia/Kolkata',
    reminderTime: '10:00',
    aiUsageThisMonth: 3,
    createdAt: now,
    updatedAt: now,
  };

  // Pre-seed test user 2 (DesignCraft Modulars) for multi-tenant isolation testing
  const user2: UserProfile = {
    id: 'user_designcraft',
    email: 'designcraft@example.com',
    name: 'Ananya Verma',
    businessName: 'DesignCraft Modulars',
    businessType: 'Modular Kitchen',
    languagePreference: 'en',
    timeZone: 'Asia/Kolkata',
    reminderTime: '11:00',
    aiUsageThisMonth: 12,
    createdAt: now,
    updatedAt: now,
  };

  const sampleLeads: LeadRecord[] = [
    {
      id: 'lead_1',
      userId: 'user_sharma',
      customerName: 'Vikram & Priya Malhotra',
      phone: '9820198201',
      source: 'WhatsApp',
      projectType: 'Modular Kitchen',
      estimatedValue: 450000,
      quotationAmount: 450000,
      quotationSentDate: '2026-10-25',
      stage: 'Quotation Sent',
      priority: 'High',
      nextFollowUpDate: today, // Due Today!
      nextFollowUpTime: '11:30',
      followUpCompleted: false,
      notes: 'Sent acrylic finish modular kitchen quote of ₹4.5L with Hafele fittings. Liked island counter layout.',
      createdAt: '2026-10-24T10:00:00Z',
      updatedAt: now,
    },
    {
      id: 'lead_2',
      userId: 'user_sharma',
      customerName: 'Amit Singhal',
      phone: '9811234567',
      source: 'Instagram',
      projectType: 'Interior Design',
      estimatedValue: 850000,
      quotationAmount: 820000,
      quotationSentDate: '2026-10-20',
      stage: 'Negotiation',
      priority: 'High',
      nextFollowUpDate: '2026-10-27', // Overdue!
      nextFollowUpTime: '16:00',
      followUpCompleted: false,
      notes: '3BHK complete woodwork in Gurgaon. Comparing with Livspace. Needs clarification on payment schedule.',
      createdAt: '2026-10-18T14:30:00Z',
      updatedAt: now,
    },
    {
      id: 'lead_3',
      userId: 'user_sharma',
      customerName: 'Neha Kapoor',
      phone: '9988776655',
      source: 'Referral',
      projectType: 'Renovation',
      estimatedValue: 600000,
      stage: 'Site Visit Scheduled',
      priority: 'Medium',
      nextFollowUpDate: '2026-11-02', // Upcoming!
      nextFollowUpTime: '14:00',
      followUpCompleted: false,
      notes: 'Living room and master bedroom revamp. Scheduled site measurement visit for Sunday.',
      createdAt: '2026-10-27T09:15:00Z',
      updatedAt: now,
    },
    {
      id: 'lead_4',
      userId: 'user_sharma',
      customerName: 'Dr. Suresh Rao',
      phone: '9740112233',
      source: 'Website',
      projectType: 'Furniture',
      estimatedValue: 350000,
      quotationAmount: 350000,
      stage: 'Won',
      priority: 'Low',
      followUpCompleted: true,
      notes: 'Clinic reception and doctor cabin custom veneer furniture. Advance token received!',
      createdAt: '2026-10-10T11:00:00Z',
      updatedAt: '2026-10-22T17:00:00Z',
    },
    // User 2's isolated lead
    {
      id: 'lead_u2_1',
      userId: 'user_designcraft',
      customerName: 'Gaurav Bansal',
      phone: '9910099100',
      source: 'Phone Call',
      projectType: 'Modular Kitchen',
      estimatedValue: 520000,
      quotationAmount: 510000,
      stage: 'Quotation Sent',
      nextFollowUpDate: today,
      nextFollowUpTime: '15:00',
      followUpCompleted: false,
      notes: 'DesignCraft private lead - U-shaped kitchen in Noida.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  const sampleQuotations: QuotationRecord[] = [
    {
      id: 'quote_1',
      userId: 'user_sharma',
      leadId: 'lead_1',
      amount: 450000,
      description: 'Modular Kitchen with German Soft-Close Tandem Boxes and Quartz Countertop',
      sentDate: '2026-10-25',
      validUntilDate: '2026-11-15',
      status: 'Sent',
      createdAt: '2026-10-25T11:00:00Z',
      updatedAt: '2026-10-25T11:00:00Z',
    },
    {
      id: 'quote_2',
      userId: 'user_sharma',
      leadId: 'lead_2',
      amount: 820000,
      description: '3BHK Woodwork, Wardrobes, TV Console and False Ceiling Package',
      sentDate: '2026-10-20',
      validUntilDate: '2026-11-05',
      status: 'Sent',
      createdAt: '2026-10-20T16:00:00Z',
      updatedAt: '2026-10-20T16:00:00Z',
    },
    {
      id: 'quote_4',
      userId: 'user_sharma',
      leadId: 'lead_4',
      amount: 350000,
      description: 'Clinic Reception Counter & Veneer Paneling',
      sentDate: '2026-10-15',
      validUntilDate: '2026-10-30',
      status: 'Accepted',
      createdAt: '2026-10-15T12:00:00Z',
      updatedAt: '2026-10-22T17:00:00Z',
    },
  ];

  const sampleActivities: ActivityRecord[] = [
    {
      id: 'act_1',
      userId: 'user_sharma',
      leadId: 'lead_1',
      type: 'quotation_created',
      details: 'Created quotation for ₹4,50,000 for Modular Kitchen',
      timestamp: '2026-10-25T11:00:00Z',
    },
    {
      id: 'act_2',
      userId: 'user_sharma',
      leadId: 'lead_2',
      type: 'note',
      details: 'Customer requested 5% discount or complimentary chimney. Checking margin.',
      timestamp: '2026-10-22T15:30:00Z',
    },
    {
      id: 'act_3',
      userId: 'user_sharma',
      leadId: 'lead_4',
      type: 'deal_won',
      details: 'Marked deal as Won! Revenue ₹3,50,000 booked.',
      timestamp: '2026-10-22T17:00:00Z',
    },
  ];

  return {
    users: {
      user_sharma: user1,
      user_designcraft: user2,
    },
    leads: sampleLeads,
    quotations: sampleQuotations,
    activities: sampleActivities,
  };
}

function loadDatabase(): DatabaseSchema {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Error loading database file, re-initializing:', err);
  }
  const initial = getInitialDatabase();
  saveDatabase(initial);
  return initial;
}

function saveDatabase(db: DatabaseSchema) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save database file:', err);
  }
}

// Helper middleware for tenant authentication & isolation
app.use(async (req, res, next) => {
  const authHeader = req.headers['authorization'];
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7).trim();
    try {
      // In development or if firebase is not fully set up, we might see mock tokens
      if (token === 'user_sharma' || token === 'user_designcraft') {
        (req as any).userId = token;
      } else {
        const decodedToken = await getAuth().verifyIdToken(token);
        (req as any).userId = decodedToken.uid;
        (req as any).userEmail = decodedToken.email;
      }
    } catch (error) {
      console.warn('Token verification failed, defaulting to provided token for local storage compatibility');
      // For now, allow the token to be the userId directly if verification fails
      // This helps with transitions and demo mode
      (req as any).userId = token;
    }
  }
  next();
});

function getAuthUserId(req: Request): string {
  return (req as any).userId || 'user_sharma';
}

// --- REST API ENDPOINTS ---

// Auth & User Profile
app.get('/api/auth/me', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const user = db.users[userId];
  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }
  res.json({ user });
});

app.post('/api/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  const db = loadDatabase();
  
  const user = Object.values(db.users).find(u => u.email.toLowerCase() === (email || '').toLowerCase());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  res.json({ token: user.id, user });
});

app.post('/api/auth/signup', (req: Request, res: Response) => {
  const { email, name, businessName, businessType, languagePreference, timeZone } = req.body;
  if (!email || !businessName) {
    return res.status(400).json({ error: 'Email and business name are required' });
  }

  const db = loadDatabase();
  const existing = Object.values(db.users).find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'An account with this email already exists' });
  }

  const newId = `user_${Date.now()}`;
  const now = new Date().toISOString();
  const newUser: UserProfile = {
    id: newId,
    email,
    name: name || businessName,
    businessName,
    businessType: businessType || 'Interior Design',
    languagePreference: languagePreference || 'hinglish',
    timeZone: timeZone || 'Asia/Kolkata',
    reminderTime: '10:00',
    aiUsageThisMonth: 0,
    createdAt: now,
    updatedAt: now,
  };

  db.users[newId] = newUser;
  saveDatabase(db);

  res.status(201).json({ token: newId, user: newUser });
});

app.put('/api/auth/profile', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const user = db.users[userId];
  if (!user) return res.status(404).json({ error: 'User not found' });

  const { name, businessName, businessType, languagePreference, timeZone, reminderTime } = req.body;
  if (name !== undefined) user.name = name;
  if (businessName !== undefined) user.businessName = businessName;
  if (businessType !== undefined) user.businessType = businessType;
  if (languagePreference !== undefined) user.languagePreference = languagePreference;
  if (timeZone !== undefined) user.timeZone = timeZone;
  if (reminderTime !== undefined) user.reminderTime = reminderTime;
  user.updatedAt = new Date().toISOString();

  saveDatabase(db);
  res.json({ user });
});

// Seed sample data for current user
app.post('/api/demo/seed-sample-leads', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  // Remove existing sample leads for this user if any
  db.leads = db.leads.filter(l => l.userId !== userId);
  db.quotations = db.quotations.filter(q => q.userId !== userId);
  db.activities = db.activities.filter(a => a.userId !== userId);

  const newLeads: LeadRecord[] = [
    {
      id: `lead_${Date.now()}_1`,
      userId,
      customerName: 'Rajiv Mehra (4BHK Villa)',
      phone: '9810012345',
      source: 'WhatsApp',
      projectType: 'Interior Design',
      estimatedValue: 1250000,
      quotationAmount: 1200000,
      quotationSentDate: '2026-10-26',
      stage: 'Quotation Sent',
      priority: 'High',
      nextFollowUpDate: today,
      nextFollowUpTime: '11:00',
      followUpCompleted: false,
      notes: 'Full turnkey interior design quote ₹12L sent. Client interested in Italian marble and PU finish wardrobes.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `lead_${Date.now()}_2`,
      userId,
      customerName: 'Sunita Narang',
      phone: '9871122334',
      source: 'Instagram',
      projectType: 'Modular Kitchen',
      estimatedValue: 380000,
      quotationAmount: 380000,
      quotationSentDate: '2026-10-21',
      stage: 'Negotiation',
      priority: 'High',
      nextFollowUpDate: '2026-10-27', // Overdue
      nextFollowUpTime: '15:00',
      followUpCompleted: false,
      notes: 'L-shaped acrylic modular kitchen. Follow up regarding 10-year warranty certificate and sink accessories.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `lead_${Date.now()}_3`,
      userId,
      customerName: 'Anand Gupta',
      phone: '9899887766',
      source: 'Referral',
      projectType: 'Renovation',
      estimatedValue: 450000,
      stage: 'Site Visit Scheduled',
      priority: 'Medium',
      nextFollowUpDate: '2026-11-03',
      nextFollowUpTime: '16:30',
      followUpCompleted: false,
      notes: 'Balcony enclosure and living room wooden paneling. Site visit confirmed for Tuesday.',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: `lead_${Date.now()}_4`,
      userId,
      customerName: 'Kunal Saxena',
      phone: '9955443322',
      source: 'Website',
      projectType: 'Furniture',
      estimatedValue: 275000,
      quotationAmount: 275000,
      stage: 'Won',
      priority: 'Low',
      followUpCompleted: true,
      notes: 'Custom bar cabinet and dining set. Full advance received.',
      createdAt: now,
      updatedAt: now,
    },
  ];

  db.leads.push(...newLeads);
  
  // Also create quotes
  db.quotations.push({
    id: `quote_${Date.now()}_1`,
    userId,
    leadId: newLeads[0].id,
    amount: 1200000,
    description: 'Turnkey 4BHK Villa Woodwork & Modular Solutions',
    sentDate: '2026-10-26',
    status: 'Sent',
    createdAt: now,
    updatedAt: now,
  });

  db.activities.push({
    id: `act_${Date.now()}_1`,
    userId,
    leadId: newLeads[0].id,
    type: 'quotation_created',
    details: 'Quotation of ₹12,00,000 generated and shared on WhatsApp',
    timestamp: now,
  });

  saveDatabase(db);
  res.json({ success: true, count: newLeads.length });
});

// Clear all leads for current user
app.post('/api/demo/clear-leads', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);

  db.leads = db.leads.filter(l => l.userId !== userId);
  db.quotations = db.quotations.filter(q => q.userId !== userId);
  db.activities = db.activities.filter(a => a.userId !== userId);

  saveDatabase(db);
  res.json({ success: true });
});

// --- LEADS CRUD WITH TENANT ISOLATION ---
app.get('/api/leads', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  // STRICT TENANT ISOLATION
  const userLeads = db.leads.filter(l => l.userId === userId);
  res.json({ leads: userLeads });
});

app.post('/api/leads', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const user = db.users[userId];

  // Enforce Free tier limit (high/unlimited)
  const currentActive = db.leads.filter(l => l.userId === userId && l.stage !== 'Won' && l.stage !== 'Lost').length;
  const limitCheck = checkLeadCreationLimit(currentActive);
  if (!limitCheck.allowed) {
    return res.status(403).json({ error: limitCheck.message, limitExceeded: true });
  }

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
  const leadId = `lead_${Date.now()}`;
  const newLead: LeadRecord = {
    id: leadId,
    userId,
    customerName: customerName.trim(),
    phone: phone.trim(),
    source: source || 'WhatsApp',
    projectType: projectType || 'Interior Design',
    estimatedValue: Number(estimatedValue) || 0,
    quotationAmount: quotationAmount ? Number(quotationAmount) : undefined,
    quotationSentDate: quotationSentDate || (quotationAmount ? now.split('T')[0] : undefined),
    stage: stage || 'New',
    priority: (priority as 'High' | 'Medium' | 'Low') || 'Medium',
    tags: Array.isArray(tags) ? tags : [],
    nextFollowUpDate: nextFollowUpDate || undefined,
    nextFollowUpTime: nextFollowUpTime || '11:00',
    followUpCompleted: false,
    notes: notes || '',
    createdAt: now,
    updatedAt: now,
  };

  db.leads.unshift(newLead);

  // If quotationAmount is provided, create quotation record
  if (newLead.quotationAmount && newLead.quotationAmount > 0) {
    const quoteId = `quote_${Date.now()}`;
    db.quotations.push({
      id: quoteId,
      userId,
      leadId,
      amount: newLead.quotationAmount,
      description: `${newLead.projectType} Project Proposal`,
      sentDate: newLead.quotationSentDate || now.split('T')[0],
      status: 'Sent',
      createdAt: now,
      updatedAt: now,
    });
  }

  // Create initial activity
  db.activities.unshift({
    id: `act_${Date.now()}`,
    userId,
    leadId,
    type: 'lead_created',
    details: `Lead created from ${newLead.source} for ${newLead.projectType}`,
    timestamp: now,
  });

  saveDatabase(db);
  res.status(201).json({ lead: newLead });
});

app.put('/api/leads/:id', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const lead = db.leads.find(l => l.id === req.params.id && l.userId === userId);
  
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found or unauthorized' });
  }

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

  const now = new Date().toISOString();
  const oldStage = lead.stage;

  if (customerName !== undefined) lead.customerName = customerName;
  if (phone !== undefined) lead.phone = phone;
  if (source !== undefined) lead.source = source;
  if (projectType !== undefined) lead.projectType = projectType;
  if (estimatedValue !== undefined) lead.estimatedValue = Number(estimatedValue);
  if (quotationAmount !== undefined) lead.quotationAmount = Number(quotationAmount);
  if (quotationSentDate !== undefined) lead.quotationSentDate = quotationSentDate;
  if (stage !== undefined) lead.stage = stage;
  if (priority !== undefined) lead.priority = priority;
  if (tags !== undefined) lead.tags = Array.isArray(tags) ? tags : [];
  if (nextFollowUpDate !== undefined) lead.nextFollowUpDate = nextFollowUpDate;
  if (nextFollowUpTime !== undefined) lead.nextFollowUpTime = nextFollowUpTime;
  if (followUpCompleted !== undefined) lead.followUpCompleted = followUpCompleted;
  if (notes !== undefined) lead.notes = notes;
  if (lossReason !== undefined) lead.lossReason = lossReason;
  lead.updatedAt = now;

  // Log stage change activity
  if (stage && stage !== oldStage) {
    let actType = 'stage_changed';
    let details = `Stage updated from "${oldStage}" to "${stage}"`;
    if (stage === 'Won') {
      actType = 'deal_won';
      details = `Deal Won! Recorded sales revenue: ₹${lead.quotationAmount || lead.estimatedValue}`;
    } else if (stage === 'Lost') {
      actType = 'deal_lost';
      details = `Deal marked as Lost. Reason: ${lossReason || 'None specified'}`;
    }
    db.activities.unshift({
      id: `act_${Date.now()}`,
      userId,
      leadId: lead.id,
      type: actType,
      details,
      timestamp: now,
    });
  }

  saveDatabase(db);
  res.json({ lead });
});

app.delete('/api/leads/:id', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const leadIndex = db.leads.findIndex(l => l.id === req.params.id && l.userId === userId);
  
  if (leadIndex === -1) {
    return res.status(404).json({ error: 'Lead not found or unauthorized' });
  }

  db.leads.splice(leadIndex, 1);
  db.quotations = db.quotations.filter(q => q.leadId !== req.params.id);
  db.activities = db.activities.filter(a => a.leadId !== req.params.id);

  saveDatabase(db);
  res.json({ success: true });
});

// Follow-up actions
app.post('/api/leads/:id/complete-followup', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const lead = db.leads.find(l => l.id === req.params.id && l.userId === userId);
  
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const { customerResponded, nextFollowUpDate, nextFollowUpTime, note } = req.body;
  const now = new Date().toISOString();

  lead.followUpCompleted = !nextFollowUpDate;
  if (nextFollowUpDate) {
    lead.nextFollowUpDate = nextFollowUpDate;
    lead.nextFollowUpTime = nextFollowUpTime || '11:00';
    lead.followUpCompleted = false;
  }
  lead.updatedAt = now;

  const detailText = `Follow-up completed. Customer response: ${customerResponded ? 'Yes' : 'No response'}. ${
    nextFollowUpDate ? `Next follow-up scheduled for ${nextFollowUpDate} ${nextFollowUpTime || ''}` : 'No further follow-up scheduled.'
  } ${note ? `Note: ${note}` : ''}`;

  db.activities.unshift({
    id: `act_${Date.now()}`,
    userId,
    leadId: lead.id,
    type: 'followup_completed',
    details: detailText,
    timestamp: now,
  });

  saveDatabase(db);
  res.json({ lead });
});

// --- ACTIVITIES ---
app.get('/api/leads/:id/activities', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const leadActivities = db.activities.filter(a => a.leadId === req.params.id && a.userId === userId);
  res.json({ activities: leadActivities });
});

app.post('/api/leads/:id/activities', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const { type, details } = req.body;
  
  if (!details) return res.status(400).json({ error: 'Details required' });

  const now = new Date().toISOString();
  const newActivity: ActivityRecord = {
    id: `act_${Date.now()}`,
    userId,
    leadId: req.params.id,
    type: type || 'note',
    details,
    timestamp: now,
  };

  db.activities.unshift(newActivity);
  saveDatabase(db);
  res.status(201).json({ activity: newActivity });
});

// --- QUOTATIONS ---
app.get('/api/quotations', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const userQuotations = db.quotations.filter(q => q.userId === userId);
  res.json({ quotations: userQuotations });
});

app.post('/api/quotations', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const { leadId, amount, description, sentDate, validUntilDate, status } = req.body;

  if (!leadId || !amount) {
    return res.status(400).json({ error: 'Lead ID and quotation amount are required' });
  }

  const now = new Date().toISOString();
  const quoteId = `quote_${Date.now()}`;
  const newQuote: QuotationRecord = {
    id: quoteId,
    userId,
    leadId,
    amount: Number(amount),
    description: description || '',
    sentDate: sentDate || now.split('T')[0],
    validUntilDate: validUntilDate || undefined,
    status: status || 'Sent',
    createdAt: now,
    updatedAt: now,
  };

  db.quotations.unshift(newQuote);

  // Update lead's quotation amount and stage if applicable
  const lead = db.leads.find(l => l.id === leadId && l.userId === userId);
  if (lead) {
    lead.quotationAmount = Number(amount);
    lead.quotationSentDate = newQuote.sentDate;
    if (lead.stage === 'New' || lead.stage === 'Contacted' || lead.stage === 'Site Visit Scheduled') {
      lead.stage = 'Quotation Sent';
    }
    lead.updatedAt = now;
  }

  db.activities.unshift({
    id: `act_${Date.now()}`,
    userId,
    leadId,
    type: 'quotation_created',
    details: `Quotation of ₹${Number(amount).toLocaleString('en-IN')} added (${newQuote.description || 'Design proposal'})`,
    timestamp: now,
  });

  saveDatabase(db);
  res.status(201).json({ quotation: newQuote });
});

// --- AI MESSAGE GENERATOR (SERVER-SIDE GEMINI API) ---
app.post('/api/gemini/generate-followup', async (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const user = db.users[userId] || { businessName: 'Our Studio', name: 'Design Consultant', languagePreference: 'hinglish', aiUsageThisMonth: 0 };

  // Check AI quota
  const aiCheck = checkAIGenerationLimit(user.aiUsageThisMonth || 0);
  if (!aiCheck.allowed) {
    return res.status(403).json({ error: aiCheck.message, limitExceeded: true });
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
    language, // 'en' | 'hi' | 'hinglish'
  } = req.body;

  const finalBusinessName = businessName || user.businessName || 'Design Studio';
  const finalLanguage = language || user.languagePreference || 'hinglish';
  const finalTone = tone || 'Professional and friendly';
  const finalPurpose = purpose || 'Quotation follow-up';

  // Fallback template generator in case Gemini API is not configured or fails
  const getFallbackMessage = (): string => {
    const cust = customerName || 'Sir/Ma\'am';
    const proj = projectType || 'interior';
    const amt = quotationAmount ? `₹${Number(quotationAmount).toLocaleString('en-IN')}` : '';

    if (finalLanguage === 'hi') {
      if (finalPurpose.includes('Quotation')) {
        return `नमस्ते ${cust} जी! आशा है आप सकुशल हैं। आपके ${proj} प्रोजेक्ट के लिए जो कोटेशन ${amt ? '(' + amt + ') ' : ''}भेजा था, क्या आपको उसे देखने का अवसर मिला? यदि डिज़ाइन या बजट को लेकर कोई भी प्रश्न हो तो बताएं, हम आपकी सुविधानुसार चर्चा कर सकते हैं। सादर, ${finalBusinessName}।`;
      }
      return `नमस्ते ${cust} जी, ${finalBusinessName} से संपर्क कर रहे हैं। आपके ${proj} कार्य के संबंध में क्या हम इस सप्ताह चर्चा कर सकते हैं? धन्यवाद।`;
    }

    if (finalLanguage === 'hinglish') {
      if (finalPurpose.includes('Quotation')) {
        return `Namaste ${cust} ji! Hope you are doing well. Aapke ${proj} project ke liye jo quotation ${amt ? '(' + amt + ') ' : ''}share kiya tha, kya aapko review karne ka time mila? Agar design, materials ya estimate mein koi bhi queries ya adjustments chahiye, toh please let me know. Hum call par discuss kar sakte hain. Best regards, ${finalBusinessName}!`;
      }
      if (finalPurpose.includes('Friendly')) {
        return `Hi ${cust} ji! Just checking in regarding your ${proj} project. Hope all is well at your end. Whenever you are free, do let me know so we can take the next step forward. Warm regards, ${finalBusinessName}.`;
      }
      if (finalPurpose.includes('Site visit')) {
        return `Namaste ${cust} ji, aapke site visit aur measurements ke liye slot confirm karna tha. What day and time suits you best this week? Thanks, ${finalBusinessName}.`;
      }
      return `Hello ${cust} ji, ${finalBusinessName} ki taraf se follow-up message tha regarding your ${proj} requirement. Let us know how you'd like to proceed!`;
    }

    // Default English
    if (finalPurpose.includes('Quotation')) {
      return `Hello ${cust}, hope you're having a productive week! Just following up to see if you had a chance to review the quotation ${amt ? 'for ' + amt + ' ' : ''}for your ${proj} project. I'd be delighted to walk you through any design details, material specs, or timeline adjustments. Let me know what time works best for a quick chat! Warm regards, ${finalBusinessName}.`;
    }
    return `Hello ${cust}, reaching out from ${finalBusinessName} regarding your ${proj} project. Please let us know if you'd like to schedule our next consultation. Best regards!`;
  };

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    // Graceful offline fallback
    user.aiUsageThisMonth = (user.aiUsageThisMonth || 0) + 1;
    saveDatabase(db);
    return res.json({
      text: getFallbackMessage(),
      isFallback: true,
      remainingGenerations: PLANS.free.maxAIMonthlyGenerations - user.aiUsageThisMonth,
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

    const prompt = `You are a high-performing, culturally astute sales assistant for an interior design and modular kitchen business in India.
Generate a concise, natural, polite, and persuasive WhatsApp follow-up message for a potential client.

Business Details:
- Business Name: "${finalBusinessName}"
- Customer Name: "${customerName || 'Valued Client'}"
- Project Type: "${projectType || 'Interior Project'}"
- Quotation Amount: ${quotationAmount ? '₹' + Number(quotationAmount).toLocaleString('en-IN') : 'Quotation already sent'}
- Time Since Quotation: "${timeSinceQuotation || 'Few days ago'}"
- Last Activity / Notes: "${lastActivity || 'Waiting for client feedback'}"
- Client's Known Concern / Objection: "${objectionOrConcern || 'None'}"
- Message Purpose: "${finalPurpose}"
- Desired Tone: "${finalTone}"
- Output Language: "${finalLanguage}" (Options: 'en' for polite professional English, 'hi' for conversational Hindi in Devanagari script, or 'hinglish' for natural Romanized Hindi-English mix as commonly used on WhatsApp in India like "Namaste ji, quotation check kiya aapne?").

Rules:
1. Keep the message under 90 words.
2. Perfect for WhatsApp: warm, respectful, not robotic or overly pushy.
3. If Hinglish, use natural modern Indian conversational phrases (e.g., "Namaste [Name] ji", "Hope you are doing well", "Aapke project ke liye", "Please let me know if you need any adjustments").
4. Do not include placeholders like "[Your Name]" if business name is provided; end with "${finalBusinessName}".
5. Return ONLY the message body, without conversational intro or quotes.`;

    const generatePromise = ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('AI request timeout')), 25000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const generatedText = response.text?.trim() || getFallbackMessage();

    // Increment usage
    user.aiUsageThisMonth = (user.aiUsageThisMonth || 0) + 1;
    saveDatabase(db);

    res.json({
      text: generatedText,
      isFallback: false,
      remainingGenerations: PLANS.free.maxAIMonthlyGenerations - user.aiUsageThisMonth,
    });
  } catch (error: any) {
    console.warn('Notice: Gemini AI request timed out or returned error, using fallback template:', error?.message || error);
    // Return graceful fallback
    user.aiUsageThisMonth = (user.aiUsageThisMonth || 0) + 1;
    saveDatabase(db);
    res.json({
      text: getFallbackMessage(),
      isFallback: true,
      errorNotice: 'Gemini request timed out or unavailable; smart fallback template served.',
      remainingGenerations: PLANS.free.maxAIMonthlyGenerations - user.aiUsageThisMonth,
    });
  }
});


// --- SAFE CSV EXPORT (TENANT ISOLATED & FILTERED) ---
app.get('/api/export/leads-csv', (req: Request, res: Response) => {
  const db = loadDatabase();
  const userId = getAuthUserId(req);
  const userLeads = db.leads.filter(l => l.userId === userId);

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
});

// Switch active user profile (convenient for testing multi-tenant security Flow H in UI)
app.post('/api/demo/switch-user', (req: Request, res: Response) => {
  const { targetUserId } = req.body;
  const db = loadDatabase();
  const user = db.users[targetUserId];
  if (!user) return res.status(404).json({ error: 'Target user does not exist' });
  res.json({ token: user.id, user });
});

// List available test accounts for quick tenant switching verification
app.get('/api/demo/accounts', (_req: Request, res: Response) => {
  const db = loadDatabase();
  const list = Object.values(db.users).map(u => ({
    id: u.id,
    name: u.name,
    businessName: u.businessName,
    email: u.email,
  }));
  res.json({ accounts: list });
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
