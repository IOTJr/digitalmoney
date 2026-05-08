import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/server";

interface MpesaCallbackItem {
  Name: string;
  Value?: string | number;
}

interface MpesaCallbackPayload {
  Body?: {
    stkCallback?: {
      MerchantRequestID?: string;
      CheckoutRequestID?: string;
      ResultCode?: number;
      ResultDesc?: string;
      CallbackMetadata?: {
        Item?: MpesaCallbackItem[];
      };
    };
  };
}

function mapMetadata(items: MpesaCallbackItem[] = []) {
  return items.reduce<Record<string, string | number>>((acc, item) => {
    if (item?.Name && item.Value !== undefined) {
      acc[item.Name] = item.Value;
    }

    return acc;
  }, {});
}

export async function POST(request: NextRequest) {
  try {
    const callbackToken = request.nextUrl.searchParams.get("token");
    if (!process.env.MPESA_CALLBACK_TOKEN || callbackToken !== process.env.MPESA_CALLBACK_TOKEN) {
      return NextResponse.json({ error: "Unauthorized callback" }, { status: 401 });
    }

    const payload = (await request.json()) as MpesaCallbackPayload;
    const callback = payload?.Body?.stkCallback;

    if (!callback?.CheckoutRequestID) {
      return NextResponse.json({ error: "Invalid callback payload" }, { status: 400 });
    }

    const supabase = await createAdminClient();

    const { data: paymentRecord } = await supabase
      .from("payment_history")
      .select("id, email, tier, metadata")
      .eq("dodo_checkout_id", callback.CheckoutRequestID)
      .eq("payment_method", "mpesa_stk")
      .single();

    if (!paymentRecord) {
      return NextResponse.json({ received: true });
    }

    const metadataItems = callback.CallbackMetadata?.Item || [];
    const callbackData = mapMetadata(metadataItems);

    if (callback.ResultCode === 0) {
      await supabase
        .from("payment_history")
        .update({
          status: "completed",
          metadata: {
            ...(paymentRecord.metadata || {}),
            callback_result_code: callback.ResultCode,
            callback_result_desc: callback.ResultDesc,
            callback_data: callbackData,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);

      const { error: pendingInsertError } = await supabase
        .from("pending_registrations")
        .insert({
          email: paymentRecord.email,
          dodo_checkout_id: callback.CheckoutRequestID,
          tier_level: paymentRecord.tier,
          is_completed: false,
        });

      if (pendingInsertError?.code === "23505") {
        await supabase
          .from("pending_registrations")
          .update({
            dodo_checkout_id: callback.CheckoutRequestID,
            tier_level: paymentRecord.tier,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          })
          .eq("email", paymentRecord.email)
          .eq("is_completed", false);
      }
    } else {
      await supabase
        .from("payment_history")
        .update({
          status: "failed",
          metadata: {
            ...(paymentRecord.metadata || {}),
            callback_result_code: callback.ResultCode,
            callback_result_desc: callback.ResultDesc,
            callback_data: callbackData,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", paymentRecord.id);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("M-Pesa callback processing failed:", error);
    return NextResponse.json({ error: "Webhook processing failed" }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: "ok", provider: "mpesa" });
}
