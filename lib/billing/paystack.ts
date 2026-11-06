import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

export async function initializePaystackTransaction(params: {
  email: string;
  /** Amount in the currency's minor unit (kobo, cents, pesewas…). */
  amountKobo: number;
  /**
   * ISO currency of the plan. Required: without it Paystack charges the
   * merchant's default currency, so a USD price would be charged in NGN.
   */
  currency: string;
  reference: string;
  callbackUrl: string;
  metadata?: Record<string, unknown>;
}): Promise<{
  status: boolean;
  data: { authorization_url: string; access_code: string; reference: string };
}> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack is not configured (PAYSTACK_SECRET_KEY unset)");
  }

  const res = await fetch(`${PAYSTACK_BASE_URL}/transaction/initialize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      email: params.email,
      amount: params.amountKobo,
      currency: params.currency,
      reference: params.reference,
      callback_url: params.callbackUrl,
      metadata: params.metadata,
    }),
  });

  if (!res.ok) {
    throw new Error(`Paystack initialize failed: ${res.status}`);
  }

  return res.json();
}

export type PaystackTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  paidAt?: string | null;
};

/**
 * Authenticated lookup of one transaction (GET /transaction/verify/:reference).
 * Throws on transport errors or an unexpected body, so a webhook relying on
 * it fails (and is retried by Paystack) rather than recording guessed data.
 */
export async function verifyPaystackTransaction(
  reference: string
): Promise<PaystackTransaction> {
  if (!env.PAYSTACK_SECRET_KEY) {
    throw new Error("Paystack is not configured (PAYSTACK_SECRET_KEY unset)");
  }

  const res = await fetch(
    `${PAYSTACK_BASE_URL}/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${env.PAYSTACK_SECRET_KEY}` } }
  );
  if (!res.ok) {
    throw new Error(`Paystack verify failed: ${res.status}`);
  }

  const body = (await res.json()) as { status?: unknown; data?: unknown };
  if (body.status !== true || typeof body.data !== "object" || body.data === null) {
    throw new Error("Paystack verify returned an unexpected body");
  }
  return body.data as PaystackTransaction;
}

export function verifyPaystackWebhookSignature(
  rawBody: string,
  signature: string | null
): boolean {
  if (!env.PAYSTACK_SECRET_KEY || !signature) return false;

  const expected = createHmac("sha512", env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest("hex");

  const expectedBuf = Buffer.from(expected, "hex");
  const actualBuf = Buffer.from(signature, "hex");
  if (expectedBuf.length !== actualBuf.length) return false;

  return timingSafeEqual(expectedBuf, actualBuf);
}
