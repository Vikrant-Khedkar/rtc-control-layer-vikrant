import Link from "next/link";
import { billingState, jobActionFor, WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { AccessDenied, Badge, Heading, Shell, ShortId } from "../ui";
import { JobTable } from "./table";

export const metadata = { title: "Jobs" };

export default async function JobsPage() {
  const actor = await requireActor();
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path="/jobs"><AccessDenied /></Shell>;

  const [jobs, people] = await Promise.all([view.records.list("jobs"), view.records.actors()]);
  const users = new Map(people.map((person) => [person.id, person.name]));
  const actions = jobs.flatMap((job) => {
    const action = jobActionFor(job, view.settings, actor);
    return action ? [{ job, action }] : [];
  });
  const actionIds = new Set(actions.map(({ job }) => job.id));
  const otherJobs = jobs.filter((job) => billingState(job) !== "closed" && !actionIds.has(job.id));
  const closedJobs = jobs.filter((job) => billingState(job) === "closed");
  return <Shell actor={actor} path="/jobs">
    <Heading title="Jobs" text="Pick up work assigned to your role and see what’s waiting on the rest of the team." />
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
          <Link href={`/jobs/${job.id}#${action.section}`} className="button primary mt-auto" aria-label={`${action.label} for ${job.data.customer || "Sea Import job"}`}>{action.label}</Link>
        </article>)}
      </div> : <p className="panel pad quiet">{actor.role === "manager"
        ? "Quotes awaiting Manager approval are in the enquiry inbox."
        : "No jobs need your action right now."}</p>}
    </section>
    <section className="panel overflow-hidden">
      <div className="pad flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Other open jobs</h2>
        <Link href="/#enquiry-heading" className="text-sm font-semibold text-wine">View enquiry inbox</Link>
      </div>
      <JobTable jobs={otherJobs} users={users} labels={view.settings.labels} emptyMessage="No other open jobs." />
    </section>
    {closedJobs.length > 0 && <section className="panel overflow-hidden">
      <div className="pad"><h2 className="font-semibold">Closed jobs</h2></div>
      <JobTable jobs={closedJobs} users={users} labels={view.settings.labels} />
    </section>}
  </Shell>;
}
