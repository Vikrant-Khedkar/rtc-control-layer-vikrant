import Link from "next/link";
import { jobSectionPath } from "./sections";
import { Columns3, ListChecks } from "lucide-react";
import { billingState, jobActionFor, WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { AccessDenied, Badge, Heading, Shell, ShortId } from "../ui";
import { JobTable } from "./table";
import { JobBoard } from "./board";

export const metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: { searchParams: Promise<{ view?: string | string[] }> }) {
  const [actor, query] = await Promise.all([requireActor(), searchParams]);
  const queue = query.view === "queue";
  const path = queue ? "/jobs?view=queue" : "/jobs";
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;

  const [jobs, people] = await Promise.all([view.records.list("jobs"), view.records.actors()]);
  const actions = jobs.flatMap((job) => {
    const action = jobActionFor(job, view.settings, actor);
    return action ? [{ job, action }] : [];
  });
  const actionIds = new Set(actions.map(({ job }) => job.id));
  const otherJobs = jobs.filter((job) => billingState(job) !== "closed" && !actionIds.has(job.id));
  const closedJobs = jobs.filter((job) => billingState(job) === "closed");
  return <Shell actor={actor} path={path}>
    <Heading title="Jobs" text="Pick up work assigned to your role and see what’s waiting on the rest of the team." />
    <div className="flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Jobs display" className="flex gap-2">
        <Link href="/jobs" aria-current={!queue ? "page" : undefined} className={`button ${!queue ? "primary" : ""}`}><Columns3 size={16} /> Board</Link>
        <Link href="/jobs?view=queue" aria-current={queue ? "page" : undefined} className={`button ${queue ? "primary" : ""}`}><ListChecks size={16} /> My queue</Link>
      </nav>
      <Link href="/enquiries" className="text-sm font-semibold text-wine">View enquiry inbox</Link>
    </div>
    {!queue && <p className="quiet">An enquiry becomes a job after the Manager approves its internal quote. <strong>Ready to start</strong> means the quote is approved and the first job milestone is pending.</p>}
    {!queue ? <JobBoard jobs={jobs} people={people} settings={view.settings} actor={actor} /> : <>
    <section aria-labelledby="action-heading">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 id="action-heading" className="text-lg font-semibold">Needs your action</h2>
        <Badge text={String(actions.length)} />
      </div>
      {actions.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {actions.map(({ job, action }) => <article className="panel pad flex flex-col items-start gap-2" key={job.id}>
          <div className="flex w-full flex-wrap justify-between gap-2">
            <p className="text-xs text-muted"><ShortId prefix="JOB" id={job.id} /> · Sea import</p>
            {job.operationalStatus && <Badge text={job.operationalStatus.label} />}
          </div>
          <h3 className="font-semibold">{job.data.customer || "Sea Import job"}</h3>
          <p className="mt-1 text-sm font-semibold">{action.title}</p>
          <p className="quiet mb-2">{action.detail}</p>
          <Link href={`/jobs/${job.id}${jobSectionPath(action.section)}`} className="button primary mt-auto" aria-label={`${action.label} for ${job.data.customer || "Sea Import job"}`}>{action.label}</Link>
        </article>)}
      </div> : <p className="panel pad quiet">{actor.role === "manager"
        ? "Quotes awaiting Manager approval are in the enquiry inbox."
        : "No jobs need your action right now."}</p>}
    </section>
    <section className="panel overflow-hidden">
      <div className="pad flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Other open jobs</h2>
      </div>
      <JobTable jobs={otherJobs} people={people} labels={view.settings.labels} emptyMessage="No other open jobs." />
    </section>
    {closedJobs.length > 0 && <section className="panel overflow-hidden">
      <div className="pad"><h2 className="font-semibold">Closed jobs</h2></div>
      <JobTable jobs={closedJobs} people={people} labels={view.settings.labels} />
    </section>}
    </>}
  </Shell>;
}
