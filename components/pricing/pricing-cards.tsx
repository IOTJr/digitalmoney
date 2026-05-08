"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PRICING_TIERS, type SubscriptionTier } from "@/lib/dodo/constants";
import { useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";

interface PricingCardsProps {
  userEmail?: string;
}

export function PricingCards({ userEmail: initialEmail }: PricingCardsProps) {
  const [email, setEmail] = useState(initialEmail || "");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTier, setSelectedTier] = useState<SubscriptionTier | null>(null);
  const router = useRouter();

  const handleSubscribe = (tier: SubscriptionTier) => {
    if (!email || !email.includes("@")) {
      setError("Please enter a valid email address");
      return;
    }

    setError(null);
    setSelectedTier(tier);
    
    startTransition(async () => {
      router.push(
        `/checkout?tier=${tier}&email=${encodeURIComponent(email.toLowerCase())}`
      );
    });
  };

  const tiers = [
    { ...PRICING_TIERS.basic, popular: false },
    { ...PRICING_TIERS.expanded, popular: true },
    { ...PRICING_TIERS.exclusive, popular: false },
  ];

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Email Input Section */}
      <div className="mb-12 text-center">
        <h2 className="text-2xl font-bold mb-4">Enter your email to get started</h2>
        <div className="max-w-md mx-auto flex gap-2">
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="flex-1 px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>
        {error && (
          <p className="text-red-500 text-sm mt-2">{error}</p>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
        {tiers.map((tier) => (
          <Card
            key={tier.id}
            className={`relative flex flex-col ${
              tier.popular
                ? "border-primary shadow-lg scale-105"
                : ""
            }`}
          >
            {tier.popular && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                  MOST POPULAR
                </span>
              </div>
            )}
            
            <CardHeader className="text-center pb-4">
              <CardTitle className="text-2xl">{tier.name}</CardTitle>
              <CardDescription>{tier.description}</CardDescription>
              <div className="mt-4">
                <span className="text-4xl font-bold">${tier.price}</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            
            <CardContent className="flex-1">
              <ul className="space-y-3">
                {tier.features.map((feature, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
            
            <CardFooter className="pt-6">
              <Button
                className="w-full"
                size="lg"
                disabled={isPending && selectedTier === tier.id}
                onClick={() => handleSubscribe(tier.id as SubscriptionTier)}
              >
                {isPending && selectedTier === tier.id
                  ? "Processing..."
                  : "Subscribe Now"}
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>

      {/* Trust indicators */}
      <div className="mt-12 text-center text-sm text-muted-foreground">
        <p>Secure payments powered by Dodo Payments</p>
        <p className="mt-1">Cancel anytime. No hidden fees.</p>
      </div>
    </div>
  );
}