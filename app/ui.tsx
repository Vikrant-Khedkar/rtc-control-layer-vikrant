import Link from "next/link";
import { ArrowLeft, ArrowRightLeft, Boxes, BriefcaseBusiness, Compass, Inbox, LayoutDashboard, LogOut, Settings2, Ship } from "lucide-react";
import { signOut } from "./actions";
import type { Actor, Audit } from "../src/core/model";

export function Brand() {
  return <div className="flex items-center gap-3">
    <div className="grid size-10 place-items-center rounded-xl bg-wine text-white"><Ship size={22} aria-hidden /></div>
    <div><p className="text-sm font-bold tracking-tight">RTC Logistics</p><p className="text-xs text-muted">Control Layer</p></div>
  </div>;
}

export function Shell({ actor, path, children }: { actor: Actor; path: string; children: React.ReactNode }) {
  const pathname = path.split("?")[0];
  const links = [
    { href: "/", label: "God View", icon: LayoutDashboard },
    { href: "/enquiries", label: "Enquiry inbox", icon: Inbox },
    { href: "/jobs", label: "Jobs", icon: BriefcaseBusiness },
    ...(actor.role === "admin" ? [{ href: "/config", label: "Configuration", icon: Settings2 }] : []),
    { href: "/tour", label: "Guided tour", icon: Compass },
  ];
  return <div className="min-h-screen">
    <header className="border-b border-line bg-white">
      <div className="mx-auto grid max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 px-4 sm:px-8 lg:flex lg:gap-7">
        <Link href="/" aria-label="RTC Logistics home" className="my-3 w-fit shrink-0"><Brand /></Link>
        <nav aria-label="Workspace" className="col-span-full row-start-2 flex min-w-0 items-center gap-1 overflow-x-auto border-t border-line lg:flex-1 lg:border-t-0">
          {links.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
            return <Link key={href} href={href} aria-current={active ? (pathname === href ? "page" : "location") : undefined}
              className={`inline-flex min-h-12 shrink-0 items-center gap-1.5 border-b-2 px-2 text-sm font-semibold whitespace-nowrap focus-visible:-outline-offset-2 sm:px-3 lg:min-h-16 ${active ? "border-wine text-wine" : "border-transparent text-muted hover:text-ink"} ${href === "/tour" ? "lg:ml-auto" : ""}`}>
              <Icon size={15} aria-hidden />{label}
            </Link>;
          })}
        </nav>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2 lg:border-l lg:border-line lg:pl-4">
          <Link href={`/profiles?next=${encodeURIComponent(path)}`} aria-label="Switch profile" title="Switch profile"
            className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-left hover:bg-canvas">
            <span><span className="block text-xs font-semibold sm:text-sm">{actor.name}</span>
              <span className="block text-xs text-muted capitalize">{actor.role} · Demo</span></span>
            <ArrowRightLeft size={15} aria-hidden className="text-muted" />
          </Link>
          <form action={signOut}><button type="submit" className="grid size-10 place-items-center rounded-lg text-muted hover:bg-canvas" aria-label="Exit demo"><LogOut size={16} aria-hidden /></button></form>
        </div>
      </div>
    </header>
    <main className="mx-auto max-w-7xl space-y-6 px-4 pt-6 pb-12 sm:px-8">{children}</main>
  </div>;
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
