import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { can, intakeFields, intakeLabels, WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { CommandForm, IntakeForm } from "../../forms";
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
  const [audit, job] = await Promise.all([records.auditFor(quote ? [id, quote.id] : [id]), quote ? records.jobByQuote(quote.id) : undefined]);
  const status = enquiry.issues.length ? "needs_review" : "ready";
  return <Shell actor={actor} path={path}>
    <Heading title={enquiry.sourceRef} text={`${enquiry.data.customer || "Enquiry"} · Sea Import Customs`} back />
    <div className="grid items-start gap-5 lg:grid-cols-2">
      <section className="panel pad space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">Enquiry details</h2>
          <Badge text={settings.labels[quote ? (quote.approvedAt ? "approved" : "draft") : status]} tone={!quote && enquiry.issues.length ? "warn" : "neutral"} /></div>
        {enquiry.issues.length > 0 && <ul className="list-disc space-y-1 rounded-lg bg-amber-50 px-8 py-3 text-sm text-amber-900">
          {enquiry.issues.map((issue) => <li key={issue}>{issue}</li>)}
        </ul>}
        {!quote && can(settings, actor, "intake.write")
          ? <IntakeForm reference={enquiry.sourceRef} required={settings.required} existing={enquiry} />
          : <Details entries={Object.fromEntries(intakeFields.map((field) => [intakeLabels[field], enquiry.data[field]]))} />}
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
          {can(settings, actor, "quote.draft") && <CommandForm command="draft" ids={{ enquiryId: id }} label="Draft internal quote" />}
        </>}
      </section>
    </div>
    <History events={audit} />
  </Shell>;
}
