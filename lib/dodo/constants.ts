export type SubscriptionTier = "basic" | "expanded" | "exclusive";

export interface PricingTier {
  id: SubscriptionTier;
  name: string;
  price: number;
  description: string;
  features: string[];
}

export const PRICING_TIERS: Record<SubscriptionTier, PricingTier> = {
  basic: {
    id: "basic",
    name: "Basic",
    price: 15,
    description: "Perfect for getting started",
    features: [
      "Access to basic content",
      "Community discussion",
      "Announcements",
    ],
  },
  expanded: {
    id: "expanded",
    name: "Expanded",
    price: 30,
    description: "For power users",
    features: [
      "Everything in Basic",
      "File downloads (PDF, ZIP)",
      "Extended content library",
    ],
  },
  exclusive: {
    id: "exclusive",
    name: "Exclusive",
    price: 50,
    description: "Full access experience",
    features: [
      "Everything in Expanded",
      "Video streaming",
      "Shop access",
      "Priority support",
    ],
  },
};

export interface DodoCheckoutSession {
  checkout_id: string;
  checkout_url: string;
  expires_at: string;
}

export interface DodoWebhookEvent {
  type: string;
  data: {
    checkout_id?: string;
    email?: string;
    amount?: number;
    currency?: string;
    status?: string;
    tier?: SubscriptionTier;
    [key: string]: unknown;
  };
  timestamp: string;
}

export interface DodoWebhookPayload {
  event: DodoWebhookEvent;
  signature: string;
}