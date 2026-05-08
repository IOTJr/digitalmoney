import { Buffer } from "node:buffer";

export interface StkPushRequest {
  phoneNumber: string;
  amountKes: number;
  accountReference: string;
  transactionDescription: string;
}

export interface StkPushResult {
  merchantRequestId: string;
  checkoutRequestId: string;
  customerMessage: string;
  responseCode: string;
  responseDescription: string;
}

function getMpesaBaseUrl() {
  const mode = (process.env.MPESA_ENV || "sandbox").toLowerCase();
  return mode === "live"
    ? "https://api.safaricom.co.ke"
    : "https://sandbox.safaricom.co.ke";
}

function requiredEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

function getTimestamp() {
  const now = new Date();
  const parts = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
    String(now.getHours()).padStart(2, "0"),
    String(now.getMinutes()).padStart(2, "0"),
    String(now.getSeconds()).padStart(2, "0"),
  ];

  return parts.join("");
}

export function normalizeKenyanPhone(rawPhone: string) {
  const digits = rawPhone.replace(/\D/g, "");

  if (/^2547\d{8}$/.test(digits) || /^2541\d{8}$/.test(digits)) {
    return digits;
  }

  if (/^07\d{8}$/.test(digits) || /^01\d{8}$/.test(digits)) {
    return `254${digits.slice(1)}`;
  }

  throw new Error("Enter a valid Kenyan phone number, e.g. 0712345678");
}

async function getAccessToken() {
  const consumerKey = requiredEnv("MPESA_CONSUMER_KEY");
  const consumerSecret = requiredEnv("MPESA_CONSUMER_SECRET");

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const baseUrl = getMpesaBaseUrl();

  const response = await fetch(
    `${baseUrl}/oauth/v1/generate?grant_type=client_credentials`,
    {
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
      },
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to authenticate with Daraja: ${response.status}`);
  }

  const payload = (await response.json()) as {
    access_token?: string;
  };

  if (!payload.access_token) {
    throw new Error("Daraja token response did not contain access_token");
  }

  return payload.access_token;
}

function getCallbackUrl() {
  const appUrl = requiredEnv("NEXT_PUBLIC_APP_URL");
  const callbackToken = requiredEnv("MPESA_CALLBACK_TOKEN");

  return `${appUrl}/api/webhooks/mpesa?token=${encodeURIComponent(callbackToken)}`;
}

export async function initiateStkPush(request: StkPushRequest): Promise<StkPushResult> {
  const shortCode = requiredEnv("MPESA_SHORTCODE");
  const passkey = requiredEnv("MPESA_PASSKEY");
  const timestamp = getTimestamp();
  const password = Buffer.from(`${shortCode}${passkey}${timestamp}`).toString(
    "base64"
  );

  const token = await getAccessToken();
  const baseUrl = getMpesaBaseUrl();

  const response = await fetch(`${baseUrl}/mpesa/stkpush/v1/processrequest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      BusinessShortCode: shortCode,
      Password: password,
      Timestamp: timestamp,
      TransactionType:
        process.env.MPESA_TRANSACTION_TYPE || "CustomerPayBillOnline",
      Amount: Math.max(1, Math.round(request.amountKes)),
      PartyA: request.phoneNumber,
      PartyB: shortCode,
      PhoneNumber: request.phoneNumber,
      CallBackURL: getCallbackUrl(),
      AccountReference: request.accountReference,
      TransactionDesc: request.transactionDescription,
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(`Daraja STK request failed (${response.status}): ${text}`);
  }

  const payload = (await response.json()) as {
    MerchantRequestID?: string;
    CheckoutRequestID?: string;
    ResponseCode?: string;
    ResponseDescription?: string;
    CustomerMessage?: string;
  };

  if (!payload.CheckoutRequestID || !payload.MerchantRequestID) {
    throw new Error("Daraja STK response was missing request IDs");
  }

  if (payload.ResponseCode !== "0") {
    throw new Error(payload.ResponseDescription || "Daraja STK request was rejected");
  }

  return {
    merchantRequestId: payload.MerchantRequestID,
    checkoutRequestId: payload.CheckoutRequestID,
    customerMessage: payload.CustomerMessage || "STK Push initiated",
    responseCode: payload.ResponseCode,
    responseDescription: payload.ResponseDescription || "Accepted",
  };
}
