import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Columns3, ListChecks } from "lucide-react";
import { z } from "zod";
import { can, WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { EnquiryPanels } from "../enquiries/panels";
import { CommandForm } from "../forms";
import { enquiryHandoff, jobHandoff, WaitingOn } from "../handoff";
import { AccessDenied, Heading, Shell } from "../ui";
import { JobBoard } from "./board";

export const metadata = { title: "Jobs" };

export default async function JobsPage({ searchParams }: {
  searchParams: Promise<{ view?: string | string[]; enquiry?: string | string[] }>;
}) {
  const [actor, query] = await Promise.all([requireActor(), searchParams]);
  const queue = query.view === "queue";
  const base = queue ? "/jobs?view=queue" : "/jobs";
  const selectedId = z.uuid().safeParse(query.enquiry).data;
  const path = selectedId ? `${base}${queue ? "&" : "?"}enquiry=${selectedId}` : base;
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;

  const { records, settings } = view;
  const [enquiries, quotes, people] = await Promise.all([
    records.list("enquiries"), records.list("quotes"), records.actors(),
  ]);
  const jobs = await records.list("jobs");
  const quoteFor = new Map(quotes.map((quote) => [quote.enquiryId, quote]));
  const jobFor = new Map(jobs.map((job) => [job.enquiryId, job]));
  const pending = enquiries.filter((enquiry) => !jobFor.has(enquiry.id) && !quoteFor.get(enquiry.id)?.approvedAt);
  const selected = enquiries.find((enquiry) => enquiry.id === selectedId);
  const selectedJob = selected && jobFor.get(selected.id);
  const selectedQuote = selected && (quoteFor.get(selected.id) ?? (selectedJob && await records.quoteByEnquiry(selected.id)));
  const handoff = selectedJob ? jobHandoff(selectedJob, people)
    : selected ? enquiryHandoff(selected, selectedQuote, people) : undefined;

  return <Shell actor={actor} path={path}>
    <Heading title="Jobs" text="Follow enquiries, approvals and jobs from intake to billing." />
    <div className="flex flex-wrap items-start justify-between gap-3">
      <nav aria-label="Jobs display" className="flex gap-2">
        <Link href="/jobs" aria-current={!queue ? "page" : undefined} className={`button ${!queue ? "primary" : ""}`}><Columns3 size={16} /> Board</Link>
        <Link href="/jobs?view=queue" aria-current={queue ? "page" : undefined} className={`button ${queue ? "primary" : ""}`}><ListChecks size={16} /> My queue</Link>
      </nav>
      {can(settings, actor, "intake.write") && <CommandForm command="import-inbox" ids={{ batchId: randomUUID() }}
        label="Simulate incoming enquiries" secondary />}
    </div>
    {selected && <section aria-labelledby="selected-enquiry" className="space-y-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs break-all text-muted">{selected.sourceRef}</p>
          <h2 id="selected-enquiry" className="text-xl font-semibold tracking-tight">{selected.data.customer || "Enquiry"}</h2>
          {handoff && <WaitingOn handoff={handoff} />}
        </div>
        <Link className="button" href={base}>Close enquiry</Link>
      </div>
      <EnquiryPanels key={selected.id} enquiry={selected} quote={selectedQuote} job={selectedJob}
        actor={actor} settings={settings} people={people} boardPath={path} />
    </section>}
    <JobBoard jobs={jobs} enquiries={pending} quoteFor={quoteFor} people={people} settings={settings}
      actor={actor} queue={queue} />
  </Shell>;
}
