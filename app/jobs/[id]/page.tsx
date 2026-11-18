import Link from "next/link";
import { Check, Circle, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { billingState, can, currentStage, stageDeadline, WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { CommandForm } from "../../forms";
import { TourHint } from "../../tour/hint";
import { AccessDenied, Badge, Details, Heading, History, Shell, time } from "../../ui";

export default async function JobPage({ params }: { params: Promise<{ id: string }> }) {
  const [actor, { id }] = await Promise.all([requireActor(), params]);
  if (!z.uuid().safeParse(id).success) notFound();
  const path = `/jobs/${id}`;
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;
  const { settings, records } = view;
  const job = await records.get("jobs", id);
  if (!job) notFound();
  const [audit, people] = await Promise.all([records.auditFor([id, job.enquiryId, job.quoteId]), records.actors()]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const assignees = people.filter((person) => can(settings, person, "exception.manage"));
  const stage = currentStage(job);
  const deadline = stageDeadline(job);
  const billing = billingState(job);
  const openIssues = job.exceptions.filter((issue) => issue.status === "open");
  const canManageExceptions = !job.closedAt && can(settings, actor, "exception.manage");
  return <Shell actor={actor} path={path}>
    <Heading title={`JOB-${id.slice(0, 8).toUpperCase()}`} text={`${job.data.customer || "Job"} · Sea Import Customs`} back="jobs" />
    <TourHint title={billing === "closed" ? "Review the completed job" : billing === "billing_ready" ? "Send the job to Accounts for closure" : "Work through the job"}>
      {billing === "closed" ? "Find the milestone, exception and closure events in Audit history below."
        : billing === "billing_ready" ? (actor.role === "accounts" ? "Review Billing and select Close job."
          : "Switch to Accounts in the header to close the job on this page.")
          : actor.role !== "operations" ? "Switch to Operations in the header to work on the milestones and exceptions."
            : openIssues.length ? "Complete the remaining milestones and record the recovery in Exceptions. Billing stays blocked until the open exception is resolved."
              : "Complete the current milestone. While work is active, use Raise exception to test assigning a customs issue and recording its recovery."}
    </TourHint>
    <div className="grid items-start gap-5 lg:grid-cols-[1.2fr_1fr]">
      <div className="space-y-5">
        <section className="panel pad space-y-4">
          <div className="flex justify-between gap-2"><h2 className="font-semibold">Job overview</h2><Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} /></div>
          <Details entries={{ Owner: names.get(job.ownerId), "Arrival port": job.data.arrivalPort, "Bill of lading": job.data.billOfLading,
            ETA: job.data.eta, "Current stage": stage?.label ?? "Complete", "SLA deadline": deadline ? `${time(deadline)} IST` : undefined,
            "Job status": job.operationalStatus?.label ?? "No custom status",
            "Next action": job.closedAt ? "Job closed" : openIssues[0]?.recovery ?? (stage ? `Complete: ${stage.label}` : "Accounts to close job"),
            "Source enquiry": <Link href={`/enquiries/${job.enquiryId}`} className="text-wine">View enquiry and quote</Link> }} />
        </section>
        {!job.closedAt && can(settings, actor, "job.advance") && <section className="panel pad space-y-3">
          <h2 className="font-semibold">Update job status</h2>
          <p className="quiet">Use a custom status to tell the team what’s happening with the job. Complete milestones separately below.</p>
          <CommandForm command="set-job-status" ids={{ jobId: id }} label="Save job status">
            <label className="block max-w-sm"><span className="label">Job status</span>
              <select className="field" name="jobStatusId" defaultValue={job.operationalStatus?.id ?? ""}>
                <option value="">No custom status</option>
                {settings.jobStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                {job.operationalStatus && !settings.jobStatuses.some((status) => status.id === job.operationalStatus?.id) &&
                  <option value={job.operationalStatus.id}>{job.operationalStatus.label} (retired)</option>}
              </select>
            </label>
            {settings.jobStatuses.length === 0 && <p className="quiet">An Admin can add statuses in Configuration.</p>}
          </CommandForm>
        </section>}
        <section id="milestones" className="panel pad space-y-4">
          <h2 className="font-semibold">Operational milestones <span className="ml-1 text-xs font-normal text-muted">Workflow v{job.configVersion}</span></h2>
          <ol className="space-y-3">{job.milestones.map((step) => <li key={step.id} className="flex items-center gap-3 text-sm">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${step.completedAt ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-muted"}`}>
              {step.completedAt ? <Check size={15} /> : <Circle size={12} />}
            </span><span className="font-medium">{step.label}</span>
            {step.completedAt ? <span className="ml-auto text-xs text-muted">{time(step.completedAt)} IST</span>
              : stage?.id === step.id ? <Badge text="Current" tone="warn" /> : null}
          </li>)}</ol>
          {stage && !job.closedAt && can(settings, actor, "job.advance") && <CommandForm key={stage.id}
            command="advance" ids={{ jobId: id, stageId: stage.id }} label="Complete current milestone" />}
        </section>
        <section className="panel pad">
          <h2 className="font-semibold">Documents</h2>
          <div className="mt-3 flex items-center gap-2 text-sm"><FileText size={17} className="text-muted" /> Bill of lading <Badge text="Placeholder" /></div>
        </section>
      </div>
      <div className="space-y-5">
        <section id="exceptions" className="panel pad space-y-4">
          <h2 className="font-semibold">Exceptions</h2>
          {job.exceptions.length === 0 && <p className="quiet">No exceptions raised.</p>}
          {job.exceptions.map((issue) => <div key={issue.id} className="rounded-lg border border-line bg-canvas p-3 space-y-3">
            <div className="flex items-start justify-between gap-2"><p className="text-sm font-semibold">{issue.description}</p>
              <Badge text={settings.labels[issue.status]} tone={issue.status === "open" ? "warn" : "good"} /></div>
            <Details entries={{ Owner: names.get(issue.ownerId), "Recovery action": issue.recovery,
              Resolution: issue.resolution, Raised: `${time(issue.openedAt)} IST` }} />
            {issue.status === "open" && canManageExceptions && <CommandForm command="resolve" ids={{ jobId: id, exceptionId: issue.id }} label="Resolve exception">
              <label><span className="label">Resolution note</span><input className="field" name="resolution" required maxLength={500} /></label>
            </CommandForm>}
          </div>)}
          {canManageExceptions && stage && <details className="border-t border-line pt-3">
            <summary className="text-sm font-semibold text-wine">Raise exception</summary>
            <CommandForm command="raise" ids={{ jobId: id }} label="Raise and assign" className="mt-3 space-y-3">
              <label className="block"><span className="label">Issue</span><input className="field" name="description" required maxLength={160} /></label>
              <label className="block"><span className="label">Exception owner</span><select name="ownerId" className="field" defaultValue={actor.id}>
                {assignees.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}
              </select></label>
              <label className="block"><span className="label">Recovery action</span><input className="field" name="recovery" required maxLength={500} /></label>
            </CommandForm>
          </details>}
        </section>
        <section id="billing" className="panel pad space-y-3">
          <div className="flex justify-between gap-2"><h2 className="font-semibold">Billing</h2><Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} /></div>
          {job.closedAt ? <p className="quiet">Closed {time(job.closedAt)} IST.</p>
            : billing === "active" ? <p className="quiet">Finish all milestones and resolve open exceptions to make this job billing-ready.</p>
              : can(settings, actor, "billing.close") ? <CommandForm command="close" ids={{ jobId: id }} label="Close job" />
                : <p className="quiet">Ready for Accounts to close.</p>}
        </section>
      </div>
    </div>
    <History events={audit} />
  </Shell>;
}
