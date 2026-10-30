export interface LeadData {
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
  nextFollowUpDate?: string; // YYYY-MM-DD
  nextFollowUpTime?: string; // HH:mm
  followUpCompleted?: boolean;
  notes?: string;
  lossReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface QuotationData {
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

/**
 * Conversion rate = Won leads / (Won leads + Lost leads) * 100
 * Only resolved leads (Won or Lost) are counted in the denominator.
 * Returns 0 if no resolved leads exist.
 */
export function calculateConversionRate(leads: LeadData[]): { rate: number; wonCount: number; lostCount: number; resolvedCount: number } {
  const wonCount = leads.filter(l => l.stage === 'Won').length;
  const lostCount = leads.filter(l => l.stage === 'Lost').length;
  const resolvedCount = wonCount + lostCount;
  
  if (resolvedCount === 0) {
    return { rate: 0, wonCount: 0, lostCount: 0, resolvedCount: 0 };
  }
  
  const rate = Math.round((wonCount / resolvedCount) * 100);
  return { rate, wonCount, lostCount, resolvedCount };
}

/**
 * Calculates total revenue from leads in 'Won' stage.
 */
export function calculateWonRevenue(leads: LeadData[]): number {
  return leads
    .filter(l => l.stage === 'Won')
    .reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
}

/**
 * Calculates total potential open pipeline value.
 * Includes open leads (New, Contacted, Site Visit Scheduled, Quotation Sent, Negotiation).
 * Excludes Won and Lost.
 */
export function calculatePipelineValue(leads: LeadData[]): { totalValue: number; openCount: number; quotationSentValue: number } {
  const openStages = ['New', 'Contacted', 'Site Visit Scheduled', 'Quotation Sent', 'Negotiation'];
  const openLeads = leads.filter(l => openStages.includes(l.stage));
  
  const totalValue = openLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
  
  const quotationSentLeads = leads.filter(l => l.stage === 'Quotation Sent' || l.stage === 'Negotiation');
  const quotationSentValue = quotationSentLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);
  
  return {
    totalValue,
    openCount: openLeads.length,
    quotationSentValue,
  };
}

/**
 * Categorizes a lead's follow-up status relative to a reference date string (YYYY-MM-DD).
 */
export function categorizeFollowUp(
  lead: LeadData,
  todayStr: string
): 'overdue' | 'today' | 'upcoming' | 'completed' | 'none' {
  if (lead.stage === 'Won' || lead.stage === 'Lost') {
    return 'none';
  }
  
  if (lead.followUpCompleted) {
    return 'completed';
  }
  
  if (!lead.nextFollowUpDate) {
    return 'none';
  }
  
  if (lead.nextFollowUpDate < todayStr) {
    return 'overdue';
  }
  if (lead.nextFollowUpDate === todayStr) {
    return 'today';
  }
  return 'upcoming';
}

/**
 * Format Indian Rupee currency (₹) with standard Indian numbering format (lakhs, crores).
 * Example: 250000 -> ₹2,50,000
 */
export function formatINR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return '₹0';
  }
  const isNegative = amount < 0;
  const absAmount = Math.abs(Math.round(amount));
  const numStr = absAmount.toString();
  
  let result = '';
  if (numStr.length <= 3) {
    result = numStr;
  } else {
    const lastThree = numStr.substring(numStr.length - 3);
    const otherNumbers = numStr.substring(0, numStr.length - 3);
    const formattedOther = otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    result = `${formattedOther},${lastThree}`;
  }
  
  return `${isNegative ? '-' : ''}₹${result}`;
}

/**
 * Validates and cleans Indian phone numbers.
 * Supports:
 * - 10-digit mobile numbers: 9876543210
 * - With +91: +919876543210 or +91 98765 43210
 * - With 0 prefix: 09876543210
 * Returns cleaned international format for WhatsApp (+91...) or standard.
 */
