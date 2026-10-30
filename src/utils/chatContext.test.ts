import test from 'node:test';
import assert from 'node:assert/strict';
import { buildChatContextSnapshot } from './chatContext.js';
import { validateProposedActions, extractActionsFromText } from './actionValidator.js';
import { Lead, UserProfile } from '../types/index.js';

test('Context Snapshot Builder: Strictly excludes phone numbers and emails', () => {
  const mockUser: UserProfile = {
    id: 'user_privacy_test',
    email: 'private_owner@studiodesign.in',
    phoneNumber: '+919988776655',
    name: 'Rajesh Varma',
    businessName: 'Varma Interior Studio',
    businessType: 'Modular Kitchen',
    languagePreference: 'hinglish',
    timeZone: 'Asia/Kolkata',
    reminderTime: '10:00',
    aiUsageThisMonth: 3,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  const mockLeads: Lead[] = [
    {
      id: 'lead_1',
      userId: 'user_privacy_test',
      customerName: 'Anil Kapoor (call 9876543210)',
      phone: '+91-9876543210',
      source: 'WhatsApp',
      projectType: 'Modular Kitchen',
      estimatedValue: 450000,
      quotationAmount: 420000,
      quotationSentDate: '2026-10-25',
      stage: 'Negotiation',
      priority: 'High',
      notes: 'Client email is anil.kapoor+deals@luxuryinteriors.co.in. Secondary number: +91 91234 56789. Discussed granite countertop.',
      createdAt: '2026-10-20T10:00:00Z',
      updatedAt: '2026-10-25T12:00:00Z',
    },
    {
      id: 'lead_2',
      userId: 'user_privacy_test',
      customerName: 'Sunita Sharma',
      phone: '9820098200',
      source: 'Instagram',
      projectType: 'Turnkey Project',
      estimatedValue: 1200000,
      quotationAmount: 1100000,
      quotationSentDate: '2026-10-28',
      stage: 'Quotation Sent',
      priority: 'High',
      notes: 'Reach her assistant at office@sharmagroup.org or (022) 2876-5432 regarding wardrobe finish.',
      createdAt: '2026-10-22T10:00:00Z',
      updatedAt: '2026-10-28T12:00:00Z',
    },
  ];

  const snapshot = buildChatContextSnapshot(mockUser, mockLeads);
  const jsonOutput = JSON.stringify(snapshot);

  // 1. Verify User PII is completely excluded
  assert.equal(jsonOutput.includes('private_owner@studiodesign.in'), false, 'Owner email must never appear in snapshot');
  assert.equal(jsonOutput.includes('+919988776655'), false, 'Owner phone must never appear in snapshot');
  assert.equal(jsonOutput.includes('9988776655'), false, 'Owner raw phone digits must not appear');

  // 2. Verify Lead phone numbers are strictly excluded/redacted
  assert.equal(jsonOutput.includes('+91-9876543210'), false, 'Lead 1 direct phone must not appear');
  assert.equal(jsonOutput.includes('9820098200'), false, 'Lead 2 direct phone must not appear');
  assert.equal(jsonOutput.includes('91234 56789'), false, 'Secondary note phone must not appear');
  assert.equal(jsonOutput.includes('2876-5432'), false, 'Landline format must be redacted');

  // 3. Verify Lead emails are strictly redacted
  assert.equal(jsonOutput.includes('anil.kapoor+deals@luxuryinteriors.co.in'), false, 'Complex lead email must not appear');
  assert.equal(jsonOutput.includes('office@sharmagroup.org'), false, 'Organization lead email must not appear');

  // 4. Verify object schema strictly omits sensitive keys
  for (const lead of snapshot.leads) {
    assert.equal((lead as any).phone, undefined, 'Lead object must not have phone property');
    assert.equal((lead as any).phoneNumber, undefined, 'Lead object must not have phoneNumber property');
    assert.equal((lead as any).email, undefined, 'Lead object must not have email property');
    assert.equal((lead as any).address, undefined, 'Lead object must not have address property');
  }

  // 5. Verify non-sensitive business fields and stats remain accurate
  assert.equal(snapshot.businessName, 'Varma Interior Studio');
  assert.equal(snapshot.stats.activeLeads, 2);
  assert.equal(snapshot.stats.pendingQuotationValue, 1520000);
});

test('Context Snapshot Builder: Strictly enforces 40KB size limit on large lead datasets', () => {
  const mockUser: UserProfile = {
    id: 'user_large_dataset',
    email: 'designer@megastudio.in',
    name: 'Kavita Rao',
    businessName: 'Prestige Architectural Concepts and Premium Residential Interiors Private Limited',
    businessType: 'Interior Design and Turnkey Execution',
    languagePreference: 'en',
    timeZone: 'Asia/Kolkata',
    reminderTime: '09:30',
    aiUsageThisMonth: 12,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
  };

  // Generate 200 large leads with verbose notes
  const largeLeads: Lead[] = [];
  for (let i = 0; i < 200; i++) {
    largeLeads.push({
      id: `lead_enterprise_${i}`,
      userId: 'user_large_dataset',
      customerName: `Premium Client ${i} Luxury Penthouse Project with Italian Decor`,
      phone: `+91987600${i.toString().padStart(4, '0')}`,
      source: 'Instagram Ad Campaign',
      projectType: 'Turnkey Project',
      estimatedValue: 2500000 + i * 25000,
      quotationAmount: 2350000 + i * 20000,
      quotationSentDate: '2026-10-15',
      stage: i % 3 === 0 ? 'Quotation Sent' : i % 3 === 1 ? 'Negotiation' : 'Contacted',
      priority: i % 2 === 0 ? 'High' : 'Medium',
      nextFollowUpDate: i % 4 === 0 ? '2026-10-30' : '2026-11-05',
      notes: `Detailed scope for luxury 5BHK apartment at Tower ${i}: Italian Statuario marble in living, DuChateau engineered wood flooring, custom Hafele motorized wardrobe systems, and Blum soft-close kitchen hardware.`,
      createdAt: '2026-10-01T00:00:00Z',
      updatedAt: '2026-10-15T00:00:00Z',
    });
  }

  const snapshot = buildChatContextSnapshot(mockUser, largeLeads);
  const jsonOutput = JSON.stringify(snapshot);
  const byteLength = Buffer.byteLength(jsonOutput, 'utf8');

  // Hard assertion: Must be <= 40,000 bytes (40KB cap)
  assert.ok(byteLength <= 40000, `Snapshot size (${byteLength} bytes) exceeded maximum 40,000 bytes cap`);
  assert.ok(snapshot.leads.length > 0, 'Snapshot must retain prioritized leads even after size trimming');
});

test('Context Snapshot Builder: Safely handles null, undefined, and corrupt lead inputs', () => {
  const emptySnapshot = buildChatContextSnapshot(null, null);
  assert.equal(emptySnapshot.leads.length, 0);
  assert.equal(emptySnapshot.stats.activeLeads, 0);
  assert.equal(emptySnapshot.businessName, 'Interior Studio');

  const corruptSnapshot = buildChatContextSnapshot(undefined, [null, 'invalid string', 12345, { id: null }, {}]);
  assert.equal(corruptSnapshot.leads.length, 0);
  assert.equal(corruptSnapshot.stats.activeLeads, 0);
});

test('Action Validator: Schema adherence and lead validation', () => {
  const validLeadIds = new Set(['lead_10', 'lead_20']);

  const rawActions = [
    { type: 'update_stage', leadId: 'lead_10', stage: 'Won' },
    { type: 'schedule_followup', leadId: 'lead_20', date: '2026-11-02', time: '11:00' },
    { type: 'add_note', leadId: 'lead_10', note: 'Advance paid' },
    { type: 'draft_message', leadId: 'lead_20', text: 'Hello Sir, following up.' },
    // Invalid: non-existent lead ID
    { type: 'update_stage', leadId: 'lead_99999', stage: 'Won' },
    // Invalid: unsupported stage
    { type: 'update_stage', leadId: 'lead_10', stage: 'ClosedSuccessfully' },
    // Invalid: unknown action type
    { type: 'delete_database', leadId: 'lead_10' },
  ];

  const validated = validateProposedActions(rawActions, validLeadIds);
  assert.equal(validated.length, 4, 'Must only allow valid, safe actions for recognized leads');
  assert.equal(validated[0].stage, 'Won');
});

test('Action JSON Extractor: Parses JSON block from assistant response', () => {
  const textWithJson = `Aapka quotation Won mark kar diya gaya hai.
\`\`\`json
{
  "actions": [
    { "type": "update_stage", "leadId": "lead_10", "stage": "Won" }
  ]
}
\`\`\``;

  const result = extractActionsFromText(textWithJson, ['lead_10']);
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].type, 'update_stage');
  assert.equal(result.cleanText.includes('```json'), false);
});
