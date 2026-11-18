import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { billingState, currentStage, openExceptions, stageDeadline, type Actor, type Job, type Settings } from "../../src/core/model";
import { jobHandoff, WaitingOn } from "../handoff";
import { Badge, Empty, ShortId } from "../ui";

export function JobTable({ jobs, people, labels, emptyMessage = "Approved quotes appear here as jobs." }: {
  jobs: Job[]; people: Actor[]; labels: Settings["labels"]; emptyMessage?: string;
}) {
  const users = new Map(people.map((person) => [person.id, person.name]));
  const now = Date.now();
  return (jobs.length ? <div className="overflow-x-auto"><table className="data-table min-w-[1150px]">
        <thead><tr>{["Job ID", "Customer", "Mode", "Current stage", "Owner", "SLA", "Job status", "Exceptions", "Next action", "Billing"].map((label) => <th key={label} scope="col">{label}</th>)}</tr></thead>
        <tbody>{jobs.map((job) => {
          const stage = currentStage(job);
          const issues = openExceptions(job);
          const billing = billingState(job);
          const handoff = jobHandoff(job, people);
          const overdue = Number(stageDeadline(job)) < now;
          return <tr key={job.id}>
            <td><Link className="inline-flex items-center gap-1 text-wine" href={`/jobs/${job.id}`}><ShortId prefix="JOB" id={job.id} /><ArrowUpRight size={13} /></Link></td>
            <td>{job.data.customer || "—"}</td><td>Sea import</td><td>{stage?.label ?? "Complete"}</td><td>{users.get(job.ownerId) ?? "—"}</td>
            <td>{stage ? <Badge text={overdue ? "Overdue" : "On track"} tone={overdue ? "danger" : "good"} /> : "—"}</td>
            <td>{job.operationalStatus ? <Badge text={job.operationalStatus.label} /> : "—"}</td>
            <td>{issues.length ? <Badge text={`${issues.length} open`} tone="warn" /> : "—"}</td>
            <td>{handoff ? <div className="space-y-1"><WaitingOn handoff={handoff} />
              <p>{issues[0]?.recovery ?? (stage ? `Complete: ${stage.label}` : "Review and close billing")}</p></div> : "—"}</td>
            <td><Badge text={labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} /></td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty message={emptyMessage} />);
}
