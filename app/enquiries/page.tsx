import { randomUUID } from "node:crypto";
import Link from "next/link";
import { can, WorkflowError } from "../../src/core/model";
import { requireActor } from "../../src/server/session";
import { services } from "../../src/server/services";
import { CommandForm, IntakeForm } from "../forms";
import { enquiryHandoff, jobHandoff, WaitingOn } from "../handoff";
import { TourHint } from "../tour/hint";
import { AccessDenied, Badge, Empty, Shell } from "../ui";

export const metadata = { title: "Enquiry inbox" };

export default async function EnquiryInbox() {
  const actor = await requireActor();
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path="/enquiries"><AccessDenied /></Shell>;
  const { settings, records } = view;
  const [enquiries, quotes, jobs, people] = await Promise.all([
    records.list("enquiries"), records.list("quotes"), records.list("jobs"), records.actors(),
  ]);
  const quoteFor = new Map(quotes.map((quote) => [quote.enquiryId, quote]));
  const jobFor = new Map(jobs.map((job) => [job.enquiryId, job]));
  return <Shell actor={actor} path="/enquiries">
    <header className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 id="enquiry-heading" className="text-3xl font-bold tracking-tight sm:text-4xl">Enquiry inbox</h1>
        <p className="quiet mt-2">Review incoming enquiries and track internal quotes.</p>
      </div>
      {can(settings, actor, "intake.write") && <CommandForm command="import-inbox" ids={{ batchId: randomUUID() }}
        label="Simulate incoming enquiries" secondary />}
    </header>
    <TourHint title={actor.role === "manager" ? "Review a draft quote" : actor.role === "accounts" ? "Find a billing-ready job" : "Start with an incoming enquiry"}>
      {actor.role === "manager" ? "Open an enquiry awaiting Manager and review the draft quote."
        : actor.role === "accounts" ? "Open a billing-ready job in Jobs to review and close it."
          : actor.role === "operations" ? "Open a Ready to quote enquiry for the direct path, or Needs Review to see how missing details are handled."
            : "Use Switch profile in the header to continue as Operations."}
    </TourHint>
    <section className="panel overflow-hidden" aria-labelledby="enquiry-heading">
      {enquiries.length ? <div className="overflow-x-auto"><table className="data-table min-w-[650px]">
        <thead><tr>{["Enquiry", "Status", "Waiting on", "Next action"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{enquiries.map((enquiry) => {
          const quote = quoteFor.get(enquiry.id);
          const job = jobFor.get(enquiry.id);
          const status = quote ? (quote.approvedAt ? "approved" : "draft") : (enquiry.issues.length ? "needs_review" : "ready");
          const handoff = job ? jobHandoff(job, people) : enquiryHandoff(enquiry, quote, people);
          const href = `/enquiries/${enquiry.id}`;
          return <tr key={enquiry.id}>
            <td><Link className="font-semibold text-wine" href={href}>{enquiry.data.customer || enquiry.sourceRef}</Link>
              <p className="mt-1 text-xs break-all text-muted">{enquiry.sourceRef}</p></td>
            <td><Badge text={settings.labels[status]} tone={status === "needs_review" ? "warn" : "neutral"} /></td>
            <td>{handoff ? <WaitingOn handoff={handoff} /> : job?.closedAt ? settings.labels.closed : "—"}</td>
            <td>{job ? <Link className="font-semibold text-wine" href={`/jobs/${job.id}`}>Open job</Link>
              : <Link className="font-semibold text-wine" href={href}>{quote ? "Review quote" : "Check enquiry details"}</Link>}
              {!quote && enquiry.issues[0] && <p className="mt-1 text-xs text-muted">{enquiry.issues[0]}</p>}</td>
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
