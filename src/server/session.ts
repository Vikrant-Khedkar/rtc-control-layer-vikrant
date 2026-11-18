import { createHash, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { services } from "./services";

export const cookieName = "rtc_session";

export function safeReturnPath(path: unknown) {
  return typeof path === "string" && /^\/(?:config|tour|jobs(?:\?view=queue)?|(?:enquiries|jobs)\/[a-f0-9-]{36})$/.test(path) ? path : "/";
}

export function demoMode(): "local" | "protected" | "disabled" {
  if (!process.env.VERCEL && process.env.RTC_LOCAL_DEMO === "1") return "local";
  if (process.env.VERCEL && process.env.VERCEL_ENV !== "preview") return "disabled";
  return (process.env.RTC_DEMO_ACCESS_CODE?.length ?? 0) >= 24 ? "protected" : "disabled";
}

export function codeMatches(code: string) {
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(code), digest(process.env.RTC_DEMO_ACCESS_CODE ?? ""));
}

export const currentActor = cache(async () => {
  if (demoMode() === "disabled") return undefined;
  const token = (await cookies()).get(cookieName)?.value;
  if (!token || !/^[\w-]{43}$/.test(token)) return undefined;
  return services().identity.resolve(token);
});

export async function requireActor() {
  const actor = await currentActor();
  if (!actor) redirect("/");
  return actor;
}
