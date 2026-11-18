import Link from "next/link";
import { billingState, WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { AccessDenied, Heading, Shell } from "../ui";
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
  const openJobs = jobs.filter((job) => billingState(job) !== "closed");
  const closedJobs = jobs.filter((job) => billingState(job) === "closed");
  return <Shell actor={actor} path="/jobs">
    <Heading title="Jobs" text="Open a job to update its status, advance milestones or handle exceptions." />
    <section className="panel overflow-hidden">
      <div className="pad flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Open jobs</h2>
        <Link href="/#enquiry-heading" className="text-sm font-semibold text-wine">View enquiry inbox</Link>
      </div>
      <JobTable jobs={openJobs} users={users} labels={view.settings.labels} />
    </section>
    {closedJobs.length > 0 && <section className="panel overflow-hidden">
      <div className="pad"><h2 className="font-semibold">Closed jobs</h2></div>
      <JobTable jobs={closedJobs} users={users} labels={view.settings.labels} />
    </section>}
  </Shell>;
}
