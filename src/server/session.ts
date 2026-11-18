import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { services } from "./services";

export const cookieName = "rtc_session";

export function safeReturnPath(path: unknown) {
  return typeof path === "string" && /^\/(?:\?filter=(?:exceptions|overdue|billing|closed)|config|tour|jobs(?:\?(?:view=queue(?:&enquiry=[a-f0-9-]{36})?|enquiry=[a-f0-9-]{36}))?|enquiries(?:\/[a-f0-9-]{36})?|jobs\/[a-f0-9-]{36}(?:\?tab=(?:exceptions|documents|billing|history))?)$/.test(path) ? path : "/";
}

export const secureDemoCookies = Boolean(process.env.VERCEL);

export function isDemoEnabled() {
  if (process.env.VERCEL) return process.env.VERCEL_ENV === "preview" && process.env.RTC_PUBLIC_DEMO === "1";
  return process.env.RTC_LOCAL_DEMO === "1";
}

export const currentActor = cache(async () => {
  const token = (await cookies()).get(cookieName)?.value;
  if (!isDemoEnabled() || !token || !/^[\w-]{43}$/.test(token)) return undefined;
  return services().identity.resolve(token);
});

export async function requireActor() {
  const actor = await currentActor();
  if (!actor) redirect("/");
  return actor;
}
