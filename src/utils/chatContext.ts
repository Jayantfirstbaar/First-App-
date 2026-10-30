import { Lead, UserProfile, ChatContextSnapshot, ChatLeadSnapshot, ChatStatsSnapshot } from '../types/index.js';

const MAX_SNAPSHOT_BYTES = 40000; // ~40KB safe limit

/**
 * Returns today's date in YYYY-MM-DD for the given IANA timezone (default Asia/Kolkata).
 */
export function getTodayDateInTimezone(tz: string = 'Asia/Kolkata'): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Calculates days elapsed between quotation date and today.
 */
function calculateDaysSince(dateStr?: string, todayStr?: string): number | undefined {
  if (!dateStr) return undefined;
  try {
    const sent = new Date(dateStr).getTime();
    const today = todayStr ? new Date(todayStr).getTime() : Date.now();
    const diff = Math.floor((today - sent) / (1000 * 60 * 60 * 24));
    return isNaN(diff) ? undefined : Math.max(0, diff);
  } catch {
    return undefined;
  }
}

/**
 * Sanitizes text to remove potential phone numbers, emails, or PII.
 */
export function sanitizeText(str: string | undefined, maxLen = 120): string | undefined {
  if (!str) return undefined;
  let sanitized = String(str);

  // 1. Mask email addresses
  sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL REDACTED]');

  // 2. Mask phone numbers (Indian 5+5 mobile, 10 continuous digits, international prefix, landlines with STD codes)
  sanitized = sanitized.replace(/(?:\+?\d{1,4}[-.\s]*)?(?:\(?0?\d{2,5}\)?[-.\s]*)?\d{3,5}[-.\s]*\d{4,5}\b/g, '[PHONE REDACTED]');
  sanitized = sanitized.replace(/\b\d{10,12}\b/g, '[PHONE REDACTED]');

  return sanitized.trim().slice(0, maxLen);
}

/**
 * Builds a compact, privacy-safe context snapshot from client-side state.
 * Customer phone numbers and emails are NEVER included.
 */
export function buildChatContextSnapshot(
  user: UserProfile | null | undefined,
  leadsList: unknown
): ChatContextSnapshot {
  const safeLeads: Lead[] = Array.isArray(leadsList)
    ? leadsList.filter(l => l && typeof l === 'object' && typeof l.id === 'string')
    : [];

  const timeZone = user?.timeZone || 'Asia/Kolkata';
  const todayDate = getTodayDateInTimezone(timeZone);
  const currentYearMonth = todayDate.slice(0, 7); // e.g. "2026-10"

  // 1. Calculate high-level pipeline stats
  let activeLeads = 0;
  let overdueCount = 0;
  let dueTodayCount = 0;
  let pendingQuotationValue = 0;
  let wonValueThisMonth = 0;
  let wonCount = 0;
  let lostCount = 0;

  for (const lead of safeLeads) {
    const isClosed = lead.stage === 'Won' || lead.stage === 'Lost';
    const amount = Number(lead.quotationAmount || lead.estimatedValue) || 0;

    if (!isClosed) {
      activeLeads++;

      if (lead.nextFollowUpDate && !lead.followUpCompleted) {
        if (lead.nextFollowUpDate < todayDate) {
          overdueCount++;
        } else if (lead.nextFollowUpDate === todayDate) {
          dueTodayCount++;
        }
      }

      if (lead.stage === 'Quotation Sent' || lead.stage === 'Negotiation') {
        pendingQuotationValue += amount;
      }
    } else {
      if (lead.stage === 'Won') {
        wonCount++;
        const leadDate = (lead.updatedAt || lead.quotationSentDate || lead.createdAt || '').slice(0, 7);
        if (leadDate === currentYearMonth) {
          wonValueThisMonth += amount;
        }
      } else if (lead.stage === 'Lost') {
        lostCount++;
      }
    }
  }

  const closedTotal = wonCount + lostCount;
  const winRatePercent = closedTotal > 0 ? Math.round((wonCount / closedTotal) * 100) : 0;

  const stats: ChatStatsSnapshot = {
    activeLeads,
    overdueCount,
    dueTodayCount,
    pendingQuotationValue,
    wonValueThisMonth,
    winRatePercent,
  };

  // 2. Prioritize leads for context (Overdue first, Due today, Quotation sent / Negotiation, then others)
  const prioritized = [...safeLeads].sort((a, b) => {
    const getScore = (lead: Lead) => {
      if (lead.stage === 'Won' || lead.stage === 'Lost') return 0;
      if (lead.nextFollowUpDate && !lead.followUpCompleted && lead.nextFollowUpDate < todayDate) return 100;
      if (lead.nextFollowUpDate && !lead.followUpCompleted && lead.nextFollowUpDate === todayDate) return 80;
      if (lead.stage === 'Negotiation') return 60;
      if (lead.stage === 'Quotation Sent') return 50;
      if (lead.priority === 'High') return 40;
      return 10;
    };
    return getScore(b) - getScore(a);
  });

  // 3. Take up to 100 leads and map to strict privacy-safe snapshot
  let candidateLeads: ChatLeadSnapshot[] = prioritized.slice(0, 100).map(l => {
    const snap: ChatLeadSnapshot = {
      id: String(l.id),
      customerName: sanitizeText(l.customerName, 60) || 'Client',
      stage: l.stage,
      projectType: String(l.projectType || 'Interior Design').slice(0, 40),
      estimatedValue: Number(l.estimatedValue) || 0,
      quotationAmount: l.quotationAmount ? Number(l.quotationAmount) : undefined,
      nextFollowUpDate: l.nextFollowUpDate || undefined,
      daysSinceQuotation: calculateDaysSince(l.quotationSentDate, todayDate),
      priority: l.priority || 'Medium',
      lastNote: sanitizeText(l.notes, 120),
    };
    return snap;
  });

  const baseSnapshot: ChatContextSnapshot = {
    businessName: sanitizeText(user?.businessName, 60) || 'Interior Studio',
    businessType: sanitizeText(user?.businessType, 50) || 'Interior Design',
    language: user?.languagePreference || 'hinglish',
    todayDate,
    timeZone,
    stats,
    leads: candidateLeads,
  };

  // 4. Enforce strict 40KB payload size cap
  let jsonString = JSON.stringify(baseSnapshot);
  while (jsonString.length > MAX_SNAPSHOT_BYTES && candidateLeads.length > 5) {
    // Prune 10 leads at a time until under threshold
    candidateLeads = candidateLeads.slice(0, Math.max(5, candidateLeads.length - 10));
    baseSnapshot.leads = candidateLeads;
    jsonString = JSON.stringify(baseSnapshot);
  }

  return baseSnapshot;
}