export function validateAndCleanIndianPhone(input: string): { isValid: boolean; cleaned: string; formattedDisplay: string; whatsAppNumber: string } {
  if (!input) {
    return { isValid: false, cleaned: '', formattedDisplay: '', whatsAppNumber: '' };
  }
  
  // Strip non-digits except initial '+'
  const hasPlus = input.trim().startsWith('+');
  const digitsOnly = input.replace(/\D/g, '');
  
  // Valid Indian mobile numbers are 10 digits starting with 6, 7, 8, or 9
  let tenDigit = '';
  
  if (digitsOnly.length === 10 && /^[6-9]\d{9}$/.test(digitsOnly)) {
    tenDigit = digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0') && /^[6-9]\d{9}$/.test(digitsOnly.substring(1))) {
    tenDigit = digitsOnly.substring(1);
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91') && /^[6-9]\d{9}$/.test(digitsOnly.substring(2))) {
    tenDigit = digitsOnly.substring(2);
  } else if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    // Other international phone numbers
    return {
      isValid: true,
      cleaned: digitsOnly,
      formattedDisplay: hasPlus ? `+${digitsOnly}` : digitsOnly,
      whatsAppNumber: digitsOnly,
    };
  } else {
    return {
      isValid: false,
      cleaned: digitsOnly,
      formattedDisplay: input,
      whatsAppNumber: digitsOnly,
    };
  }
  
  return {
    isValid: true,
    cleaned: tenDigit,
    formattedDisplay: `+91 ${tenDigit.substring(0, 5)} ${tenDigit.substring(5)}`,
    whatsAppNumber: `91${tenDigit}`,
  };
}

export interface ExportFilterOptions {
  status?: string; // 'all' | 'open' | 'resolved' | specific stage name
  timeframe?: string; // 'all' | 'this_month' | 'last_30_days' | 'last_quarter' | 'custom'
  startDate?: string; // YYYY-MM-DD
  endDate?: string; // YYYY-MM-DD
  todayStr?: string; // YYYY-MM-DD (defaults to current date)
}

/**
 * Filter leads based on status and date range for reporting and CSV download.
 */
export function filterLeadsForExport(leads: LeadData[], options: ExportFilterOptions): LeadData[] {
  const { status = 'all', timeframe = 'all', startDate, endDate } = options;
  const today = options.todayStr || new Date().toISOString().split('T')[0];

  return leads.filter(lead => {
    // 1. Status / Stage filter
    if (status && status !== 'all') {
      if (status === 'open') {
        const openStages = ['New', 'Contacted', 'Site Visit Scheduled', 'Quotation Sent', 'Negotiation'];
        if (!openStages.includes(lead.stage)) return false;
      } else if (status === 'resolved') {
        if (lead.stage !== 'Won' && lead.stage !== 'Lost') return false;
      } else {
        if (lead.stage.toLowerCase() !== status.toLowerCase()) return false;
      }
    }

    // 2. Date Range filter (evaluates lead.createdAt or quotationSentDate)
    const leadDateStr = lead.createdAt.split('T')[0];

    if (timeframe === 'this_month') {
      const monthPrefix = today.substring(0, 7);
      if (!leadDateStr.startsWith(monthPrefix)) return false;
    } else if (timeframe === 'last_30_days') {
      const d = new Date(today);
      d.setDate(d.getDate() - 30);
      const minDate = d.toISOString().split('T')[0];
      if (leadDateStr < minDate || leadDateStr > today) return false;
    } else if (timeframe === 'last_quarter') {
      const d = new Date(today);
      d.setDate(d.getDate() - 90);
      const minDate = d.toISOString().split('T')[0];
      if (leadDateStr < minDate || leadDateStr > today) return false;
    } else if (timeframe === 'custom' || startDate || endDate) {
      if (startDate && leadDateStr < startDate) return false;
      if (endDate && leadDateStr > endDate) return false;
    }

    return true;
  });
}

/**
 * Generates safely escaped CSV string from a list of leads.
 */
