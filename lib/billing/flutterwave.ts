import { timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const FLUTTERWAVE_BASE_URL = "https://api.flutterwave.com/v3";

export function isFlutterwaveConfigured(): boolean {
  return Boolean(env.FLUTTERWAVE_SECRET_KEY);
}

export async function initializeFlutterwavePayment(params: {
  email: string;
  amount: number;
  currency: string;
  txRef: string;
  redirectUrl: string;
  customerName?: string;
  meta?: Record<string, string>;
}): Promise<{ status: string; data: { link: string } }> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error(
      "Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY unset)"
    );
  }

  const res = await fetch(`${FLUTTERWAVE_BASE_URL}/payments`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      tx_ref: params.txRef,
      amount: params.amount,
      currency: params.currency,
      redirect_url: params.redirectUrl,
      customer: { email: params.email, name: params.customerName },
      meta: params.meta,
    }),
  });

  if (!res.ok) {
    throw new Error(`Flutterwave initialize failed: ${res.status}`);
  }

  return res.json();
}

// Flutterwave's own guidance: never trust a webhook payload's amount/status
// directly — re-verify server-side via the transaction id before crediting.
export async function verifyFlutterwaveTransaction(
  transactionId: string
): Promise<{
  status: string;
  data: {
    status: string;
    amount: number;
    currency: string;
    tx_ref: string;
    customer: { email: string };
    meta?: Record<string, string>;
  };
}> {
  if (!env.FLUTTERWAVE_SECRET_KEY) {
    throw new Error(
      "Flutterwave is not configured (FLUTTERWAVE_SECRET_KEY unset)"
    );
  }

  const res = await fetch(
    `${FLUTTERWAVE_BASE_URL}/transactions/${transactionId}/verify`,
    {
      headers: { Authorization: `Bearer ${env.FLUTTERWAVE_SECRET_KEY}` },
    }
  );

  if (!res.ok) {
    throw new Error(`Flutterwave verify failed: ${res.status}`);
  }

  return res.json();
}

export function verifyFlutterwaveWebhookSignature(
  signature: string | null
): boolean {
  if (!env.FLUTTERWAVE_WEBHOOK_SECRET || !signature) return false;

  const expectedBuf = Buffer.from(env.FLUTTERWAVE_WEBHOOK_SECRET);
  const actualBuf = Buffer.from(signature);
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
