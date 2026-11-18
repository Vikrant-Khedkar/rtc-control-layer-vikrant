import Link from "next/link";
import { Check, ChevronDown, ChevronRight, FileText } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";
import { billingState, can, currentStage, openExceptions, stageDeadline, WorkflowError } from "../../../src/core/model";
import { services } from "../../../src/server/services";
import { requireActor } from "../../../src/server/session";
import { CommandForm } from "../../forms";
import { jobHandoff, WaitingOn } from "../../handoff";
import { AccessDenied, Badge, Details, History, Shell, ShortId, time } from "../../ui";
import { MilestoneTimeline } from "./milestone-timeline";

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
  const overdue = deadline && deadline.getTime() < Date.now();
  const canManageExceptions = !job.closedAt && can(settings, actor, "exception.manage");
  const canUpdate = !job.closedAt && can(settings, actor, "job.advance");
  const canClose = billing === "billing_ready" && can(settings, actor, "billing.close");
  const assignedIssue = canManageExceptions ? openIssues.find((issue) => issue.ownerId === actor.id) : undefined;
  const completed = job.milestones.filter((step) => step.completedAt).length;
  const handoff = jobHandoff(job, people);
  const statusLabel = job.operationalStatus?.label ?? "No custom status";
  return <Shell actor={actor} path={path}>
    <header className="panel">
      <div className="pad space-y-3">
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
          <Link href="/jobs" className="font-semibold text-wine">Jobs</Link>
          <ChevronRight size={13} aria-hidden /><span aria-current="page"><ShortId prefix="JOB" id={id} /></span>
        </nav>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">{job.data.customer || "Shipment job"}</h1>
            <p className="quiet mt-1">Sea Import Customs · {job.data.arrivalPort || "Port pending"}</p>
          </div>
          <div className="flex flex-col items-start gap-2 sm:items-end">
            <div className="flex flex-wrap gap-2">
              <Badge text={settings.labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} />
              {tab !== "work" && job.operationalStatus && <Badge text={statusLabel} />}
            </div>
            {handoff && <WaitingOn handoff={handoff} />}
          </div>
        </div>
      </div>
      <nav aria-label="Job detail sections" className="flex gap-1 overflow-x-auto border-t border-line px-3 sm:px-5">
        {tabs.map((item) => <Link key={item} href={item === "work" ? base : `${base}?tab=${item}`}
          aria-current={item === tab ? "page" : undefined}
          className={`flex min-h-11 shrink-0 items-center border-b-2 px-3 text-sm font-semibold capitalize whitespace-nowrap focus-visible:-outline-offset-2 ${item === tab ? "border-wine text-wine" : "border-transparent text-muted hover:text-ink"}`}>
          {item}{item === "exceptions" && openIssues.length > 0 ? ` (${openIssues.length})` : ""}
        </Link>)}
      </nav>
    </header>
    {tab === "work" && <div className="grid items-start gap-5 lg:grid-cols-[1.4fr_1fr]">
      <section id="job-actions" className="panel" aria-labelledby="milestones">
        <div className="pad">
          <MilestoneTimeline completed={completed} total={job.milestones.length}>
            {job.milestones.map((step, index) => {
              const isCurrent = step.id === stage?.id;
              return <li key={step.id} aria-current={isCurrent ? "step" : undefined}
                className={`group grid grid-cols-[1.75rem_minmax(0,1fr)] gap-3 rounded-lg px-3 py-2.5 ${isCurrent ? "bg-rosewash/45 ring-1 ring-inset ring-wine/15" : ""}`}>
                <div className="relative flex justify-center">
                  <span aria-hidden className={`relative z-10 grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold ${step.completedAt
                    ? "bg-emerald-50 text-emerald-800"
                    : isCurrent ? "bg-wine text-white" : "border border-line bg-white text-muted"}`}>
                    {step.completedAt ? <Check size={15} /> : index + 1}
                  </span>
                  <span aria-hidden className="absolute top-7 -bottom-6 w-px bg-line group-last:hidden" />
                </div>
                <div className="flex min-w-0 flex-col items-start justify-between gap-2.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <h3 tabIndex={isCurrent ? -1 : undefined} className={`text-sm font-semibold break-words ${isCurrent || step.completedAt ? "text-ink" : "text-muted"}`}>{step.label}</h3>
                      {isCurrent && <span className="text-xs font-semibold text-wine">Current</span>}
                    </div>
                    {step.completedAt ? <p className="text-xs text-muted">
                      Completed · <time dateTime={step.completedAt}>{time(step.completedAt)} IST</time>
                    </p> : isCurrent && deadline ? <div className="flex flex-wrap items-center gap-1.5">
                      <Badge text={overdue ? "Overdue" : "On track"} tone={overdue ? "danger" : "good"} />
                      <time dateTime={deadline.toISOString()} className="text-xs text-muted">Due {time(deadline)} IST</time>
                    </div> : <p className="text-xs text-muted">Upcoming</p>}
                  </div>
                  {isCurrent && canUpdate && <CommandForm command="advance" ids={{ jobId: id, stageId: step.id }}
                    label="Mark complete" secondary={Boolean(assignedIssue)} className="space-y-2 sm:shrink-0" />}
                </div>
              </li>;
            })}
          </MilestoneTimeline>
          {openIssues.length > 0 && <div className="mt-4 rounded-lg bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
            <Link className="font-semibold underline underline-offset-2" href={`${base}?tab=exceptions`}>Review open exceptions</Link>
            <p className="mt-1 text-xs">{assignedIssue?.recovery ?? "Resolve open exceptions before billing."}</p>
          </div>}
          {billing === "billing_ready" && <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <p className="quiet">Ready for Accounts to close.</p>
            <Link href={`${base}?tab=billing`} className={canClose ? "button primary" : "button"}>Review billing</Link>
          </div>}
          {job.closedAt && <p className="quiet mt-4">Job closed {time(job.closedAt)} IST.</p>}
        </div>
        {canUpdate ? <details className="group border-t border-line px-5 py-3 sm:px-6">
          <summary className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-sm text-sm [&::-webkit-details-marker]:hidden">
            <span className="min-w-0 break-words"><span className="font-semibold">Operational status</span> <span className="text-muted">· {statusLabel}</span></span>
            <span className="flex items-center gap-1 font-semibold text-wine">Edit status <ChevronDown size={15} aria-hidden className="group-open:rotate-180" /></span>
          </summary>
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
        </details> : job.operationalStatus && <p className="quiet border-t border-line px-5 py-3 sm:px-6">Operational status · {statusLabel}</p>}
      </section>
      <section className="panel pad space-y-4">
        <h2 className="font-semibold">Shipment details</h2>
        <Details entries={{ "Job owner": names.get(job.ownerId) ?? "Unassigned", "Bill of lading": job.data.billOfLading, ETA: job.data.eta, Consignee: job.data.consignee }} />
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
