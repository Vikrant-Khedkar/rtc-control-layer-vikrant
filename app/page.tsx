import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AlertCircle, ClipboardList, PackageCheck, Ship } from "lucide-react";
import { currentActor, demoMode } from "../src/server/session";
import { services } from "../src/server/services";
import { billingState, can, WorkflowError } from "../src/core/model";
import { CommandForm, IntakeForm, RoleForm } from "./forms";
import { TourHint } from "./tour/hint";
import { JobTable } from "./jobs/table";
import { AccessDenied, Badge, Brand, Empty, Heading, Shell } from "./ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const mode = demoMode();
  const actor = await currentActor();
  if (!actor) {
    return <main className="mx-auto flex min-h-screen max-w-xl items-center px-4 py-12">
      <div className="panel w-full p-6 sm:p-9">
        <Brand />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Sea Import Customs</h1>
        <p className="quiet mt-2 mb-6">Track an enquiry through quote approval, operational milestones and billing closure. All records in this assessment are synthetic.</p>
        {mode === "disabled" ? <p className="text-sm font-semibold text-wine">The demo is unavailable on this deployment.</p>
          : <RoleForm gate={mode === "protected"} returnTo="/" />}
      </div>
    </main>;
  }
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path="/"><AccessDenied /></Shell>;
  const { settings, records } = view;
  const [enquiries, quotes, jobs, people] = await Promise.all([
    records.list("enquiries"), records.list("quotes"), records.list("jobs"), records.actors(),
  ]);
  const users = new Map(people.map((person) => [person.id, person.name]));
  const quoteFor = new Map(quotes.map((quote) => [quote.enquiryId, quote]));
  const jobFor = new Map(jobs.map((job) => [job.enquiryId, job]));
  const cards = [
    { label: "Active jobs", count: jobs.filter((job) => billingState(job) === "active").length, icon: Ship },
    { label: "Needs review", count: enquiries.filter((enquiry) => enquiry.issues.length).length, icon: AlertCircle },
    { label: "Awaiting approval", count: quotes.filter((quote) => !quote.approvedAt).length, icon: ClipboardList },
    { label: "Billing ready", count: jobs.filter((job) => billingState(job) === "billing_ready").length, icon: PackageCheck },
  ];
  return <Shell actor={actor} path="/">
    <Heading title="Operations God View" text="Sea Import Customs · job progress, outstanding actions and billing readiness." />
    <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map(({ label, count, icon: Icon }) => <div key={label} className="panel pad">
        <div className="flex items-center gap-2 text-sm font-medium text-muted"><Icon className="text-wine" size={16} />{label}</div>
        <div className="mt-2 text-3xl font-bold tabular-nums">{count}</div>
      </div>)}
    </div>
    <section className="panel overflow-hidden" aria-labelledby="jobs-heading">
      <div className="pad flex items-center justify-between gap-2"><h2 className="text-lg font-semibold" id="jobs-heading">Jobs</h2><Link href="/jobs" className="button">Open Jobs workspace</Link></div>
      <JobTable jobs={jobs} users={users} labels={settings.labels} />
    </section>
    <section className="panel overflow-hidden" aria-labelledby="enquiry-heading">
      <div className="pad space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold" id="enquiry-heading">Enquiry inbox</h2>
            <p className="quiet mt-1">Review incoming enquiries and track internal quotes.</p>
          </div>
          {can(settings, actor, "intake.write") && <CommandForm command="import-inbox" ids={{ batchId: randomUUID() }}
            label="Simulate incoming enquiries" secondary />}
        </div>
        <TourHint title={actor.role === "manager" ? "Review a draft quote" : actor.role === "accounts" ? "Find a billing-ready job" : "Start with an incoming enquiry"}>
          {actor.role === "manager" ? "Open an enquiry awaiting approval and review the draft quote."
            : actor.role === "accounts" ? "Open a billing-ready job in the Jobs list to review and close it."
              : actor.role === "operations" ? "Open a sample enquiry. Pick Ready to quote for the direct path, or Needs Review to see how missing details are handled."
                : "Switch to Operations in the header to review an incoming enquiry."}
        </TourHint>
      </div>
      {enquiries.length ? <div className="overflow-x-auto"><table className="data-table min-w-[650px]">
        <thead><tr>{["Reference", "Customer", "Owner", "Status", "Next action"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{enquiries.map((enquiry) => {
          const quote = quoteFor.get(enquiry.id);
          const job = jobFor.get(enquiry.id);
          const status = quote ? (quote.approvedAt ? "approved" : "draft") : (enquiry.issues.length ? "needs_review" : "ready");
          return <tr key={enquiry.id}>
            <td><Link className="font-semibold text-wine" href={`/enquiries/${enquiry.id}`}>{enquiry.sourceRef}</Link></td>
            <td>{enquiry.data.customer || "—"}</td><td>{users.get(enquiry.ownerId) ?? "—"}</td>
            <td><Badge text={settings.labels[status]} tone={status === "needs_review" ? "warn" : "neutral"} /></td>
            <td>{job ? <Link className="font-semibold text-wine" href={`/jobs/${job.id}`}>Open job</Link>
              : quote ? "Manager review" : enquiry.issues[0] ?? "Draft internal quote"}</td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty message="Incoming enquiries will appear here. Operations can simulate an incoming batch for the demo." />}
      {can(settings, actor, "intake.write") && <details className="border-t border-line pad" open={!enquiries.length}>
        <summary className="text-sm font-semibold text-wine">New enquiry</summary>
        <div className="mt-4"><IntakeForm reference={`DEMO-${randomUUID().slice(0, 8).toUpperCase()}`} required={settings.required} /></div>
      </details>}
    </section>
  </Shell>;
}
