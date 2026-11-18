import Link from "next/link";
import { jobSectionPath } from "./sections";
import { ArrowUpRight } from "lucide-react";
import { currentStage, jobActionFor, jobLane, openExceptions, type Actor, type Job, type Settings } from "../../src/core/model";
import { jobHandoff, WaitingOn } from "../handoff";
import { Badge, ShortId } from "../ui";

const lanes = [
  { key: "new", label: "Ready to start", marker: "bg-wine" },
  { key: "working", label: "In progress", marker: "bg-sky-600" },
  { key: "attention", label: "Needs attention", marker: "bg-amber-600" },
  { key: "ready", label: "Billing ready", marker: "bg-emerald-600" },
  { key: "closed", label: "Closed", marker: "bg-stone-400" },
] as const;

export function JobBoard({ jobs, people, settings, actor }: { jobs: Job[]; people: Actor[]; settings: Settings; actor: Actor }) {
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
              const handoff = jobHandoff(job, people);
              const customer = job.data.customer || "Sea Import job";
              return <article key={job.id}>
                <Link href={`/jobs/${job.id}${action ? jobSectionPath(action.section) : ""}`}
                  className="panel group block space-y-2.5 p-3 hover:border-wine/40 hover:bg-rosewash/30 motion-safe:transition-colors motion-safe:duration-150"
                  aria-label={`${action?.label ?? "View job"} for ${customer}`}>
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <span className="text-muted"><ShortId prefix="JOB" id={job.id} /></span>
                    {action && <Badge text="Needs you" tone="danger" />}
                  </div>
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-semibold">{customer}</h3>
                    <ArrowUpRight size={16} aria-hidden className="mt-0.5 shrink-0 text-wine motion-safe:transition-transform motion-safe:duration-150 motion-safe:group-hover:translate-x-0.5 motion-safe:group-hover:-translate-y-0.5" />
                  </div>
                  <dl className="space-y-1 text-xs">
                    <div><dt className="sr-only">Current milestone</dt><dd>{stage ? `Next: ${stage.label}` : "Milestones complete"}</dd></div>
                    {issue && <div><dt className="sr-only">Open exception</dt><dd className="text-amber-900">{issue.description}</dd></div>}
                    {handoff && <div><dt className="sr-only">Waiting on</dt><dd><WaitingOn handoff={handoff} /></dd></div>}
                  </dl>
                  {job.operationalStatus && <Badge text={job.operationalStatus.label} />}
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
