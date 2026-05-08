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

interface DodoProductPrice {
  price?: number | null;
  type?: string;
  subscription_period_interval?: string;
  subscription_period_count?: number | null;
}

interface DodoProduct {
  product_id: string;
  name?: string | null;
  price?: DodoProductPrice | null;
  is_recurring?: boolean;
  archived?: boolean;
}

interface DodoProductsListResponse {
  items?: DodoProduct[];
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
  private webhookSecret?: string;

  constructor() {
    this.apiKey = process.env.DODO_PAYMENTS_API_KEY!;
    this.webhookSecret = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;

    if (!this.apiKey) {
      throw new Error("DODO_PAYMENTS_API_KEY environment variable is required");
    }
  }

  private getApiBaseUrl() {
    return (
      process.env.DODO_PAYMENTS_BASE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://live.dodopayments.com"
        : "https://test.dodopayments.com")
    );
  }

  private async requestJson<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${this.getApiBaseUrl()}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        "Content-Type": "application/json",
        ...(init?.headers || {}),
      },
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(
        `Dodo API request failed (${response.status} ${response.statusText})${responseText ? `: ${responseText}` : ""}`
      );
    }

    return response.json() as Promise<T>;
  }

  private async resolveProductId(tier: SubscriptionTier): Promise<string> {
    const pricing = PRICING_TIERS[tier];
    const expectedName = pricing.name.toLowerCase();
    const expectedPrice = pricing.price * 100;

    const response = await this.requestJson<DodoProductsListResponse>(
      "/products?page_size=100"
    );

    const products = response.items || [];
    const matchingProduct = products.find((product) => {
      const productName = product.name?.trim().toLowerCase();
      const productPrice = product.price?.price ?? null;
      const productIsRecurring = product.is_recurring ?? false;

      return (
        !product.archived &&
        productIsRecurring &&
        ((productName && productName === expectedName) ||
          productPrice === expectedPrice)
      );
    });

    if (!matchingProduct) {
      throw new Error(
        `No Dodo product found for ${pricing.name}. Create a recurring product named "${pricing.name}" or add a product with price ${expectedPrice} in your Dodo account.`
      );
    }

    return matchingProduct.product_id;
  }

  /**
   * Create a checkout session for a subscription tier
   */
  async createCheckoutSession(
    email: string,
    tier: SubscriptionTier
  ): Promise<DodoCheckoutSession> {
    const productId = await this.resolveProductId(tier);

    const response = await this.requestJson<{ session_id: string; checkout_url: string }>(
      "/checkouts",
      {
        method: "POST",
        body: JSON.stringify({
          product_cart: [
            {
              product_id: productId,
              quantity: 1,
            },
          ],
          customer: {
            email,
          },
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/register?email=${encodeURIComponent(email)}`,
          cancel_url: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/pricing`,
          metadata: {
            tier,
            email,
          },
        }),
      }
    );

    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 30); // 30 minute checkout window

    return {
      checkout_id: response.session_id,
      checkout_url: response.checkout_url,
      expires_at: expiresAt.toISOString(),
    };
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload: string, signature: string): boolean {
    try {
      if (!this.webhookSecret) {
        return false;
      }

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