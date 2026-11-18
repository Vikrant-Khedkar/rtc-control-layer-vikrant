import { billingState, currentStage, openExceptions, type Actor, type Enquiry, type Job, type Quote, type Role } from "../src/core/model";

type Handoff = { role: Role | "exception owner"; name?: string };

export function enquiryHandoff(enquiry: Enquiry, quote: Quote | undefined, people: Actor[]): Handoff | undefined {
  if (quote?.approvedAt) return;
  if (quote) return { role: "manager", name: people.find((person) => person.role === "manager")?.name };
  return { role: "operations", name: people.find((person) => person.id === enquiry.ownerId)?.name };
}

export function jobHandoff(job: Job, people: Actor[]): Handoff | undefined {
  const billing = billingState(job);
  if (billing === "closed") return;
  if (billing === "billing_ready") return { role: "accounts", name: people.find((person) => person.role === "accounts")?.name };
  const issue = openExceptions(job)[0];
  if (issue) {
    const owner = people.find((person) => person.id === issue.ownerId);
    return { role: owner?.role ?? "exception owner", name: owner?.name };
  }
  if (currentStage(job)) return { role: "operations", name: people.find((person) => person.id === job.ownerId)?.name };
}

export function WaitingOn({ handoff }: { handoff: Handoff }) {
  return <span className="inline-flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 text-xs">
    <span className="font-semibold text-ink">Awaiting <span className="capitalize">{handoff.role}</span></span>
    {handoff.name && <span className="text-muted">· {handoff.name}</span>}
  </span>;
}
