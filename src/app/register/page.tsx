import { createAdminClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { RegistrationForm } from "@/components/register/registration-form";
import Link from "next/link";

interface RegisterPageProps {
  searchParams: Promise<{
    checkout_id?: string;
    email?: string;
  }>;
}

export const metadata = {
  title: "Register - Trixie Subscription",
  description: "Complete your registration to access your subscription",
};

async function checkPendingRegistration(email: string) {
  try {
    const supabase = await createAdminClient();

    // Check if email has a valid pending registration
    const { data, error } = await supabase
      .from("pending_registrations")
      .select("id, tier_level, dodo_checkout_id, expires_at")
      .eq("email", email.toLowerCase())
      .eq("is_completed", false)
      .single();

    if (error || !data) {
      return { valid: false, error: "No valid pending registration found" };
    }

    // Check if the registration has expired
    const expiresAt = new Date(data.expires_at);
    if (expiresAt < new Date()) {
      return { 
        valid: false, 
        error: "Your payment session has expired. Please subscribe again." 
      };
    }

    return {
      valid: true,
      tier: data.tier_level,
      checkoutId: data.dodo_checkout_id,
    };
  } catch (error) {
    console.error("Error checking pending registration:", error);
    return { valid: false, error: "An error occurred. Please try again." };
  }
}

export default async function RegisterPage({ searchParams }: RegisterPageProps) {
  const params = await searchParams;
  const { checkout_id, email: urlEmail } = params;

  // If email is provided in URL, check for pending registration
  if (urlEmail) {
    const result = await checkPendingRegistration(urlEmail);

    if (!result.valid) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="max-w-md w-full text-center">
            <h1 className="text-2xl font-bold mb-4">Registration Not Available</h1>
            <p className="text-muted-foreground mb-6">{result.error}</p>
            <Link
              href="/pricing"
              className="inline-block bg-primary text-primary-foreground px-6 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Subscribe Now
            </Link>
          </div>
        </div>
      );
    }

    // User has valid pending registration, show the form
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="text-2xl font-bold">
              Trixie
            </Link>
            <nav className="flex items-center gap-4">
              <Link
                href="/"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Home
              </Link>
              <Link
                href="/pricing"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                Pricing
              </Link>
            </nav>
          </div>
        </header>

        <main className="container mx-auto px-4 py-12">
          <div className="max-w-md mx-auto">
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold mb-2">Complete Your Registration</h1>
              <p className="text-muted-foreground">
                Your payment has been verified. Create your account to access your{" "}
                <span className="font-semibold text-primary">
                  {result.tier === "basic" ? "Basic" : result.tier === "expanded" ? "Expanded" : "Exclusive"}
                </span>{" "}
                subscription.
              </p>
            </div>

            <RegistrationForm 
              prefilledEmail={urlEmail}
              checkoutId={checkout_id}
            />
          </div>
        </main>
      </div>
    );
  }

  // No email provided, show email verification form
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Trixie
          </Link>
          <nav className="flex items-center gap-4">
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Home
            </Link>
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Pricing
            </Link>
          </nav>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        <EmailVerificationForm />
      </main>
    </div>
  );
}

async function EmailVerificationForm() {
  return (
    <div className="max-w-md mx-auto">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold mb-2">Register</h1>
        <p className="text-muted-foreground">
          Enter the email you used to subscribe to verify your payment.
        </p>
      </div>

      <form
        action={async (formData) => {
          "use server";
          const email = formData.get("email") as string;
          if (email) {
            redirect(`/register?email=${encodeURIComponent(email)}`);
          }
        }}
        className="space-y-4"
      >
        <div>
          <label
            htmlFor="email"
            className="block text-sm font-medium mb-1"
          >
            Email Address
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            placeholder="you@example.com"
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-primary"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-primary text-primary-foreground py-2 px-4 rounded-md hover:bg-primary/90 transition-colors font-medium"
        >
          Verify Payment
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-muted-foreground">
        <p>
          Haven't subscribed yet?{" "}
          <Link href="/pricing" className="text-primary hover:underline">
            View Plans
          </Link>
        </p>
      </div>
    </div>
  );
}