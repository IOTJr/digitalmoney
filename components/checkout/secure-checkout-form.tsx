"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { createCheckoutSession } from "@/lib/actions/checkout";
import { initiateMpesaCheckout } from "@/lib/actions/mpesa";
import { type SubscriptionTier, PRICING_TIERS } from "@/lib/dodo/constants";

interface SecureCheckoutFormProps {
  tier: SubscriptionTier;
  initialEmail?: string;
  kesAmount: number;
  usdToKesRate: number;
}

type PaymentMethod = "card" | "mpesa";

export function SecureCheckoutForm({
  tier,
  initialEmail,
  kesAmount,
  usdToKesRate,
}: SecureCheckoutFormProps) {
  const [email, setEmail] = useState(initialEmail || "");
  const [phone, setPhone] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("card");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedTier = PRICING_TIERS[tier];

  const handlePay = () => {
    setError(null);
    setSuccessMessage(null);

    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (paymentMethod === "mpesa" && !phone.trim()) {
      setError("Please enter your M-Pesa phone number.");
      return;
    }

    startTransition(async () => {
      if (paymentMethod === "card") {
        const checkoutResult = await createCheckoutSession(email, tier);
        if (checkoutResult.error) {
          setError(checkoutResult.error);
          return;
        }

        if (checkoutResult.url) {
          window.location.href = checkoutResult.url;
          return;
        }

        setError("Unable to start card checkout. Please try again.");
        return;
      }

      const mpesaResult = await initiateMpesaCheckout(email, tier, phone);
      if (!mpesaResult.ok) {
        setError(mpesaResult.message);
        return;
      }

      setSuccessMessage(mpesaResult.message);
    });
  };

  return (
    <div className="max-w-xl mx-auto rounded-2xl border bg-card p-6 md:p-8 shadow-sm">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Secure Checkout</h1>
        <p className="text-sm text-muted-foreground">
          Complete payment for the <span className="font-semibold text-foreground">{selectedTier.name}</span> plan.
        </p>
      </div>

      <div className="rounded-lg border bg-muted/40 p-4 mb-6">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Plan Price (USD)</span>
          <span className="font-medium">${selectedTier.price}</span>
        </div>
        <div className="flex items-center justify-between text-sm mt-2">
          <span className="text-muted-foreground">Approx Price (KES)</span>
          <span className="font-medium">KES {kesAmount.toLocaleString()}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          FX reference rate: 1 USD = {usdToKesRate.toFixed(2)} KES. Final amount may vary slightly based on processor settlement.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="mb-4 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <div className="space-y-4">
        <div>
          <label htmlFor="checkout-email" className="block text-sm font-medium mb-1">
            Email address
          </label>
          <input
            id="checkout-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <p className="block text-sm font-medium mb-2">Payment method</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setPaymentMethod("card")}
              className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                paymentMethod === "card"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <span className="font-medium">Card Payment</span>
              <p className="text-xs text-muted-foreground mt-1">
                Redirect to hosted secure card checkout.
              </p>
            </button>

            <button
              type="button"
              onClick={() => setPaymentMethod("mpesa")}
              className={`rounded-md border px-3 py-2 text-sm text-left transition-colors ${
                paymentMethod === "mpesa"
                  ? "border-primary bg-primary/5"
                  : "hover:bg-muted"
              }`}
            >
              <span className="font-medium">M-Pesa STK Push</span>
              <p className="text-xs text-muted-foreground mt-1">
                Enter your number and approve on your phone.
              </p>
            </button>
          </div>
        </div>

        {paymentMethod === "mpesa" && (
          <div>
            <label htmlFor="mpesa-phone" className="block text-sm font-medium mb-1">
              M-Pesa phone number
            </label>
            <input
              id="mpesa-phone"
              type="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              className="w-full rounded-md border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="0712345678"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Use a Safaricom number in format 07XXXXXXXX, 01XXXXXXXX, or 2547XXXXXXXX.
            </p>
          </div>
        )}

        <Button type="button" className="w-full" size="lg" disabled={isPending} onClick={handlePay}>
          {isPending
            ? "Processing..."
            : paymentMethod === "card"
              ? "Continue to Card Checkout"
              : "Send M-Pesa STK Push"}
        </Button>
      </div>
    </div>
  );
}
