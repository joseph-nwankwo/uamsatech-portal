import { createHmac, timingSafeEqual } from "crypto";
import { env } from "@/lib/env";

const PAYSTACK_BASE_URL = "https://api.paystack.co";

export function isPaystackConfigured(): boolean {
  return Boolean(env.PAYSTACK_SECRET_KEY);
}

export async function initializePaystackTransaction(params: {
  email: string;
  amountKobo: number;
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
