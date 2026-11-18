import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { currentStage, jobActionFor, jobLane, openExceptions, type Actor, type Job, type Settings } from "../../src/core/model";
import { Badge, ShortId } from "../ui";

const lanes = [
  { key: "new", label: "Newly approved", marker: "bg-wine" },
  { key: "working", label: "In progress", marker: "bg-sky-600" },
  { key: "attention", label: "Needs attention", marker: "bg-amber-600" },
  { key: "ready", label: "Billing ready", marker: "bg-emerald-600" },
  { key: "closed", label: "Closed", marker: "bg-stone-400" },
] as const;

export function JobBoard({ jobs, users, settings, actor }: { jobs: Job[]; users: Map<string, string>; settings: Settings; actor: Actor }) {
  const byLane = new Map<string, Job[]>();
  for (const job of jobs) {
    const key = jobLane(job);
    const lane = byLane.get(key);
    if (lane) lane.push(job);
    else byLane.set(key, [job]);
  }
  return <section aria-label="Job board" className="overflow-x-auto pb-2">
    <div className="grid min-w-[1080px] grid-cols-5 gap-3">
      {lanes.map((lane) => {
        const entries = byLane.get(lane.key) ?? [];
        const label = lane.key === "ready" ? settings.labels.billing_ready : lane.key === "closed" ? settings.labels.closed : lane.label;
        return <section className="min-w-0 rounded-xl border border-line bg-stone-100/70 p-2.5" key={lane.key} aria-labelledby={`lane-${lane.key}`}>
          <div className="flex items-center gap-2 px-1 py-2">
            <span aria-hidden className={`size-2 shrink-0 rounded-full ${lane.marker}`} />
            <h2 className="text-sm font-semibold" id={`lane-${lane.key}`}>{label}</h2>
            <span className="ml-auto text-xs tabular-nums text-muted">{entries.length}</span>
          </div>
          <div className="space-y-2.5">
            {entries.map((job) => {
              const action = jobActionFor(job, settings, actor);
              const stage = currentStage(job);
              const issue = openExceptions(job)[0];
              const customer = job.data.customer || "Sea Import job";
              return <article key={job.id} className="panel space-y-2.5 p-3">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  <span className="text-muted"><ShortId prefix="JOB" id={job.id} /></span>
                  {action && <Badge text="Needs you" tone="danger" />}
                </div>
                <h3 className="text-sm font-semibold">{customer}</h3>
                <dl className="space-y-1 text-xs">
                  <div><dt className="sr-only">Current milestone</dt><dd>{stage ? `Next: ${stage.label}` : "Milestones complete"}</dd></div>
                  {issue && <div><dt className="sr-only">Open exception</dt><dd className="text-amber-900">{issue.description}</dd></div>}
                  <div><dt className="sr-only">Job owner</dt><dd className="text-muted">{users.get(job.ownerId) ?? "Unassigned"}</dd></div>
                </dl>
                {job.operationalStatus && <Badge text={job.operationalStatus.label} />}
                <Link href={`/jobs/${job.id}${action ? `#${action.section}` : ""}`} className="flex min-h-9 items-center justify-between gap-1 rounded-md border border-line px-2.5 text-xs font-semibold text-wine hover:bg-rosewash"
                  aria-label={`${action?.label ?? "View job"} for ${customer}`}>
                  {action?.label ?? "View job"} <ArrowUpRight size={14} aria-hidden />
                </Link>
              </article>;
            })}
            {!entries.length && <p className="px-1 py-4 text-xs text-muted">No jobs</p>}
          </div>
        </section>;
      })}
    </div>
  </section>;
}
