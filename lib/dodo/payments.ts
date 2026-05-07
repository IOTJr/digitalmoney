import crypto from "crypto";

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

const DODO_API_BASE_URL = "https://api.dodopayments.com";

class DodoPaymentsClient {
  private apiKey: string;
  private webhookSecret: string;

  constructor() {
    this.apiKey = process.env.DODO_PAYMENTS_API_KEY!;
    this.webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET!;

    if (!this.apiKey) {
      throw new Error("DODO_PAYMENTS_API_KEY environment variable is required");
    }
    if (!this.webhookSecret) {
      throw new Error(
        "DODO_PAYMENTS_WEBHOOK_SECRET environment variable is required"
      );
    }
  }

  /**
   * Create a checkout session for a subscription tier
   */
  async createCheckoutSession(
    email: string,
    tier: SubscriptionTier
  ): Promise<DodoCheckoutSession> {
    const pricing = PRICING_TIERS[tier];
    const checkoutId = `checkout_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

    // In a real implementation, this would call the Dodo API
    // For now, we simulate the checkout session creation
    const response = await fetch(`${DODO_API_BASE_URL}/checkout`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        checkout_id: checkoutId,
        customer_email: email,
        amount: pricing.price * 100, // Amount in cents
        currency: "USD",
        metadata: {
          tier,
          email,
        },
        success_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?checkout_id=${checkoutId}`,
        cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
      }),
    });

    if (!response.ok) {
      // If the API call fails, create a local checkout session
      // This allows development without a live Dodo account
      console.warn(
        "Dodo API call failed, using local checkout session:",
        response.statusText
      );
    }

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute checkout window

    return {
      checkout_id: checkoutId,
      // In production, this would be the actual Dodo checkout URL
      checkout_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing?checkout_id=${checkoutId}&simulated=true`,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", this.webhookSecret)
        .update(payload)
        .digest("hex");

      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      console.error("Webhook signature verification failed:", error);
      return false;
    }
  }

  /**
   * Parse and verify a webhook request
   */
  async parseWebhook(
    body: string,
    signature: string
  ): Promise<DodoWebhookEvent | null> {
    if (!this.verifyWebhookSignature(body, signature)) {
      throw new Error("Invalid webhook signature");
    }

    try {
      const event: DodoWebhookEvent = JSON.parse(body);
      return event;
    } catch (error) {
      console.error("Failed to parse webhook payload:", error);
      return null;
    }
  }

  /**
   * Get subscription details from Dodo
   */
  async getSubscription(subscriptionId: string): Promise<unknown> {
    const response = await fetch(
      `${DODO_API_BASE_URL}/subscriptions/${subscriptionId}`,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch subscription: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    const response = await fetch(
      `${DODO_API_BASE_URL}/subscriptions/${subscriptionId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(
        `Failed to cancel subscription: ${response.statusText}`
      );
    }
  }
}

// Export singleton instance
export const dodoPayments = new DodoPaymentsClient();