/**
 * The subset of Paystack's API we depend on, typed narrowly.
 *
 * Everything here is *provider-reported* data. None of it is trusted as the
 * source of truth for what a student owes — it is only ever compared against
 * what we stored when the payment was created.
 */

export type PaystackInitializeRequest = {
  email: string;
  /** Amount in minor units (kobo). */
  amount: number;
  currency: string;
  reference: string;
  callback_url: string;
  metadata: Record<string, unknown>;
  channels?: string[];
};

export type PaystackInitializeData = {
  authorization_url: string;
  access_code: string;
  reference: string;
};

export type PaystackTransaction = {
  id: number;
  status: string;
  reference: string;
  /** Amount in minor units, as reported by Paystack. */
  amount: number;
  currency: string;
  channel: string | null;
  paid_at: string | null;
  created_at: string | null;
  gateway_response: string | null;
  customer?: { email?: string | null } | null;
  metadata?: unknown;
  authorization?: { channel?: string | null } | null;
};

export type PaystackWebhookEvent = {
  event: string;
  data: {
    id?: number;
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string | null;
    gateway_response?: string | null;
    [key: string]: unknown;
  };
};

export type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};
