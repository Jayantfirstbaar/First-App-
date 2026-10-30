import { ProposedAction, ProposedActionType, LeadStage } from '../types/index.js';

export const VALID_LEAD_STAGES: readonly LeadStage[] = [
  'New',
  'Contacted',
  'Site Visit Scheduled',
  'Quotation Sent',
  'Negotiation',
  'Won',
  'Lost',
];

export const VALID_ACTION_TYPES: readonly ProposedActionType[] = [
  'update_stage',
  'schedule_followup',
  'add_note',
  'draft_message',
];

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_REGEX = /^\d{2}:\d{2}$/;

/**
 * Validates a list of proposed actions from Gemini.
 * Ensures strict schema adherence, allowed types, and that leadId exists in context snapshot.
 */
export function validateProposedActions(
  rawActions: unknown,
  validLeadIds: Set<string> | string[]
): ProposedAction[] {
  if (!Array.isArray(rawActions)) {
    return [];
  }

  const leadIdSet = validLeadIds instanceof Set ? validLeadIds : new Set(validLeadIds);
  const validated: ProposedAction[] = [];

  for (let i = 0; i < rawActions.length; i++) {
    const item = rawActions[i];
    if (!item || typeof item !== 'object') continue;

    const action = item as Record<string, any>;
    const type = action.type;
    const leadId = typeof action.leadId === 'string' ? action.leadId.trim() : '';

    // Must have a valid action type and a valid, recognized leadId
    if (!VALID_ACTION_TYPES.includes(type) || !leadId || !leadIdSet.has(leadId)) {
      continue;
    }

    const actionId = `action_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}`;

    if (type === 'update_stage') {
      const stage = action.stage;
      if (typeof stage === 'string' && VALID_LEAD_STAGES.includes(stage as LeadStage)) {
        validated.push({
          id: actionId,
          type: 'update_stage',
          leadId,
          stage: stage as LeadStage,
          status: 'pending',
        });
      }
    } else if (type === 'schedule_followup') {
      const date = typeof action.date === 'string' ? action.date.trim() : '';
      if (DATE_REGEX.test(date)) {
        const time = typeof action.time === 'string' && TIME_REGEX.test(action.time.trim())
          ? action.time.trim()
          : '11:00';
        validated.push({
          id: actionId,
          type: 'schedule_followup',
          leadId,
          date,
          time,
          status: 'pending',
        });
      }
    } else if (type === 'add_note') {
      const note = typeof action.note === 'string' ? action.note.trim() : '';
      if (note.length > 0) {
        validated.push({
          id: actionId,
          type: 'add_note',
          leadId,
          note: note.slice(0, 500),
          status: 'pending',
        });
      }
    } else if (type === 'draft_message') {
      const text = typeof action.text === 'string' ? action.text.trim() : '';
      if (text.length > 0) {
        validated.push({
          id: actionId,
          type: 'draft_message',
          leadId,
          text: text.slice(0, 1000),
          status: 'pending',
        });
      }
    }
  }

  return validated;
}

/**
 * Extracts action JSON blocks from the end of a model response text.
 * Expects `{"actions": [...]}` or fenced ` ```json {"actions": [...]} ``` `
 */
export function extractActionsFromText(
  rawText: string,
  validLeadIds: Set<string> | string[]
): { cleanText: string; actions: ProposedAction[] } {
  if (!rawText) return { cleanText: '', actions: [] };

  let cleanText = rawText;
  let actions: ProposedAction[] = [];

  // Match ```json ... ``` or raw {"actions": [...]} at the end of the text
  const jsonBlockRegex = /(?:```(?:json)?\s*)?(\{\s*"actions"\s*:\s*\[[\s\S]*?\]\s*\})(?:\s*```)?\s*$/i;
  const match = rawText.match(jsonBlockRegex);

  if (match) {
    try {
      const parsed = JSON.parse(match[1]);
      if (parsed && parsed.actions) {
        actions = validateProposedActions(parsed.actions, validLeadIds);
      }
      // Remove the matched json action block from the visible user text
      cleanText = rawText.replace(match[0], '').trim();
    } catch {
      // If parsing fails, leave cleanText as is and actions empty
    }
  }

  return { cleanText, actions };
}
