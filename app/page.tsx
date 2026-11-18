import { randomUUID } from "node:crypto";
import Link from "next/link";
import { AlertCircle, ArrowUpRight, ClipboardList, PackageCheck, Ship } from "lucide-react";
import { currentActor, demoMode } from "../src/server/session";
import { services } from "../src/server/services";
import { billingState, can, currentStage, openExceptions, stageDeadline, WorkflowError } from "../src/core/model";
import { IntakeForm, RoleForm } from "./forms";
import { AccessDenied, Badge, Brand, Empty, Heading, Shell, ShortId } from "./ui";

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
  const now = Date.now();
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
      <div className="pad"><h2 className="text-lg font-semibold" id="jobs-heading">Jobs</h2></div>
      {jobs.length ? <div className="overflow-x-auto"><table className="data-table min-w-[1050px]">
        <thead><tr>{["Job ID", "Customer", "Mode", "Current stage", "Owner", "SLA", "Exceptions", "Next action", "Billing"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{jobs.map((job) => {
          const stage = currentStage(job);
          const issues = openExceptions(job);
          const billing = billingState(job);
          const overdue = Number(stageDeadline(job)) < now;
          return <tr key={job.id}>
            <td><Link className="inline-flex items-center gap-1 text-wine" href={`/jobs/${job.id}`}><ShortId prefix="JOB" id={job.id} /><ArrowUpRight size={13} /></Link></td>
            <td>{job.data.customer || "—"}</td><td>Sea import</td><td>{stage?.label ?? "Complete"}</td><td>{users.get(job.ownerId) ?? "—"}</td>
            <td>{stage ? <Badge text={overdue ? "Overdue" : "On track"} tone={overdue ? "danger" : "good"} /> : "—"}</td>
            <td>{issues.length ? <Badge text={`${issues.length} open`} tone="warn" /> : "—"}</td>
            <td>{billing === "closed" ? "—" : issues.length ? issues[0].recovery : stage ? `Complete: ${stage.label}` : "Accounts to close job"}</td>
            <td><Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} /></td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty message="Approved quotes appear here as jobs." />}
    </section>
    <section className="panel overflow-hidden" aria-labelledby="enquiry-heading">
      <div className="pad"><h2 className="text-lg font-semibold" id="enquiry-heading">Enquiries &amp; Quotes</h2></div>
      {enquiries.length ? <div className="overflow-x-auto"><table className="data-table min-w-[650px]">
        <thead><tr>{["Reference", "Customer", "Status", "Next action"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{enquiries.map((enquiry) => {
          const quote = quoteFor.get(enquiry.id);
          const job = jobFor.get(enquiry.id);
          const status = quote ? (quote.approvedAt ? "approved" : "draft") : (enquiry.issues.length ? "needs_review" : "ready");
          return <tr key={enquiry.id}>
            <td><Link className="font-semibold text-wine" href={`/enquiries/${enquiry.id}`}>{enquiry.sourceRef}</Link></td>
            <td>{enquiry.data.customer || "—"}</td><td><Badge text={settings.labels[status]} tone={status === "needs_review" ? "warn" : "neutral"} /></td>
            <td>{job ? <Link className="font-semibold text-wine" href={`/jobs/${job.id}`}>Open job</Link>
              : quote ? "Manager review" : enquiry.issues[0] ?? "Draft internal quote"}</td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty message="Create an enquiry to start a quote." />}
      {can(settings, actor, "intake.write") && <details className="border-t border-line pad" open={!enquiries.length}>
        <summary className="text-sm font-semibold text-wine">New enquiry</summary>
        <div className="mt-4"><IntakeForm reference={`DEMO-${randomUUID().slice(0, 8).toUpperCase()}`} required={settings.required} /></div>
      </details>}
    </section>
  </Shell>;
}
