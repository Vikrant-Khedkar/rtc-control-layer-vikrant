import Link from "next/link";
import { ArrowUpRight, CircleAlert } from "lucide-react";
import type { Actor, Settings } from "../../src/core/model";
import { jobHandoff, WaitingOn } from "../handoff";
import { Badge, Empty, ShortId, time } from "../ui";
import type { OverviewRow } from "./overview";

const columns = [
  { key: "stage", label: "Current stage", width: "w-[17%]" },
  { key: "owner", label: "Owner", width: "w-[12%]" },
  { key: "sla", label: "SLA", width: "w-[10%]" },
  { key: "action", label: "Next action", width: "w-[26%]" },
  { key: "billing", label: "Billing", width: "w-[13%]" },
] as const;
const mobileColumns = [columns[0], columns[1], columns[2], columns[4], columns[3]];
const cell = "px-4 py-3.5 align-top";

export function JobTable({ rows, people, labels, emptyMessage }: {
  rows: OverviewRow[]; people: Actor[]; labels: Settings["labels"]; emptyMessage: string;
}) {
  if (!rows.length) return <Empty message={emptyMessage} />;
  const users = new Map(people.map((person) => [person.id, person.name]));
  const entries = rows.map(({ job, stage, issues, billing, deadline, overdue }) => {
    const url = `/jobs/${job.id}`;
    const issue = issues[0];
    const handoff = jobHandoff(job, people);
    const owner = users.get(job.ownerId) ?? "Unassigned";

    return {
      id: job.id,
      heading: <>
        <Link className="inline-flex items-start gap-1.5 font-semibold text-wine hover:underline" href={url}>
          <span className="break-words">{job.data.customer || "Sea Import job"}</span><ArrowUpRight className="mt-0.5 shrink-0" size={14} aria-hidden />
        </Link>
        <p className="mt-1.5 flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs text-muted">
          <ShortId prefix="JOB" id={job.id} /><span>· Sea import</span>
        </p>
      </>,
      fields: {
        stage: <>
          <p className="font-medium break-words">{stage?.label ?? "Milestones complete"}</p>
          {job.operationalStatus && <p className="mt-1 text-xs break-words text-muted">{job.operationalStatus.label}</p>}
        </>,
        owner: <span className="break-words">{owner}</span>,
        sla: deadline ? <span title={`Due ${time(deadline)} IST`}><Badge text={overdue ? "Overdue" : "On track"} tone={overdue ? "danger" : "neutral"} /></span> : <span className="text-muted">—</span>,
        action: issue ? <div className="space-y-1">
          <Link href={`${url}?tab=exceptions`} className="flex items-start gap-1.5 font-semibold break-words text-amber-900 hover:underline">
            <CircleAlert className="mt-0.5 shrink-0" size={15} aria-hidden /><span>{issue.description}</span>
            {issues.length > 1 && <span className="shrink-0 text-xs">+{issues.length - 1}<span className="sr-only"> more open exceptions</span></span>}
          </Link>
          <p className="text-xs break-words text-muted">{issue.recovery}</p>
          <p className="text-xs text-muted">Exception owner · {users.get(issue.ownerId) ?? "Unassigned"}</p>
        </div> : handoff ? <div className="space-y-1">
          <Link href={stage ? url : `${url}?tab=billing`} className="font-semibold text-wine hover:underline">{stage ? "Complete milestone" : "Review billing"}</Link>
          <div><WaitingOn handoff={{ ...handoff, name: handoff.name === owner ? undefined : handoff.name }} /></div>
        </div> : <span className="text-muted">—</span>,
        billing: <Badge text={labels[billing]} tone={billing === "billing_ready" ? "good" : "neutral"} />,
      },
    };
  });

  return <>
    <table aria-label="Job overview" className="hidden w-full table-fixed text-sm lg:table">
      <thead>
        <tr className="border-y border-line bg-canvas/80 text-xs font-semibold text-muted">
          <th scope="col" className="w-[22%] px-4 py-2.5">Job</th>
          {columns.map(({ key, label, width }) => <th key={key} scope="col" className={`${width} px-4 py-2.5`}>{label}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-line">
        {entries.map(({ id, heading, fields }) => <tr key={id} className="hover:bg-canvas/50">
          <th scope="row" className={`${cell} font-normal`}>{heading}</th>
          {columns.map(({ key }) => <td key={key} className={cell}>{fields[key]}</td>)}
        </tr>)}
      </tbody>
    </table>
    <ul aria-label="Job overview" className="divide-y divide-line text-sm lg:hidden">
      {entries.map(({ id, heading, fields }) => <li key={id} className="space-y-3 px-4 py-4">
        <div>{heading}</div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {mobileColumns.map(({ key, label }) => <div key={key} className={key === "action" ? "col-span-2 min-w-0" : "min-w-0"}>
            <dt className="mb-1 text-xs font-medium text-muted">{label}</dt><dd>{fields[key]}</dd>
          </div>)}
        </dl>
      </li>)}
    </ul>
  </>;
}
