"use server";

import { headers } from "next/headers";
import { createServerSupabase } from "./server";

export type SendMagicLinkState =
  | { status: "idle" }
  | { status: "sent" }
  | { status: "error"; error: string };

export async function sendMagicLink(
  _prev: SendMagicLinkState,
  formData: FormData,
): Promise<SendMagicLinkState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!email) return { status: "error", error: "Enter an email address." };

  const supabase = await createServerSupabase();
  const origin = await requestOrigin();

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${origin}/auth/callback?next=/watchlist` },
  });

  if (error) return { status: "error", error: error.message };
  return { status: "sent" };
}

async function requestOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const h = await headers();
  const forwardedHost = h.get("x-forwarded-host");
  const forwardedProto = h.get("x-forwarded-proto") ?? "https";
  const host = forwardedHost ?? h.get("host") ?? "localhost:3000";
  const isLocal = host.startsWith("localhost") || host.startsWith("127.0.0.1");
  return `${isLocal ? "http" : forwardedProto}://${host}`;
}
