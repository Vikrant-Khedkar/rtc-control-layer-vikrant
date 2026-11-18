import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Boxes, BriefcaseBusiness, Compass, LayoutDashboard, LogOut, Settings2, Ship } from "lucide-react";
import { signOut } from "./actions";
import type { Actor, Audit } from "../src/core/model";

export function Brand() {
  return <div className="flex items-center gap-3">
    <div className="grid size-10 place-items-center rounded-xl bg-wine text-white"><Ship size={22} aria-hidden /></div>
    <div><p className="text-sm font-bold tracking-tight">RTC Logistics</p><p className="text-xs text-muted">Control Layer</p></div>
  </div>;
}

export function Shell({ actor, path, children }: { actor: Actor; path: string; children: React.ReactNode }) {
  const admin = actor.role === "admin";
  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <Link href="/" aria-label="RTC Logistics home"><Brand /></Link>
          <div className="flex flex-wrap items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-semibold">{actor.name}</p><p className="text-xs text-muted capitalize">{actor.role} · Demo</p></div>
            <Link href={`/profiles?next=${encodeURIComponent(path)}`} className="button">
              <ArrowRightLeft size={15} aria-hidden /> Switch profile
            </Link>
            <form action={signOut}><button type="submit" className="button !px-2.5" aria-label="Exit demo"><LogOut size={16} /></button></form>
          </div>
        </div>
      </header>
      <div className="mx-auto max-w-7xl px-4 pb-12 sm:px-8">
        <nav aria-label="Workspace" className="flex flex-wrap items-center gap-2 border-b border-line py-3">
          <Link href="/" aria-current={path === "/" ? "page" : undefined} className={`button ${path === "/" ? "!border-transparent !bg-rosewash !text-wine" : ""}`}><LayoutDashboard size={16} /> God View</Link>
          <Link href="/jobs" aria-current={path === "/jobs" ? "page" : undefined}
            className={`button ${path.startsWith("/jobs") ? "!border-transparent !bg-rosewash !text-wine" : ""}`}><BriefcaseBusiness size={16} /> Jobs</Link>
          {admin && <Link href="/config" aria-current={path === "/config" ? "page" : undefined} className={`button ${path === "/config" ? "!border-transparent !bg-rosewash !text-wine" : ""}`}><Settings2 size={16} /> Configuration</Link>}
          <Link href={path.startsWith("/tour") ? path : "/tour"} aria-current={path.startsWith("/tour") ? "page" : undefined}
            className={`button ${path.startsWith("/tour") ? "!border-transparent !bg-rosewash !text-wine" : ""}`}><Compass size={16} /> Guided tour</Link>
          <span className="ml-auto hidden text-xs text-muted sm:inline">Sea Import Customs · Synthetic data</span>
        </nav>
        <main className="mt-7 space-y-6">{children}</main>
      </div>
    </div>
  );
}

export function Heading({ title, text, back }: { title: string; text: string; back?: boolean | "jobs" }) {
  return <div>
    {back && <Link href={back === "jobs" ? "/jobs" : "/"} className="mb-3 inline-flex items-center gap-2 text-sm font-semibold text-wine">
      <ArrowLeft size={15} /> {back === "jobs" ? "Back to Jobs" : "God View"}
    </Link>}
    <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
    <p className="quiet mt-2">{text}</p>
  </div>;
}

export function Badge({ text, tone = "neutral" }: { text: string; tone?: "neutral" | "good" | "warn" | "danger" }) {
  const classes = { neutral: "bg-stone-100 text-stone-700", good: "bg-emerald-50 text-emerald-800",
    warn: "bg-amber-50 text-amber-900", danger: "bg-rosewash text-wine" };
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap ${classes[tone]}`}>{text}</span>;
}

export function Empty({ message }: { message: string }) {
  return <div className="flex items-center gap-3 px-5 py-6 text-sm text-muted"><Boxes size={18} aria-hidden />{message}</div>;
}

export function ShortId({ prefix, id }: { prefix: string; id: string }) {
  return <span className="font-mono text-xs font-semibold">{prefix}-{id.slice(0, 8).toUpperCase()}</span>;
}

const dateTimeFormatter = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata",
});

export function time(iso: string | Date) {
  return dateTimeFormatter.format(new Date(iso));
}

export function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(cents / 100);
}

export function Details({ entries }: { entries: Record<string, React.ReactNode> }) {
  return <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
    {Object.entries(entries).map(([key, value]) => <div key={key} className="min-w-0">
      <dt className="text-xs font-medium text-muted">{key}</dt><dd className="mt-1 break-words text-sm font-semibold">{value || "—"}</dd>
    </div>)}
  </dl>;
}

export function History({ events }: { events: Audit[] }) {
  return <section className="panel pad">
    <h2 className="mb-4 font-semibold">Audit history</h2>
    {events.length ? <ol className="divide-y divide-line">{events.map((event) => <li key={event.id} className="py-3 first:pt-0 last:pb-0">
      <div className="flex flex-wrap items-baseline justify-between gap-1">
        <h3 className="text-sm font-semibold">{event.action}</h3>
        <span className="text-xs text-muted">{time(event.at)} IST</span>
      </div>
      <p className="quiet mt-1"><span className="font-medium text-ink">{event.actor.name}</span> <span className="capitalize">({event.actor.role})</span> · {event.summary}</p>
      {event.changes && <details className="mt-2 text-xs text-muted"><summary>Change details</summary>
        <pre className="mt-2 overflow-auto rounded-lg bg-canvas p-3">{JSON.stringify(event.changes, null, 2)}</pre>
      </details>}
    </li>)}</ol> : <p className="quiet">No activity yet.</p>}
  </section>;
}

export function AccessDenied() {
  return <div className="panel pad"><h1 className="text-xl font-semibold">Access denied</h1>
    <p className="quiet mt-2">This demo role does not have access to this view.</p></div>;
}
