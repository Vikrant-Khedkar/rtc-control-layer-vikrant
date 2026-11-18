import Link from "next/link";
import { ArrowRight, CircleAlert, Clock3, Inbox, PackageCheck, Ship } from "lucide-react";
import { currentActor, demoMode } from "../src/server/session";
import { services } from "../src/server/services";
import { WorkflowError } from "../src/core/model";
import { JobTable } from "./jobs/table";
import { overviewRow } from "./jobs/overview";
import { ProfilePicker } from "./profiles/picker";
import { AccessDenied, Brand, Shell } from "./ui";

export const dynamic = "force-dynamic";

const filters = ["exceptions", "overdue", "billing", "closed"] as const;
const filterIcons = { open: Ship, exceptions: CircleAlert, overdue: Clock3, billing: PackageCheck };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ filter?: string | string[] }> }) {
  const mode = demoMode();
  const actor = await currentActor();
  if (!actor) {
    return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
      <div className="panel w-full p-6 sm:p-9">
        <Brand />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Sea Import Customs</h1>
        <p className="quiet mt-2 mb-6">Track an enquiry through quote approval, operational milestones and billing closure. All records in this assessment are synthetic.</p>
        {mode === "disabled" ? <p className="text-sm font-semibold text-wine">The demo is unavailable on this deployment.</p>
          : <ProfilePicker gate={mode === "protected"} />}
      </div>
    </main>;
  }
  const requested = (await searchParams).filter;
  const filter = filters.find((value) => value === requested) ?? "open";
  const path = filter === "open" ? "/" : `/?filter=${filter}`;
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;
  const { settings, records } = view;
  const [jobs, people] = await Promise.all([records.list("jobs"), records.actors()]);
  const now = Date.now();
  const rows = jobs.map((job) => overviewRow(job, now));
  const open = rows.filter((row) => row.billing !== "closed").sort((a, b) =>
    Number(b.issues.length > 0) - Number(a.issues.length > 0)
    || (a.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER) - (b.deadline?.getTime() ?? Number.MAX_SAFE_INTEGER),
  );
  const groups = {
    open: { label: "Open jobs", rows: open, empty: "Approved quotes appear here as jobs." },
    exceptions: { label: "Open exceptions", rows: open.filter((row) => row.issues.length > 0), empty: "No jobs have open exceptions." },
    overdue: { label: "Overdue", rows: open.filter((row) => row.overdue), empty: "No jobs are overdue." },
    billing: { label: settings.labels.billing_ready, rows: open.filter((row) => row.billing === "billing_ready"), empty: "No jobs are ready for billing closure." },
    closed: { label: settings.labels.closed, rows: rows.filter((row) => row.billing === "closed")
      .sort((a, b) => (b.job.closedAt ?? "").localeCompare(a.job.closedAt ?? "")), empty: "No jobs have been closed." },
  };
  const selected = groups[filter];

  return <Shell actor={actor} path={path}>
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">God View</h1>
        <p className="quiet mt-1.5">Sea Import Customs</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link href="/enquiries" className="button"><Inbox size={15} aria-hidden /> Enquiry inbox</Link>
        <Link href="/jobs" className="button primary">Jobs board <ArrowRight size={15} aria-hidden /></Link>
      </div>
    </header>
    <nav aria-label="Job filters" className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-4">
      {(["open", "exceptions", "overdue", "billing"] as const).map((key) => {
        const group = groups[key];
        const Icon = filterIcons[key];
        const active = key === filter;
        return <Link key={key} href={key === "open" ? "/" : `/?filter=${key}`} aria-current={active ? "page" : undefined}
          className={`block px-4 py-3.5 focus-visible:-outline-offset-2 sm:px-5 ${active ? "bg-rosewash/60" : "bg-white hover:bg-canvas"}`}>
          <div className="flex items-start justify-between gap-2">
            <span className={`text-sm font-medium ${active ? "text-wine" : "text-muted"}`}>{group.label}</span>
            <Icon size={17} aria-hidden className={`mt-0.5 shrink-0 ${active ? "text-wine" : "text-muted"}`} />
          </div>
          <p className="mt-1 text-2xl font-semibold tracking-tight tabular-nums">{group.rows.length}</p>
        </Link>;
      })}
    </nav>
    <section className="panel overflow-hidden" aria-labelledby="jobs-heading">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5 lg:border-b-0">
        <div className="flex flex-wrap items-baseline gap-2">
          <h2 className="font-semibold" id="jobs-heading">{selected.label}</h2>
          <span className="text-xs text-muted">{selected.rows.length} {selected.rows.length === 1 ? "job" : "jobs"}</span>
        </div>
        <Link href={filter === "closed" ? "/" : "/?filter=closed"} className="text-sm font-semibold text-wine hover:underline">
          {filter === "closed" ? "Back to open jobs" : `View closed (${groups.closed.rows.length})`}
        </Link>
      </div>
      <JobTable rows={selected.rows} people={people} labels={settings.labels} emptyMessage={selected.empty} />
    </section>
  </Shell>;
}
