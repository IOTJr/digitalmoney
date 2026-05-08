"use server";

import { dodoPayments } from "@/lib/dodo/payments";
import { type SubscriptionTier } from "@/lib/dodo/constants";
import { createAdminClient } from "@/lib/supabase/server";

export interface CheckoutResult {
  url?: string;
  error?: string;
}

export async function createCheckoutSession(
  email: string,
  tier: SubscriptionTier
): Promise<CheckoutResult> {
  try {
    // Validate email
    if (!email || !email.includes("@")) {
      return { error: "Please enter a valid email address" };
    }

    // Validate tier
    if (!["basic", "expanded", "exclusive"].includes(tier)) {
      return { error: "Invalid subscription tier" };
    }

    // Check if user already has an active subscription
    const supabase = await createAdminClient();
    
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("id, status")
      .eq("email", email.toLowerCase())
      .eq("status", "active")
      .single();

    if (existingSubscription) {
      return { error: "You already have an active subscription" };
    }

    // Check if there's already a pending registration for this email
    const { data: pendingRegistration } = await supabase
      .from("pending_registrations")
      .select("id, expires_at")
      .eq("email", email.toLowerCase())
      .eq("is_completed", false)
      .single();

    if (pendingRegistration) {
      const expiresAt = new Date(pendingRegistration.expires_at);
      if (expiresAt > new Date()) {
        // Return the existing pending registration info
        return { 
          error: `A pending registration already exists for this email. Please complete your registration or wait for it to expire.` 
        };
      }
    }

    // Create Dodo checkout session
    const checkoutSession = await dodoPayments.createCheckoutSession(
      email.toLowerCase(),
      tier
    );

    return { url: checkoutSession.checkout_url };
  } catch (error) {
    console.error("Checkout error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "An error occurred while processing your request",
    };
  }
}

export async function checkPendingRegistration(email: string) {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .rpc("check_pending_registration", { check_email: email.toLowerCase() });

    if (error) {
      console.error("Error checking pending registration:", error);
      return { hasPending: false, tier: null, checkoutId: null };
    }

    if (data && data.length > 0) {
      const result = data[0];
      return {
        hasPending: result.has_pending,
        tier: result.tier_level,
        checkoutId: result.checkout_id,
      };
    }

    return { hasPending: false, tier: null, checkoutId: null };
  } catch (error) {
    console.error("Error checking pending registration:", error);
    return { hasPending: false, tier: null, checkoutId: null };
  }
}

export async function completeRegistration(email: string, userId: string) {
  try {
    const supabase = await createAdminClient();

    const { data, error } = await supabase
      .rpc("complete_pending_registration", {
        registration_email: email.toLowerCase(),
        user_uuid: userId,
      });

    if (error) {
      console.error("Error completing registration:", error);
      return { success: false, error: error.message };
    }

    return { success: data, error: null };
  } catch (error) {
    console.error("Error completing registration:", error);
    return { success: false, error: "An error occurred" };
  }
}
