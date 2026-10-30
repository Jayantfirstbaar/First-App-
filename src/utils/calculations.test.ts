import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateConversionRate,
  calculateWonRevenue,
  calculatePipelineValue,
  categorizeFollowUp,
  formatINR,
  validateAndCleanIndianPhone,
  LeadData,
  filterLeadsForExport,
  generateLeadsCsv,
  calculateConversionTrend,
  calculate30DayLeadTrend,
  calculateLeadScore,
} from './calculations';
import { checkLeadCreationLimit, checkAIGenerationLimit } from './planLimits';

test('calculateConversionRate returns 0 when no resolved leads exist', () => {
  const leads: LeadData[] = [
    { id: '1', userId: 'u1', customerName: 'Rohan', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'New', createdAt: '', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'Pooja', phone: '9876543211', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 200000, stage: 'Negotiation', createdAt: '', updatedAt: '' },
  ];
  const res = calculateConversionRate(leads);
  assert.equal(res.rate, 0);
  assert.equal(res.wonCount, 0);
  assert.equal(res.lostCount, 0);
  assert.equal(res.resolvedCount, 0);
});

test('calculateConversionRate computes Won / (Won + Lost) correctly and ignores open stages', () => {
  const leads: LeadData[] = [
    { id: '1', userId: 'u1', customerName: 'A', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'Won', createdAt: '', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'B', phone: '9876543211', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 200000, stage: 'Won', createdAt: '', updatedAt: '' },
    { id: '3', userId: 'u1', customerName: 'C', phone: '9876543212', source: 'Website', projectType: 'Renovation', estimatedValue: 150000, stage: 'Lost', createdAt: '', updatedAt: '' },
    { id: '4', userId: 'u1', customerName: 'D', phone: '9876543213', source: 'Referral', projectType: 'Interior', estimatedValue: 300000, stage: 'Contacted', createdAt: '', updatedAt: '' },
  ];
  // 2 Won, 1 Lost -> 2 / 3 = 67%
  const res = calculateConversionRate(leads);
  assert.equal(res.wonCount, 2);
  assert.equal(res.lostCount, 1);
  assert.equal(res.resolvedCount, 3);
  assert.equal(res.rate, 67);
});

test('calculateWonRevenue sums revenue only from Won leads with quotation preference', () => {
  const leads: LeadData[] = [
    { id: '1', userId: 'u1', customerName: 'A', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, quotationAmount: 120000, stage: 'Won', createdAt: '', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'B', phone: '9876543211', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 200000, stage: 'Won', createdAt: '', updatedAt: '' },
    { id: '3', userId: 'u1', customerName: 'C', phone: '9876543212', source: 'Website', projectType: 'Renovation', estimatedValue: 500000, quotationAmount: 450000, stage: 'Negotiation', createdAt: '', updatedAt: '' },
  ];
  // 120000 + 200000 = 320000
  assert.equal(calculateWonRevenue(leads), 320000);
});

test('calculatePipelineValue calculates open potential and excludes Won and Lost', () => {
  const leads: LeadData[] = [
    { id: '1', userId: 'u1', customerName: 'A', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'New', createdAt: '', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'B', phone: '9876543211', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 200000, quotationAmount: 220000, stage: 'Quotation Sent', createdAt: '', updatedAt: '' },
    { id: '3', userId: 'u1', customerName: 'C', phone: '9876543212', source: 'Website', projectType: 'Renovation', estimatedValue: 500000, stage: 'Won', createdAt: '', updatedAt: '' },
    { id: '4', userId: 'u1', customerName: 'D', phone: '9876543213', source: 'Website', projectType: 'Renovation', estimatedValue: 400000, stage: 'Lost', createdAt: '', updatedAt: '' },
  ];
  const { totalValue, openCount, quotationSentValue } = calculatePipelineValue(leads);
  // Open leads: A (100000) + B (220000) = 320000
  assert.equal(openCount, 2);
  assert.equal(totalValue, 320000);
  assert.equal(quotationSentValue, 220000);
});

