import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";
import { dodoPayments, type SubscriptionTier } from "@/lib/dodo/payments";

export async function POST(request: NextRequest) {
  try {
    // Get the webhook signature from headers
    const signature = request.headers.get("x-dodo-signature") || "";
    
    // Get the raw body
    const body = await request.text();

    // Verify the webhook signature
    const event = await dodoPayments.parseWebhook(body, signature);

    if (!event) {
      return NextResponse.json(
        { error: "Invalid webhook payload" },
        { status: 400 }
      );
    }

    // Get Supabase admin client for database operations
    const supabase = await createAdminClient();

    // Handle different webhook event types
    switch (event.type) {
      case "checkout.session.completed": {
        const { checkout_id, email, tier } = event.data;

        if (!checkout_id || !email || !tier) {
          return NextResponse.json(
            { error: "Missing required fields in webhook data" },
            { status: 400 }
          );
        }

        // Check if this checkout has already been processed
        const { data: existing } = await supabase
          .from("pending_registrations")
          .select("id")
          .eq("dodo_checkout_id", checkout_id)
          .single();

        if (existing) {
          // Already processed, return success
          return NextResponse.json({ received: true });
        }

        // Insert the pending registration
        const { error: insertError } = await supabase
          .from("pending_registrations")
          .insert({
            email: email.toLowerCase(),
            dodo_checkout_id: checkout_id,
            tier_level: tier as SubscriptionTier,
            is_completed: false,
          });

        if (insertError) {
          // Check if it's a duplicate email error (user already has pending registration)
          if (insertError.code === "23505") {
            // Update existing pending registration with new checkout info
            const { error: updateError } = await supabase
              .from("pending_registrations")
              .update({
                dodo_checkout_id: checkout_id,
                tier_level: tier as SubscriptionTier,
                created_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours from now
              })
              .eq("email", email.toLowerCase())
              .eq("is_completed", false);

            if (updateError) {
              console.error("Failed to update pending registration:", updateError);
              return NextResponse.json(
                { error: "Failed to update pending registration" },
                { status: 500 }
              );
            }
          } else {
            console.error("Failed to insert pending registration:", insertError);
            return NextResponse.json(
              { error: "Failed to create pending registration" },
              { status: 500 }
            );
          }
        }

        // Also record the payment in payment history
        const { data: userData } = await supabase
          .from("user_profiles")
          .select("id")
          .eq("email", email.toLowerCase())
          .single();

        await supabase
          .from("payment_history")
          .insert({
            user_id: userData?.id || null,
            email: email.toLowerCase(),
            dodo_checkout_id: checkout_id,
            amount: event.data.amount || 0,
            currency: event.data.currency || "USD",
            status: "completed",
            tier: tier as SubscriptionTier,
            metadata: event.data,
          });

        console.log(`Pending registration created for email: ${email}, tier: ${tier}`);
        break;
      }

      case "checkout.session.expired": {
        const { checkout_id } = event.data;
        
        if (checkout_id) {
          // Mark the pending registration as expired/completed so it can't be used
          await supabase
            .from("pending_registrations")
            .update({ is_completed: true })
            .eq("dodo_checkout_id", checkout_id)
            .eq("is_completed", false);
        }
        break;
      }

      case "subscription.cancelled": {
        const { subscription_id, user_id } = event.data;
        
        if (subscription_id) {
          await supabase
            .from("subscriptions")
            .update({
              status: "cancelled",
              canceled_at: new Date().toISOString(),
            })
            .eq("dodo_subscription_id", subscription_id);
        }
        break;
      }

      case "subscription.renewed": {
        const { subscription_id, current_period_end } = event.data;
        
        if (subscription_id) {
          await supabase
            .from("subscriptions")
            .update({
              current_period_end: current_period_end,
              updated_at: new Date().toISOString(),
            })
            .eq("dodo_subscription_id", subscription_id);
        }
        break;
      }

      default:
        console.log(`Unhandled webhook event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("Webhook processing error:", error);
    
    // Return 400 for signature verification failures, 500 for other errors
    const status = error instanceof Error && error.message.includes("signature") 
      ? 400 
      : 500;

    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status }
    );
  }
}

// Handle GET requests for webhook testing
export async function GET() {
  return NextResponse.json({ 
    status: "ok", 
    message: "Dodo webhook endpoint is running" 
  });
}