export function generateLeadsCsv(leads: LeadData[]): string {
  const escapeCsv = (str: any) => {
    if (str === null || str === undefined) return '""';
    const s = String(str).replace(/"/g, '""');
    return `"${s}"`;
  };

  const headers = [
    'Lead ID',
    'Customer Name',
    'Phone',
    'Lead Source',
    'Project Type',
    'Estimated Deal Value (INR)',
    'Quotation Amount (INR)',
    'Quotation Sent Date',
    'Stage',
    'Priority',
    'Next Follow-Up Date',
    'Next Follow-Up Time',
    'Follow-Up Completed',
    'Notes',
    'Loss Reason',
    'Created At',
  ];

  const rows = leads.map(l => [
    escapeCsv(l.id),
    escapeCsv(l.customerName),
    escapeCsv(l.phone),
    escapeCsv(l.source),
    escapeCsv(l.projectType),
    escapeCsv(l.estimatedValue),
    escapeCsv(l.quotationAmount || ''),
    escapeCsv(l.quotationSentDate || ''),
    escapeCsv(l.stage),
    escapeCsv(l.priority || 'Medium'),
    escapeCsv(l.nextFollowUpDate || ''),
    escapeCsv(l.nextFollowUpTime || ''),
    escapeCsv(l.followUpCompleted ? 'Yes' : 'No'),
    escapeCsv(l.notes || ''),
    escapeCsv(l.lossReason || ''),
    escapeCsv(l.createdAt),
  ]);

  return [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
}

export interface ConversionTrendPoint {
  period: string; // e.g., "Jul 26", "Aug 26", "Sep 26", "Oct 26"
  won: number;
  lost: number;
  open: number;
  conversionRate: number; // 0 to 100
  revenue: number;
}

/**
 * Calculates conversion rate and status changes trend over the past 6 calendar months.
 */
export function calculateConversionTrend(
  leads: LeadData[],
  referenceDateStr?: string
): ConversionTrendPoint[] {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  const months: Array<{ key: string; label: string }> = [];

  // Generate last 6 months list
  for (let i = 5; i >= 0; i--) {
    const d = new Date(refDate.getFullYear(), refDate.getMonth() - i, 1);
    const year = d.getFullYear();
    const monthNum = String(d.getMonth() + 1).padStart(2, '0');
    const monthShort = d.toLocaleString('en-US', { month: 'short' });
    const yearShort = String(year).slice(-2);
    months.push({
      key: `${year}-${monthNum}`,
      label: `${monthShort} '${yearShort}`,
    });
  }

  let cumulativeWon = 0;
  let cumulativeLost = 0;

  return months.map(m => {
    // Leads created in this month
    const leadsInMonth = leads.filter(l => l.createdAt && l.createdAt.startsWith(m.key));
    const wonInMonth = leadsInMonth.filter(l => l.stage === 'Won').length;
    const lostInMonth = leadsInMonth.filter(l => l.stage === 'Lost').length;
    const openInMonth = leadsInMonth.filter(l => l.stage !== 'Won' && l.stage !== 'Lost').length;
    
    cumulativeWon += wonInMonth;
    cumulativeLost += lostInMonth;

    // Monthly conversion rate
    const resolvedInMonth = wonInMonth + lostInMonth;
    let rate = 0;
    if (resolvedInMonth > 0) {
      rate = Math.round((wonInMonth / resolvedInMonth) * 100);
    } else if (cumulativeWon + cumulativeLost > 0) {
      // Smooth cumulative fallback if zero resolved deals in that particular month
      rate = Math.round((cumulativeWon / (cumulativeWon + cumulativeLost)) * 100);
    }

    const revenueInMonth = leadsInMonth
      .filter(l => l.stage === 'Won')
      .reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);

    return {
      period: m.label,
      won: wonInMonth,
      lost: lostInMonth,
      open: openInMonth,
      conversionRate: rate,
      revenue: revenueInMonth,
    };
  });
}

export interface DailyLeadTrendPoint {
  date: string; // "YYYY-MM-DD"
  displayDate: string; // e.g., "Oct 15"
  shortDate: string; // e.g., "15 Oct"
  dayOfWeek: string; // "Mon", "Tue", etc.
  newLeads: number;
  cumulativeLeads: number;
  totalValue: number;
}

export interface ThirtyDayTrendSummary {
  trend: DailyLeadTrendPoint[];
  totalNewLeads: number;
  totalNewValue: number;
  averagePerDay: number;
  peakDay: { date: string; displayDate: string; count: number } | null;
  activeDaysCount: number;
}

/**
 * Calculates daily new leads created over the past 30 days to track business growth.
 */
export function calculate30DayLeadTrend(
  leads: LeadData[],
  referenceDateStr?: string
): ThirtyDayTrendSummary {
  const refDate = referenceDateStr ? new Date(referenceDateStr) : new Date();
  
  const trend: DailyLeadTrendPoint[] = [];
  let cumulativeLeads = 0;
  let totalNewValue = 0;
  let peakDay: { date: string; displayDate: string; count: number } | null = null;
  let activeDaysCount = 0;

  for (let i = 29; i >= 0; i--) {
    const d = new Date(refDate);
    d.setDate(d.getDate() - i);
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const monthShort = d.toLocaleString('en-US', { month: 'short' });
    const dayOfWeek = d.toLocaleString('en-US', { weekday: 'short' });
    const displayDate = `${monthShort} ${d.getDate()}`;
    const shortDate = `${d.getDate()} ${monthShort}`;

    const dayLeads = leads.filter(l => l.createdAt && l.createdAt.split('T')[0] === dateStr);
    const count = dayLeads.length;
    const dayValue = dayLeads.reduce((sum, l) => sum + (l.quotationAmount || l.estimatedValue || 0), 0);

    cumulativeLeads += count;
    totalNewValue += dayValue;

    if (count > 0) {
      activeDaysCount++;
    }

    if (!peakDay || count > peakDay.count) {
      if (count > 0) {
        peakDay = { date: dateStr, displayDate, count };
      }
    }

    trend.push({
      date: dateStr,
      displayDate,
      shortDate,
      dayOfWeek,
      newLeads: count,
      cumulativeLeads,
      totalValue: dayValue,
    });
  }

  const totalNewLeads = cumulativeLeads;
  const averagePerDay = Math.round((totalNewLeads / 30) * 10) / 10;

  return {
    trend,
    totalNewLeads,
    totalNewValue,
    averagePerDay,
    peakDay,
    activeDaysCount,
  };
}

export interface LeadScoreResult {
  score: number; // 0 to 100
  level: 'Hot' | 'Warm' | 'Cold';
  colorClass: string;
  badgeClass: string;
  breakdown: {
    engagement: number; // max 35
    activity: number;   // max 35
    dealValue: number;  // max 30
  };
}

/**
 * Lead scoring algorithm (0-100) based on:
 * 1. Engagement history (pipeline stage & priority & follow-up completion)
 * 2. Activity frequency (interaction count & notes)
 * 3. Deal value (quotation amount or estimated value)
 */
export function calculateLeadScore(
  lead: {
    stage: string;
    estimatedValue: number;
    quotationAmount?: number;
    followUpCompleted?: boolean;
    priority?: string;
    notes?: string;
    createdAt?: string;
  },
  activitiesCount?: number | Array<any>
): LeadScoreResult {
  let engagement = 0;
  let activity = 0;
  let dealValue = 0;

  // 1. Engagement Score (0-35)
  switch (lead.stage) {
    case 'Won':
      engagement = 35;
      break;
    case 'Negotiation':
      engagement = 30;
      break;
    case 'Quotation Sent':
      engagement = 25;
      break;
    case 'Site Visit Scheduled':
      engagement = 20;
      break;
    case 'Contacted':
      engagement = 15;
      break;
    case 'New':
      engagement = 10;
      break;
    case 'Lost':
      engagement = 0;
      break;
    default:
      engagement = 10;
  }

  // Priority bonus
  if (lead.priority === 'High') engagement += 5;
  else if (lead.priority === 'Medium') engagement += 2;

  // Follow-up completion bonus
  if (lead.followUpCompleted) engagement += 5;

  engagement = Math.min(35, engagement);

  // 2. Activity Frequency Score (0-35)
  let count = 0;
  if (typeof activitiesCount === 'number') {
    count = activitiesCount;
  } else if (Array.isArray(activitiesCount)) {
    count = activitiesCount.length;
  } else {
    // Heuristics if activities array is not provided directly
    if (lead.notes && lead.notes.length > 5) count += 2;
    if (lead.quotationAmount && lead.quotationAmount > 0) count += 2;
    if (lead.followUpCompleted) count += 1;
  }

  if (count >= 5) activity = 35;
  else if (count >= 3) activity = 25;
  else if (count >= 2) activity = 18;
  else if (count >= 1) activity = 12;
  else activity = 5;

  // 3. Deal Value Score (0-30)
  const val = lead.quotationAmount || lead.estimatedValue || 0;
  if (val >= 500000) dealValue = 30;       // ₹5 Lakhs+
  else if (val >= 250000) dealValue = 24;  // ₹2.5 Lakhs+
  else if (val >= 100000) dealValue = 18;  // ₹1 Lakh+
  else if (val >= 50000) dealValue = 12;   // ₹50,000+
  else dealValue = 6;

  const totalScore = Math.min(100, Math.max(0, Math.round(engagement + activity + dealValue)));

  let level: 'Hot' | 'Warm' | 'Cold' = 'Cold';
  let colorClass = 'text-blue-700 dark:text-blue-300 bg-blue-50 dark:bg-blue-950/40 border-blue-200 dark:border-blue-800/40';
  let badgeClass = 'bg-blue-500';

  if (totalScore >= 70) {
    level = 'Hot';
    colorClass = 'text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800/40';
    badgeClass = 'bg-red-500';
  } else if (totalScore >= 45) {
    level = 'Warm';
    colorClass = 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800/40';
    badgeClass = 'bg-amber-500';
  }

  return {
    score: totalScore,
    level,
    colorClass,
    badgeClass,
    breakdown: {
      engagement,
      activity,
      dealValue,
    },
  };
}



