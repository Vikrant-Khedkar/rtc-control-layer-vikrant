import Link from "next/link";
import { can, intakeFields, intakeLabels, type Actor, type Enquiry, type Job, type Quote, type Settings } from "../../src/core/model";
import { CommandForm, IntakeForm } from "../forms";
import { Badge, Details, money } from "../ui";

export function EnquiryPanels({ enquiry, quote, job, actor, settings, people, boardPath }: {
  enquiry: Enquiry; quote?: Quote; job?: Job; actor: Actor; settings: Settings; people: Actor[]; boardPath?: string;
}) {
  const approved = Boolean(job || quote?.approvedAt);
  const status = quote ? (approved ? "approved" : "draft") : enquiry.issues.length ? "needs_review" : "ready";
  return <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className="panel pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Enquiry details</h2>
          <Badge text={settings.labels[status]} tone={!quote && enquiry.issues.length ? "warn" : "neutral"} /></div>
        {enquiry.issues.length > 0 && <ul className="list-disc space-y-1 rounded-lg bg-amber-50 px-8 py-3 text-sm text-amber-900">
          {enquiry.issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>}
        <Details entries={{
          ...Object.fromEntries(intakeFields.map((field) => [intakeLabels[field], enquiry.data[field]])),
          Owner: people.find((person) => person.id === enquiry.ownerId)?.name,
        }} />
        {!quote && can(settings, actor, "intake.write") && <details className="border-t border-line pt-3">
          <summary className="text-sm font-semibold text-wine">Edit details</summary>
          <div className="mt-4"><IntakeForm reference={enquiry.sourceRef} required={settings.required} existing={enquiry} /></div>
        </details>}
      </section>
      <section className="panel pad space-y-4">
        <h2 className="font-semibold">Internal quote</h2>
        {quote ? <>
          <Details entries={{ "Mock rate": money(quote.baseCents, quote.currency), "Gross margin": `${quote.marginBps / 100}%`,
            "Draft total": money(quote.priceCents, quote.currency), Status: settings.labels[status] }} />
          {job ? <Link href={`/jobs/${job.id}`} className="button primary">Open job</Link>
            : can(settings, actor, "quote.approve") ? <CommandForm command="approve" ids={{ quoteId: quote.id, ...(boardPath ? { fromBoard: "1" } : {}) }} label="Approve quote and create job" />
              : boardPath && actor.role !== "manager" ? <Link className="button" href={`/profiles?next=${encodeURIComponent(boardPath)}`}>Switch to Manager</Link>
                : <p className="quiet">A Manager with approval permission must approve this quote.</p>}
        </> : <>
          <p className="quiet">The draft uses a synthetic rate and the configured gross margin.</p>
          {enquiry.issues.length ? <p className="quiet">Complete the missing or invalid details before drafting a quote.</p>
            : can(settings, actor, "quote.draft") && <>
              <p className="quiet">Check the enquiry details, then draft the quote for Manager approval.</p>
              <CommandForm command="draft" ids={{ enquiryId: enquiry.id }} label="Draft internal quote" />
            </>}
        </>}
      </section>
    </div>;
}
