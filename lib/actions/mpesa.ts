"use server";

import { type SubscriptionTier, PRICING_TIERS } from "@/lib/dodo/constants";
import { createAdminClient } from "@/lib/supabase/server";
import { getKesQuoteFromUsd } from "@/lib/payments/currency";
import { initiateStkPush, normalizeKenyanPhone } from "@/lib/payments/mpesa";

export interface MpesaCheckoutResult {
  ok: boolean;
  message: string;
  checkoutRequestId?: string;
}

function isTier(value: string): value is SubscriptionTier {
  return ["basic", "expanded", "exclusive"].includes(value);
}

export async function initiateMpesaCheckout(
  email: string,
  tier: SubscriptionTier,
  phoneNumber: string
): Promise<MpesaCheckoutResult> {
  try {
    const normalizedEmail = email.toLowerCase();

    if (!normalizedEmail || !normalizedEmail.includes("@")) {
      return { ok: false, message: "Please enter a valid email address" };
    }

    if (!isTier(tier)) {
      return { ok: false, message: "Invalid subscription tier" };
    }

    const normalizedPhone = normalizeKenyanPhone(phoneNumber);
    const tierPricing = PRICING_TIERS[tier];
    const quote = await getKesQuoteFromUsd(tierPricing.price);

    const supabase = await createAdminClient();

    const { data: existingProfile } = await supabase
      .from("user_profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile?.id) {
      const { data: activeSubscription } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", existingProfile.id)
        .eq("status", "active")
        .maybeSingle();

      if (activeSubscription) {
        return {
          ok: false,
          message: "You already have an active subscription.",
        };
      }
    }

    const { data: pendingRegistration } = await supabase
      .from("pending_registrations")
      .select("id, expires_at")
      .eq("email", normalizedEmail)
      .eq("is_completed", false)
      .maybeSingle();

    if (pendingRegistration) {
      const expiresAt = new Date(pendingRegistration.expires_at);
      if (expiresAt > new Date()) {
        return {
          ok: false,
          message:
            "A pending registration already exists for this email. Complete registration or wait for expiry.",
        };
      }
    }

    const accountReference = `TRIXIE-${tier.toUpperCase()}-${Date.now()}`;
    const stkResult = await initiateStkPush({
      phoneNumber: normalizedPhone,
      amountKes: quote.kesAmount,
      accountReference,
      transactionDescription: `${tierPricing.name} subscription payment`,
    });

    await supabase.from("payment_history").insert({
      email: normalizedEmail,
      dodo_checkout_id: stkResult.checkoutRequestId,
      amount: quote.kesAmount,
      currency: "KES",
      status: "pending",
      tier,
      payment_method: "mpesa_stk",
      metadata: {
        provider: "mpesa_daraja",
        merchant_request_id: stkResult.merchantRequestId,
        checkout_request_id: stkResult.checkoutRequestId,
        account_reference: accountReference,
        usd_amount: tierPricing.price,
        fx_rate: quote.usdToKesRate,
        fx_source: quote.source,
        phone_number: normalizedPhone,
      },
    });

    return {
      ok: true,
      checkoutRequestId: stkResult.checkoutRequestId,
      message:
        "STK Push sent. Check your phone and enter your M-Pesa PIN to complete payment. After approval, continue to the registration page with the same email.",
    };
  } catch (error) {
    console.error("M-Pesa checkout error:", error);
    return {
      ok: false,
      message:
        error instanceof Error
          ? error.message
          : "Unable to start M-Pesa payment. Please try again.",
    };
  }
}