test('categorizeFollowUp accurately flags overdue, today, upcoming, completed and resolved', () => {
  const today = '2026-10-29';
  
  const overdueLead: LeadData = {
    id: '1', userId: 'u1', customerName: 'A', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'Contacted', nextFollowUpDate: '2026-10-28', createdAt: '', updatedAt: ''
  };
  assert.equal(categorizeFollowUp(overdueLead, today), 'overdue');

  const todayLead: LeadData = {
    id: '2', userId: 'u1', customerName: 'B', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'Quotation Sent', nextFollowUpDate: '2026-10-29', createdAt: '', updatedAt: ''
  };
  assert.equal(categorizeFollowUp(todayLead, today), 'today');

  const upcomingLead: LeadData = {
    id: '3', userId: 'u1', customerName: 'C', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'New', nextFollowUpDate: '2026-11-05', createdAt: '', updatedAt: ''
  };
  assert.equal(categorizeFollowUp(upcomingLead, today), 'upcoming');

  const completedLead: LeadData = {
    id: '4', userId: 'u1', customerName: 'D', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'Contacted', nextFollowUpDate: '2026-10-28', followUpCompleted: true, createdAt: '', updatedAt: ''
  };
  assert.equal(categorizeFollowUp(completedLead, today), 'completed');

  const wonLead: LeadData = {
    id: '5', userId: 'u1', customerName: 'E', phone: '9876543210', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'Won', nextFollowUpDate: '2026-10-28', createdAt: '', updatedAt: ''
  };
  assert.equal(categorizeFollowUp(wonLead, today), 'none');
});

test('formatINR formats numbers into Indian currency style', () => {
  assert.equal(formatINR(0), '₹0');
  assert.equal(formatINR(500), '₹500');
  assert.equal(formatINR(15000), '₹15,000');
  assert.equal(formatINR(450000), '₹4,50,000');
  assert.equal(formatINR(2500000), '₹25,00,000');
  assert.equal(formatINR(10000000), '₹1,00,00,000');
});

test('validateAndCleanIndianPhone validates 10-digit mobile and international formats', () => {
  const valid1 = validateAndCleanIndianPhone('9876543210');
  assert.equal(valid1.isValid, true);
  assert.equal(valid1.cleaned, '9876543210');
  assert.equal(valid1.whatsAppNumber, '919876543210');
  assert.equal(valid1.formattedDisplay, '+91 98765 43210');

  const validWithPlus91 = validateAndCleanIndianPhone('+91 98200 12345');
  assert.equal(validWithPlus91.isValid, true);
  assert.equal(validWithPlus91.cleaned, '9820012345');
  assert.equal(validWithPlus91.whatsAppNumber, '919820012345');

  const invalidShort = validateAndCleanIndianPhone('12345');
  assert.equal(invalidShort.isValid, false);
});

test('plan limits allow high usage on free tier', () => {
  // Free: high limits now
  assert.equal(checkLeadCreationLimit(29).allowed, true);
  assert.equal(checkLeadCreationLimit(9999).allowed, true);
  assert.equal(checkLeadCreationLimit(10000).allowed, false);

  // AI Free: 10000 / mo
  assert.equal(checkAIGenerationLimit(14).allowed, true);
  assert.equal(checkAIGenerationLimit(9999).allowed, true);
  assert.equal(checkAIGenerationLimit(10000).allowed, false);
});

test('calculateLeadScore computes score correctly based on engagement, activity, and value', () => {
  const lead: any = {
    stage: 'Negotiation',
    estimatedValue: 300000,
    priority: 'High',
    followUpCompleted: true,
  };
  // Engagement: Negotiation (30) + High (5) + Completed (5) = 40 (max 35) -> 35
  // Activity: heuristically (0 activities provided) -> 5
  // Value: 300000 (>= 2.5L) -> 24
  // Total: 35 + 5 + 24 = 64
  const res = calculateLeadScore(lead);
  assert.equal(res.score, 64);
  assert.equal(res.level, 'Warm');
});

test('filterLeadsForExport filters by status and date range', () => {
  const sampleLeads: LeadData[] = [
    { id: '1', userId: 'u1', customerName: 'Alice', phone: '9811111111', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 100000, stage: 'New', createdAt: '2026-10-01T10:00:00Z', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'Bob', phone: '9822222222', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 200000, stage: 'Won', createdAt: '2026-10-15T12:00:00Z', updatedAt: '' },
    { id: '3', userId: 'u1', customerName: 'Charlie', phone: '9833333333', source: 'Referral', projectType: 'Renovation', estimatedValue: 300000, stage: 'Lost', createdAt: '2026-09-10T14:00:00Z', updatedAt: '' },
    { id: '4', userId: 'u1', customerName: 'Dave', phone: '9844444444', source: 'Website', projectType: 'Furniture', estimatedValue: 150000, stage: 'Quotation Sent', createdAt: '2026-10-28T09:00:00Z', updatedAt: '' },
  ];

  // Filter by status 'Won'
  const wonOnly = filterLeadsForExport(sampleLeads, { status: 'Won' });
  assert.equal(wonOnly.length, 1);
  assert.equal(wonOnly[0].customerName, 'Bob');

  // Filter by open pipeline status
  const openOnly = filterLeadsForExport(sampleLeads, { status: 'open' });
  assert.equal(openOnly.length, 2); // Alice (New), Dave (Quotation Sent)

  // Filter by resolved status
  const resolvedOnly = filterLeadsForExport(sampleLeads, { status: 'resolved' });
  assert.equal(resolvedOnly.length, 2); // Bob (Won), Charlie (Lost)

  // Filter by timeframe 'this_month' (using reference date 2026-10-28)
  const thisMonth = filterLeadsForExport(sampleLeads, { timeframe: 'this_month', todayStr: '2026-10-28' });
  assert.equal(thisMonth.length, 3); // Alice, Bob, Dave in Oct; Charlie is Sept

  // Filter by custom date range
  const customRange = filterLeadsForExport(sampleLeads, {
    timeframe: 'custom',
    startDate: '2026-10-10',
    endDate: '2026-10-20',
  });
  assert.equal(customRange.length, 1);
  assert.equal(customRange[0].customerName, 'Bob');

  // Combined status and date range
  const combined = filterLeadsForExport(sampleLeads, {
    status: 'Won',
    timeframe: 'this_month',
    todayStr: '2026-10-28',
  });
  assert.equal(combined.length, 1);
  assert.equal(combined[0].customerName, 'Bob');
});

