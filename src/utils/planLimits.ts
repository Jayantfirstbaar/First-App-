export interface PlanConfig {
  id: 'free';
  name: string;
  priceINR: number;
  maxActiveLeads: number;
  maxAIMonthlyGenerations: number;
  features: string[];
}

export const PLANS: Record<'free', PlanConfig> = {
  free: {
    id: 'free',
    name: 'Standard',
    priceINR: 0,
    maxActiveLeads: 10000,
    maxAIMonthlyGenerations: 10000,
    features: [
      'Unlimited active leads',
      'Unlimited AI messages',
      'Follow-up schedule & reminders',
      'Full sales pipeline',
      'Direct WhatsApp launcher',
      'Quotation analytics',
      'Full reporting & insights',
      'CSV data export',
    ],
  },
};

/**
 * Checks if a user is allowed to create another active lead.
 */
export function checkLeadCreationLimit(
  currentActiveLeadCount: number
): { allowed: boolean; maxAllowed: number; currentCount: number; message?: string } {
  const plan = PLANS.free;
  const maxAllowed = plan.maxActiveLeads;
  
  if (currentActiveLeadCount >= maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      currentCount: currentActiveLeadCount,
      message: `Limit reached.`,
    };
  }
  
  return {
    allowed: true,
    maxAllowed,
    currentCount: currentActiveLeadCount,
  };
}

/**
 * Checks if a user is allowed to generate another AI follow-up message this month.
 */
export function checkAIGenerationLimit(
  currentMonthlyUsage: number
): { allowed: boolean; maxAllowed: number; currentUsage: number; message?: string } {
  const plan = PLANS.free;
  const maxAllowed = plan.maxAIMonthlyGenerations;
  
  if (currentMonthlyUsage >= maxAllowed) {
    return {
      allowed: false,
      maxAllowed,
      currentUsage: currentMonthlyUsage,
      message: `Monthly limit reached.`,
    };
  }
  
  return {
    allowed: true,
    maxAllowed,
    currentUsage: currentMonthlyUsage,
  };
}
