import Link from "next/link";
import { AlertCircle, ClipboardList, PackageCheck, Ship } from "lucide-react";
import { currentActor, demoMode } from "../src/server/session";
import { services } from "../src/server/services";
import { billingState, WorkflowError } from "../src/core/model";
import { JobTable } from "./jobs/table";
import { ProfilePicker } from "./profiles/picker";
import { AccessDenied, Brand, Heading, Shell } from "./ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const mode = demoMode();
  const actor = await currentActor();
  if (!actor) {
    return <main className="mx-auto flex min-h-screen max-w-3xl items-center px-4 py-12">
      <div className="panel w-full p-6 sm:p-9">
        <Brand />
        <h1 className="mt-8 text-3xl font-bold tracking-tight">Sea Import Customs</h1>
        <p className="quiet mt-2 mb-6">Track an enquiry through quote approval, operational milestones and billing closure. All records in this assessment are synthetic.</p>
        {mode === "disabled" ? <p className="text-sm font-semibold text-wine">The demo is unavailable on this deployment.</p>
          : <ProfilePicker gate={mode === "protected"} returnTo="/" />}
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
      <JobTable jobs={jobs} people={people} labels={settings.labels} />
    </section>
    <section className="panel pad flex flex-wrap items-center justify-between gap-3" aria-labelledby="enquiry-heading">
      <div><h2 id="enquiry-heading" className="text-lg font-semibold">Enquiry inbox</h2>
        <p className="quiet mt-1">Review incoming enquiries and quotes awaiting Manager approval.</p></div>
      <Link href="/enquiries" className="button">Open enquiry inbox</Link>
    </section>
  </Shell>;
}