test('generateLeadsCsv produces valid escaped CSV content', () => {
  const sampleLeads: LeadData[] = [
    {
      id: '1',
      userId: 'u1',
      customerName: 'Mehta, Rajesh & Co.',
      phone: '9810012345',
      source: 'WhatsApp',
      projectType: 'Modular Kitchen "Premium"',
      estimatedValue: 450000,
      quotationAmount: 450000,
      stage: 'Quotation Sent',
      notes: 'Contains commas, quotes "test", and details',
      createdAt: '2026-10-25T10:00:00Z',
      updatedAt: '',
    },
  ];

  const csv = generateLeadsCsv(sampleLeads);
  assert.match(csv, /Lead ID,Customer Name,Phone/);
  assert.match(csv, /"Mehta, Rajesh & Co\."/);
  assert.match(csv, /"Modular Kitchen ""Premium"""/);
  assert.match(csv, /"450000"/);
});

test('calculateConversionTrend computes 6-month monthly trends, conversion rates, and revenue', () => {
  const sampleLeads: LeadData[] = [
    // Oct 2026: 2 Won (₹3L, ₹2L), 1 Lost, 1 Open
    { id: '1', userId: 'u1', customerName: 'A', phone: '9810012345', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 300000, quotationAmount: 300000, stage: 'Won', createdAt: '2026-10-10T10:00:00Z', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'B', phone: '9810012346', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 200000, quotationAmount: 200000, stage: 'Won', createdAt: '2026-10-15T10:00:00Z', updatedAt: '' },
    { id: '3', userId: 'u1', customerName: 'C', phone: '9810012347', source: 'Website', projectType: 'Living', estimatedValue: 150000, stage: 'Lost', createdAt: '2026-10-20T10:00:00Z', updatedAt: '' },
    { id: '4', userId: 'u1', customerName: 'D', phone: '9810012348', source: 'Referral', projectType: 'Kitchen', estimatedValue: 400000, stage: 'Quotation Sent', createdAt: '2026-10-22T10:00:00Z', updatedAt: '' },
    // Sep 2026: 1 Won (₹5L), 1 Lost
    { id: '5', userId: 'u1', customerName: 'E', phone: '9810012349', source: 'WhatsApp', projectType: 'Full Home', estimatedValue: 500000, quotationAmount: 500000, stage: 'Won', createdAt: '2026-09-05T10:00:00Z', updatedAt: '' },
    { id: '6', userId: 'u1', customerName: 'F', phone: '9810012350', source: 'Instagram', projectType: 'Wardrobe', estimatedValue: 100000, stage: 'Lost', createdAt: '2026-09-18T10:00:00Z', updatedAt: '' },
    // Aug 2026: 1 Won (₹1L), 0 Lost, 1 Open
    { id: '7', userId: 'u1', customerName: 'G', phone: '9810012351', source: 'Direct', projectType: 'Kitchen', estimatedValue: 100000, quotationAmount: 100000, stage: 'Won', createdAt: '2026-08-12T10:00:00Z', updatedAt: '' },
    { id: '8', userId: 'u1', customerName: 'H', phone: '9810012352', source: 'Direct', projectType: 'Kitchen', estimatedValue: 120000, stage: 'Contacted', createdAt: '2026-08-14T10:00:00Z', updatedAt: '' },
  ];

  const trend = calculateConversionTrend(sampleLeads, '2026-10-29');

  // Should have exactly 6 months
  assert.equal(trend.length, 6);

  // Month 6 is Oct '26
  const oct = trend[5];
  assert.equal(oct.period, "Oct '26");
  assert.equal(oct.won, 2);
  assert.equal(oct.lost, 1);
  assert.equal(oct.open, 1);
  // Won / (Won + Lost) = 2 / 3 = 67%
  assert.equal(oct.conversionRate, 67);
  assert.equal(oct.revenue, 500000);

  // Month 5 is Sep '26
  const sep = trend[4];
  assert.equal(sep.period, "Sep '26");
  assert.equal(sep.won, 1);
  assert.equal(sep.lost, 1);
  assert.equal(sep.open, 0);
  assert.equal(sep.conversionRate, 50); // 1 / 2 = 50%
  assert.equal(sep.revenue, 500000);

  // Month 4 is Aug '26
  const aug = trend[3];
  assert.equal(aug.period, "Aug '26");
  assert.equal(aug.won, 1);
  assert.equal(aug.lost, 0);
  assert.equal(aug.open, 1);
  assert.equal(aug.conversionRate, 100); // 1 / 1 = 100%
  assert.equal(aug.revenue, 100000);
});

