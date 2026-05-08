import Link from "next/link";
import { redirect } from "next/navigation";
import { SecureCheckoutForm } from "@/components/checkout/secure-checkout-form";
import { PRICING_TIERS, type SubscriptionTier } from "@/lib/dodo/constants";
import { getKesQuoteFromUsd } from "@/lib/payments/currency";

interface CheckoutPageProps {
  searchParams: Promise<{
    tier?: string;
    email?: string;
  }>;
}

function isTier(value?: string): value is SubscriptionTier {
  return value === "basic" || value === "expanded" || value === "exclusive";
}

export const metadata = {
  title: "Secure Checkout - Trixie",
  description: "Pay securely using card or M-Pesa STK Push",
};

export default async function CheckoutPage({ searchParams }: CheckoutPageProps) {
  const params = await searchParams;

  if (!isTier(params.tier)) {
    redirect("/pricing");
  }

  const pricing = PRICING_TIERS[params.tier];
  const quote = await getKesQuoteFromUsd(pricing.price);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Trixie
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
            <Link
              href="/register"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Register
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <SecureCheckoutForm
          tier={params.tier}
          initialEmail={params.email}
          kesAmount={quote.kesAmount}
          usdToKesRate={quote.usdToKesRate}
        />
      </main>
    </div>
  );
}
