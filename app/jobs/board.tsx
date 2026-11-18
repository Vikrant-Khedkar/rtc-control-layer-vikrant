import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import type { ReactNode } from "react";
import { can, currentStage, jobActionFor, jobLane, openExceptions, type Actor, type Enquiry, type Job, type Quote, type Settings } from "../../src/core/model";
import { enquiryHandoff, jobHandoff, WaitingOn } from "../handoff";
import { Badge, ShortId } from "../ui";
import { jobSectionPath } from "./sections";

const lanes = [
  { key: "enquiry", label: "Enquiry review", marker: "bg-violet-600" },
  { key: "approval", label: "Awaiting Manager", marker: "bg-indigo-600" },
  { key: "new", label: "Ready to start", marker: "bg-wine" },
  { key: "working", label: "In progress", marker: "bg-sky-600" },
  { key: "attention", label: "Needs attention", marker: "bg-amber-600" },
  { key: "ready", label: "Billing ready", marker: "bg-emerald-600" },
  { key: "closed", label: "Closed", marker: "bg-stone-400" },
] as const;

function BoardCard({ href, label, reference, customer, needsYou, children }: {
  href: string; label: string; reference: ReactNode; customer: string; needsYou: boolean; children: ReactNode;
}) {
  return <article>
    <Link href={href} aria-label={label}
      className="panel group block space-y-2.5 p-3 hover:border-wine/40 hover:bg-rosewash/30 motion-safe:transition-colors motion-safe:duration-150">
      <div className="flex flex-wrap items-center justify-between gap-1">
        <span className="text-muted">{reference}</span>
        {needsYou && <Badge text="Needs you" tone="danger" />}
      </div>
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 text-sm font-semibold break-words">{customer}</h3>
        <ArrowUpRight size={16} aria-hidden className="mt-0.5 shrink-0 text-wine motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
      </div>
      {children}
    </Link>
  </article>;
}

export function JobBoard({ jobs, enquiries, quoteFor, people, settings, actor, queue }: {
  jobs: Job[]; enquiries: Enquiry[]; quoteFor: Map<string, Quote>; people: Actor[]; settings: Settings; actor: Actor; queue: boolean;
}) {
  const cards: Record<(typeof lanes)[number]["key"], ReactNode[]> = {
    enquiry: [], approval: [], new: [], working: [], attention: [], ready: [], closed: [],
  };

  for (const enquiry of enquiries) {
    const quote = quoteFor.get(enquiry.id);
    const missing = enquiry.issues.length > 0;
    const needsYou = quote ? can(settings, actor, "quote.approve")
      : enquiry.ownerId === actor.id && can(settings, actor, missing ? "intake.write" : "quote.draft");
    if (queue && !needsYou) continue;
    const customer = enquiry.data.customer || "Enquiry";
    const handoff = enquiryHandoff(enquiry, quote, people);
    const href = `/jobs?${queue ? "view=queue&" : ""}enquiry=${enquiry.id}#selected-enquiry`;
    cards[quote ? "approval" : "enquiry"].push(
      <BoardCard key={enquiry.id} href={href} label={`${quote ? "Review quote" : "Review enquiry"} for ${customer}`}
        reference={<ShortId prefix="ENQ" id={enquiry.id} />} customer={customer} needsYou={needsYou}>
        {!quote && <Badge text={settings.labels[missing ? "needs_review" : "ready"]} tone={missing ? "warn" : "neutral"} />}
        {missing && !quote && <p className="text-xs text-amber-900">{enquiry.issues[0]}</p>}
        {handoff && <p><WaitingOn handoff={handoff} /></p>}
      </BoardCard>,
    );
  }

  for (const job of jobs) {
    const action = jobActionFor(job, settings, actor);
    if (queue && !action) continue;
    const stage = currentStage(job);
    const issue = openExceptions(job)[0];
    const handoff = jobHandoff(job, people);
    const customer = job.data.customer || "Sea Import job";
    cards[jobLane(job)].push(
      <BoardCard key={job.id} href={`/jobs/${job.id}${action ? jobSectionPath(action.section) : ""}`}
        label={`${action?.label ?? "View job"} for ${customer}`} reference={<ShortId prefix="JOB" id={job.id} />}
        customer={customer} needsYou={Boolean(action)}>
        <dl className="space-y-1 text-xs">
          <div><dt className="sr-only">Current milestone</dt><dd>{stage ? `Next: ${stage.label}` : "Milestones complete"}</dd></div>
          {issue && <div><dt className="sr-only">Open exception</dt><dd className="text-amber-900">{issue.description}</dd></div>}
          {handoff && <div><dt className="sr-only">Waiting on</dt><dd><WaitingOn handoff={handoff} /></dd></div>}
        </dl>
        {job.operationalStatus && <p className="w-fit max-w-full rounded-lg bg-stone-100 px-2.5 py-1 text-xs font-semibold break-words text-stone-700">
          {job.operationalStatus.label}
        </p>}
      </BoardCard>,
    );
  }

  const visible = queue ? lanes.filter((lane) => cards[lane.key].length > 0) : lanes;
  if (!visible.length) return <p className="panel pad quiet">Nothing needs your action right now.</p>;
  return <section aria-label="Job board" className="overflow-x-auto overscroll-x-contain pb-2">
    <div className={`grid grid-flow-col gap-3 ${queue ? "auto-cols-[14rem]" : "auto-cols-[minmax(12rem,1fr)]"}`}>
      {visible.map((lane) => {
        const entries = cards[lane.key];
        const label = lane.key === "ready" ? settings.labels.billing_ready : lane.key === "closed" ? settings.labels.closed : lane.label;
        return <section className="min-w-0 rounded-xl border border-line bg-stone-100/70 p-2.5" key={lane.key} aria-labelledby={`lane-${lane.key}`}>
          <div className="flex items-center gap-2 px-1 py-2">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${lane.marker}`} />
            <h2 className="text-sm font-semibold" id={`lane-${lane.key}`}>{label}</h2>
            <span className="ml-auto text-xs tabular-nums text-muted">{entries.length}</span>
          </div>
          <div className="space-y-2.5">
            {entries}
            {!entries.length && <p className="px-1 py-4 text-xs text-muted">No items</p>}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
