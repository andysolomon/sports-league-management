import { Resend } from "resend";

let cachedClient: Resend | null = null;

export function getResend(): Resend {
  if (cachedClient) return cachedClient;

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    throw new Error("Missing RESEND_API_KEY environment variable");
  }

  cachedClient = new Resend(apiKey);
  return cachedClient;
}

export function getFromEmail(): string {
  return process.env.RESEND_FROM_EMAIL ?? "billing@sprtsmng.andrewsolomon.dev";
}