test('calculate30DayLeadTrend accurately computes daily points, cumulative growth, and peak days', () => {
  // Reference date: 2026-10-29
  const sampleLeads: LeadData[] = [
    // Today (Oct 29): 2 leads, total 750000
    { id: '1', userId: 'u1', customerName: 'L1', phone: '9810012345', source: 'Instagram', projectType: 'Kitchen', estimatedValue: 350000, stage: 'New', createdAt: '2026-10-29T10:00:00Z', updatedAt: '' },
    { id: '2', userId: 'u1', customerName: 'L2', phone: '9810012346', source: 'WhatsApp', projectType: 'Interior', estimatedValue: 400000, quotationAmount: 400000, stage: 'Won', createdAt: '2026-10-29T15:30:00Z', updatedAt: '' },
    // 5 days ago (Oct 24): 3 leads (peak day!), total 900000
    { id: '3', userId: 'u1', customerName: 'L3', phone: '9810012347', source: 'Website', projectType: 'Living', estimatedValue: 300000, stage: 'Quotation Sent', createdAt: '2026-10-24T09:00:00Z', updatedAt: '' },
    { id: '4', userId: 'u1', customerName: 'L4', phone: '9810012348', source: 'Referral', projectType: 'Kitchen', estimatedValue: 300000, stage: 'Quotation Sent', createdAt: '2026-10-24T11:00:00Z', updatedAt: '' },
    { id: '5', userId: 'u1', customerName: 'L5', phone: '9810012349', source: 'Walk-in', projectType: 'Kitchen', estimatedValue: 300000, stage: 'New', createdAt: '2026-10-24T16:00:00Z', updatedAt: '' },
    // 25 days ago (Oct 04): 1 lead, total 200000
    { id: '6', userId: 'u1', customerName: 'L6', phone: '9810012350', source: 'Instagram', projectType: 'Wardrobe', estimatedValue: 200000, stage: 'Lost', createdAt: '2026-10-04T12:00:00Z', updatedAt: '' },
    // 40 days ago (Sep 19 - outside 30-day window): should NOT be included
    { id: '7', userId: 'u1', customerName: 'L7', phone: '9810012351', source: 'Direct', projectType: 'Kitchen', estimatedValue: 1000000, stage: 'Won', createdAt: '2026-09-19T10:00:00Z', updatedAt: '' },
  ];

  const result = calculate30DayLeadTrend(sampleLeads, '2026-10-29');

  // Must have exactly 30 daily data points
  assert.equal(result.trend.length, 30);

  // First day is 29 days before Oct 29 (Sep 30)
  assert.equal(result.trend[0].date, '2026-09-30');
  // Last day is Oct 29
  assert.equal(result.trend[29].date, '2026-10-29');

  // Verify counts
  assert.equal(result.totalNewLeads, 6); // 2 + 3 + 1 = 6 (L7 ignored)
  assert.equal(result.totalNewValue, 1850000); // 750k + 900k + 200k
  assert.equal(result.activeDaysCount, 3);
  assert.equal(result.averagePerDay, 0.2); // 6 / 30 = 0.2

  // Peak day is Oct 24 with 3 leads
  assert.ok(result.peakDay);
  assert.equal(result.peakDay.date, '2026-10-24');
  assert.equal(result.peakDay.count, 3);

  // Cumulative leads should end with totalNewLeads
  assert.equal(result.trend[29].cumulativeLeads, 6);
  assert.equal(result.trend[29].newLeads, 2);
});

test('calculate30DayLeadTrend handles empty leads list safely', () => {
  const result = calculate30DayLeadTrend([], '2026-10-29');
  assert.equal(result.trend.length, 30);
  assert.equal(result.totalNewLeads, 0);
  assert.equal(result.totalNewValue, 0);
  assert.equal(result.averagePerDay, 0);
  assert.equal(result.peakDay, null);
  assert.equal(result.activeDaysCount, 0);
});


