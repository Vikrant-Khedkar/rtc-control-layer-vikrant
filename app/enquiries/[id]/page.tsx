import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, intakeFields, intakeLabels, WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { CommandForm, IntakeForm } from "../../forms";
import { TourHint } from "../../tour/hint";
import { AccessDenied, Badge, Details, Heading, History, money, Shell } from "../../ui";

export default async function EnquiryPage({ params }: { params: Promise<{ id: string }> }) {
  const [actor, { id }] = await Promise.all([requireActor(), params]);
  if (!z.uuid().safeParse(id).success) notFound();
  const path = `/enquiries/${id}`;
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;
  const { settings, records } = view;
  const [enquiry, quote] = await Promise.all([records.get("enquiries", id), records.quoteByEnquiry(id)]);
  if (!enquiry) notFound();
  const [audit, job, people] = await Promise.all([
    records.auditFor(quote ? [id, quote.id] : [id]), quote ? records.jobByQuote(quote.id) : undefined, records.actors(),
  ]);
  const status = enquiry.issues.length ? "needs_review" : "ready";
  return <Shell actor={actor} path={path}>
    <Heading title={enquiry.sourceRef} text={`${enquiry.data.customer || "Enquiry"} · Sea Import Customs`} back />
    <TourHint title={job ? "Open the approved job" : quote ? "Review the internal quote" : "Review the enquiry details"}>
      {job ? "Open the job to see its milestones, exceptions and billing status."
        : quote ? (actor.role === "manager" ? "Check the mock rate, margin and quote total, then approve the draft."
          : "Use Switch profile in the header to continue as Manager and approve this draft.")
          : enquiry.issues.length ? "Operations can use Edit details to correct verified information. Leave the enquiry in Needs Review if the information is still missing."
            : "Check the enquiry fields below. If they’re complete, use Draft internal quote."}
    </TourHint>
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className="panel pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Enquiry details</h2>
          <Badge text={settings.labels[quote ? (quote.approvedAt ? "approved" : "draft") : status]} tone={!quote && enquiry.issues.length ? "warn" : "neutral"} /></div>
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
            "Draft total": money(quote.priceCents, quote.currency), Status: settings.labels[quote.approvedAt ? "approved" : "draft"] }} />
          {job ? <Link href={`/jobs/${job.id}`} className="button primary">Open job</Link>
            : can(settings, actor, "quote.approve") ? <CommandForm command="approve" ids={{ quoteId: quote.id }} label="Approve quote and create job" />
              : <p className="quiet">A Manager with approval permission must approve this quote.</p>}
        </> : <>
          <p className="quiet">The draft uses a synthetic rate and the configured gross margin.</p>
          {enquiry.issues.length ? <p className="quiet">Complete the missing or invalid details before drafting a quote.</p>
            : can(settings, actor, "quote.draft") && <CommandForm command="draft" ids={{ enquiryId: id }} label="Draft internal quote" />}
        </>}
      </section>
    </div>
    <History events={audit} />
  </Shell>;
}
