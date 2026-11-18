import { randomUUID } from "node:crypto";
import Link from "next/link";
import { Check, CircleCheckBig } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { billingState, can, openExceptions, WorkflowError } from "../../src/core/model";
import { services } from "../../src/server/services";
import { requireActor } from "../../src/server/session";
import { CommandForm, RoleForm } from "../forms";
import { AccessDenied, Badge, Details, Heading, History, money, Shell, ShortId } from "../ui";
import { nextTourAction, phases } from "./steps";

export const metadata = { title: "Guided tour" };

export default async function TourPage({ searchParams }: { searchParams: Promise<{ enquiry?: string | string[] }> }) {
  const [actor, { enquiry: id }] = await Promise.all([requireActor(), searchParams]);
  if (id !== undefined && !z.uuid().safeParse(id).success) notFound();
  const enquiryId = typeof id === "string" ? id : undefined;
  const path = enquiryId ? `/tour?enquiry=${enquiryId}` : "/tour";

  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;
  const { settings, records } = view;
  const [enquiry, quote] = enquiryId
    ? await Promise.all([records.get("enquiries", enquiryId), records.quoteByEnquiry(enquiryId)])
    : [undefined, undefined];
  if (enquiryId && (!enquiry || !enquiry.sourceRef.startsWith("TOUR-"))) notFound();
  const job = quote ? await records.jobByQuote(quote.id) : undefined;
  const step = nextTourAction(enquiry, quote, job, actor.id);
  const phase = step?.phase ?? phases.length;
  const events = job?.closedAt ? await records.auditFor([job.enquiryId, job.quoteId, job.id]) : [];

  return <Shell actor={actor} path={path}>
    <Heading title="Guided tour" text="Follow one Sea Import Customs case from intake to closure. Each action saves a synthetic record to the workspace." />
    <ol aria-label="Tour progress" className="panel grid gap-3 p-4 sm:grid-cols-3 lg:grid-cols-6">
      {phases.map((label, index) => <li key={label} aria-current={phase === index ? "step" : undefined}
        className={`flex items-center gap-2 text-sm ${phase === index ? "font-semibold text-wine" : "text-muted"}`}>
        <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-full ${phase === index ? "bg-rosewash" : "bg-canvas"}`}>
          {index < phase ? <Check size={15} className="text-emerald-700" /> : index + 1}
        </span>{label}
      </li>)}
    </ol>

    <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
      <section className="panel pad space-y-4">
        {step ? <>
          <Badge text={step.role[0].toUpperCase() + step.role.slice(1)} />
          <h2 className="text-xl font-semibold">{step.title}</h2>
          <p className="quiet">{step.description}</p>
          {actor.role !== step.role ? <RoleForm key={step.role} role={actor.role} targetRole={step.role} returnTo={path} />
            : can(settings, actor, step.permission) ? <CommandForm
              key={`${step.command}-${step.fields?.stageId ?? step.fields?.exceptionId ?? ""}`}
              command={step.command} label={step.label}
              ids={{ guided: "1", ...step.fields, ...(!enquiry ? { sourceRef: `TOUR-${randomUUID()}` } : {}) }} />
              : <p role="status" className="text-sm text-wine">This role’s permission for the step is disabled in Admin Configuration.</p>}
        </> : <>
          <h2 className="flex items-center gap-2 text-xl font-semibold"><CircleCheckBig className="text-emerald-700" size={22} /> Tour complete</h2>
          <p className="quiet">The job is closed. Review the audit trail below to see which role performed each action.</p>
          <div className="flex flex-wrap items-center gap-2">
            <Link href="/tour" className="button">Run another tour</Link>
            {actor.role === "admin" ? <Link href="/config" className="button primary">Open Configuration</Link>
              : <RoleForm role={actor.role} targetRole="admin" returnTo={path} />}
          </div>
        </>}
      </section>

      <section className="panel pad space-y-4">
        <h2 className="font-semibold">Tour records</h2>
        {enquiry ? <>
          <Details entries={{
            Enquiry: <Link className="text-wine" href={`/enquiries/${enquiry.id}`}>{enquiry.sourceRef}</Link>,
            "Enquiry status": settings.labels[enquiry.issues.length ? "needs_review" : "ready"],
            Quote: quote ? money(quote.priceCents, quote.currency) : undefined,
            "Quote status": quote ? settings.labels[quote.approvedAt ? "approved" : "draft"] : undefined,
            Job: job ? <Link className="text-wine" href={`/jobs/${job.id}`}><ShortId prefix="JOB" id={job.id} /></Link> : undefined,
            Billing: job ? settings.labels[billingState(job)] : undefined,
          }} />
          {enquiry.issues.length > 0 && <ul className="list-disc space-y-1 rounded-lg bg-amber-50 px-8 py-3 text-sm text-amber-900">
            {enquiry.issues.map((issue) => <li key={issue}>{issue}</li>)}
          </ul>}
          {job && openExceptions(job).length > 0 && <p className="text-sm font-medium text-amber-900">Open exception · Billing blocked</p>}
        </> : <p className="quiet">The enquiry, quote and job will appear here as you create them.</p>}
      </section>
    </div>
    {events.length > 0 && <History events={events} />}
  </Shell>;
}
