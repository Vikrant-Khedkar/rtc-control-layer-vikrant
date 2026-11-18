import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { enquiryHandoff, jobHandoff, WaitingOn } from "../../handoff";
import { TourHint } from "../../tour/hint";
import { AccessDenied, History, Shell } from "../../ui";
import { EnquiryPanels } from "../panels";

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
  const handoff = job ? jobHandoff(job, people) : enquiryHandoff(enquiry, quote, people);
  return <Shell actor={actor} path={path}>
    <header className="panel pad space-y-3">
      <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
        <Link href="/enquiries" className="font-semibold text-wine">Enquiry inbox</Link>
        <ChevronRight size={13} aria-hidden /><span aria-current="page" className="break-all">{enquiry.sourceRef}</span>
      </nav>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{enquiry.data.customer || "Enquiry"}</h1>
          <p className="quiet mt-1">Sea Import Customs</p></div>
        {handoff && <div className="rounded-lg bg-canvas px-3 py-2"><WaitingOn handoff={handoff} /></div>}
      </div>
    </header>
    <TourHint title={job ? "Open the approved job" : quote ? "Review the internal quote" : "Review the enquiry details"}>
      {job ? "Open the job to see its milestones, exceptions and billing status."
        : quote ? (actor.role === "manager" ? "Check the mock rate, margin and quote total, then approve the draft."
          : "Use Switch profile in the header to continue as Manager and approve this draft.")
          : enquiry.issues.length ? "Operations can use Edit details to correct verified information. Leave the enquiry in Needs Review if the information is still missing."
            : "Check the enquiry fields below. If they’re complete, use Draft internal quote."}
    </TourHint>
    <EnquiryPanels enquiry={enquiry} quote={quote} job={job} actor={actor} settings={settings} people={people} />
    <History events={audit} />
  </Shell>;
}
