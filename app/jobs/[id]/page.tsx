import Link from "next/link";
import { ArrowLeft, Check, Circle, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { billingState, can, currentStage, openExceptions, stageDeadline, WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { CommandForm } from "../../forms";
import { TourHint } from "../../tour/hint";
import { AccessDenied, Badge, Details, History, Shell, ShortId, time } from "../../ui";

const tabs = ["work", "exceptions", "documents", "billing", "history"] as const;

export default async function JobPage({ params, searchParams }: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
}) {
  const [actor, { id }, query] = await Promise.all([requireActor(), params, searchParams]);
  const tab = tabs.find((item) => item === query.tab) ?? "work";
  if (!z.uuid().safeParse(id).success) notFound();
  const base = `/jobs/${id}`;
  const path = tab === "work" ? base : `${base}?tab=${tab}`;
  const view = await services().workflow.view(actor).catch((error: unknown) => {
    if (error instanceof WorkflowError && error.code === "forbidden") return undefined;
    throw error;
  });
  if (!view) return <Shell actor={actor} path={path}><AccessDenied /></Shell>;
  const { settings, records } = view;
  const job = await records.get("jobs", id);
  if (!job) notFound();
  const [audit, people] = await Promise.all([tab === "history" ? records.auditFor([id, job.enquiryId, job.quoteId]) : [], records.actors()]);
  const names = new Map(people.map((person) => [person.id, person.name]));
  const assignees = people.filter((person) => can(settings, person, "exception.manage"));
  const stage = currentStage(job);
  const deadline = stageDeadline(job);
  const billing = billingState(job);
  const openIssues = openExceptions(job);
  const assignedIssue = openIssues.find((issue) => issue.ownerId === actor.id);
  const overdue = deadline && deadline.getTime() < Date.now();
  const canManageExceptions = !job.closedAt && can(settings, actor, "exception.manage");
  const canUpdate = !job.closedAt && can(settings, actor, "job.advance");
  const canClose = billing === "billing_ready" && can(settings, actor, "billing.close");
  const nextAction = job.closedAt ? "Job closed"
    : billing === "billing_ready" ? "Accounts to review and close"
      : assignedIssue ? assignedIssue.recovery
        : stage ? `Complete milestone: ${stage.label}` : "Resolve open exceptions";
  return <Shell actor={actor} path={path}>
    <header className="space-y-4">
      <Link href="/jobs" className="inline-flex items-center gap-2 text-sm font-semibold text-wine"><ArrowLeft size={15} /> Back to Jobs</Link>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted"><ShortId prefix="JOB" id={id} /> · Sea Import Customs</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight">{job.data.customer || "Shipment job"}</h1>
          <p className="quiet mt-1">{names.get(job.ownerId) ?? "Unassigned"} · {job.data.arrivalPort || "Port pending"}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} />
          {job.operationalStatus && <Badge text={job.operationalStatus.label} />}
          {openIssues.length > 0 && <Link href={`${base}?tab=exceptions`}><Badge text={`${openIssues.length} open exception${openIssues.length === 1 ? "" : "s"}`} tone="warn" /></Link>}
        </div>
      </div>
      <nav aria-label="Job detail sections" className="flex flex-wrap gap-1 border-b border-line">
        {tabs.map((item) => <Link key={item} href={item === "work" ? base : `${base}?tab=${item}`}
          aria-current={item === tab ? "page" : undefined}
          className={`border-b-2 px-3 py-2.5 text-sm font-semibold capitalize ${item === tab ? "border-wine text-wine" : "border-transparent text-muted hover:text-ink"}`}>
          {item}{item === "exceptions" && openIssues.length > 0 ? ` (${openIssues.length})` : ""}
        </Link>)}
      </nav>
    </header>
    <TourHint title={billing === "closed" ? "Review the completed job" : billing === "billing_ready" ? "Send the job to Accounts for closure" : "Work through the job"}>
      {billing === "closed" ? "Find the milestone, exception and closure events on the History tab."
        : billing === "billing_ready" ? (actor.role === "accounts" ? "Open Billing and select Close job."
          : "Use Switch profile to continue as Accounts and close the job.")
          : actor.role !== "operations" ? "Use Switch profile to continue as Operations and work on the job."
            : openIssues.length ? "Complete the remaining milestones and record the recovery in Exceptions. Billing stays blocked until the open exception is resolved."
              : "Complete the current milestone. While work is active, use Raise exception in Exceptions to test assigning a customs issue and recording its recovery."}
    </TourHint>
    {tab === "work" && <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
      <div className="space-y-5">
        <section id="job-actions" className="panel pad space-y-3">
          <h2 className="text-xs font-semibold text-wine">{job.closedAt ? "Outcome" : "Next action"}</h2>
          <p className="text-lg font-semibold">{nextAction}</p>
          {deadline && <div className="flex flex-wrap items-center gap-2">
            <Badge text={overdue ? "Overdue" : "On track"} tone={overdue ? "danger" : "good"} />
            <p className="quiet">SLA deadline · {time(deadline)} IST</p>
          </div>}
          {openIssues.length > 0 && <p className="quiet"><Link className="font-semibold text-wine" href={`${base}?tab=exceptions`}>Review open exceptions</Link> · Billing is blocked until resolved.</p>}
          {canUpdate && stage && <CommandForm key={stage.id} command="advance" ids={{ jobId: id, stageId: stage.id }} label="Complete current milestone" secondary={Boolean(assignedIssue)} />}
          {billing === "billing_ready" && <Link href={`${base}?tab=billing`} className={canClose ? "button primary" : "button"}>Review billing</Link>}
          {canUpdate && <details className="mt-4 border-t border-line pt-3">
            <summary className="text-sm font-semibold text-wine">Change operational status</summary>
            <CommandForm command="set-job-status" ids={{ jobId: id }} label="Save job status" secondary className="mt-3 flex flex-wrap items-end gap-2">
              <label className="block min-w-40 flex-1"><span className="label">Job status</span>
                <select className="field" name="jobStatusId" defaultValue={job.operationalStatus?.id ?? ""}>
                  <option value="">No custom status</option>
                  {settings.jobStatuses.map((status) => <option key={status.id} value={status.id}>{status.label}</option>)}
                  {job.operationalStatus && !settings.jobStatuses.some((status) => status.id === job.operationalStatus?.id) &&
                    <option value={job.operationalStatus.id}>{job.operationalStatus.label} (retired)</option>}
                </select>
              </label>
              {settings.jobStatuses.length === 0 && <p className="quiet w-full">An Admin can add statuses in Configuration.</p>}
            </CommandForm>
          </details>}
        </section>
        <section id="milestones" className="panel pad space-y-4">
          <h2 className="font-semibold">Operational milestones <span className="ml-1 text-xs font-normal text-muted">Workflow v{job.configVersion}</span></h2>
          <ol className="space-y-3">{job.milestones.map((step) => <li key={step.id} className="flex items-center gap-3 text-sm">
            <span className={`grid size-7 shrink-0 place-items-center rounded-full ${step.completedAt ? "bg-emerald-50 text-emerald-800" : "bg-stone-100 text-muted"}`}>
              {step.completedAt ? <Check size={15} /> : <Circle size={12} />}
            </span><span className="font-medium">{step.label}</span>
            {step.completedAt ? <span className="ml-auto text-xs text-muted">{time(step.completedAt)} IST</span>
              : stage?.id === step.id ? <Badge text="Current" tone="warn" /> : null}
          </li>)}</ol>
        </section>
      </div>
      <section className="panel pad space-y-4">
        <h2 className="font-semibold">Shipment details</h2>
        <Details entries={{ "Bill of lading": job.data.billOfLading, ETA: job.data.eta, Consignee: job.data.consignee }} />
        <Link href={`/enquiries/${job.enquiryId}`} className="inline-block text-sm font-semibold text-wine">View enquiry and approved quote</Link>
      </section>
    </div>}
    {tab === "exceptions" &&
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
        </section>}
    {tab === "documents" && <section className="panel pad">
      <h2 className="font-semibold">Documents</h2>
      <div className="mt-3 flex items-center gap-2 text-sm"><FileText size={17} className="text-muted" /> Bill of lading <Badge text="Placeholder" /></div>
    </section>}
    {tab === "billing" && <section id="billing" className="panel pad space-y-3">
      <div className="flex justify-between gap-2"><h2 className="font-semibold">Billing</h2><Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} /></div>
      {job.closedAt ? <p className="quiet">Closed {time(job.closedAt)} IST.</p>
        : billing === "active" ? <p className="quiet">Finish all milestones and resolve open exceptions to make this job billing-ready.</p>
          : canClose ? <CommandForm command="close" ids={{ jobId: id }} label="Close job">
            <p className="quiet">Required milestones are complete and no exceptions are open.</p>
          </CommandForm> : <p className="quiet">Ready for Accounts to close.</p>}
    </section>}
    {tab === "history" && <History events={audit} />}
  </Shell>;
}
