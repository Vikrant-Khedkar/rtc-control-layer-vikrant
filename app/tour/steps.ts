import { currentStage, openExceptions, type Enquiry, type Job, type Permission, type Quote, type Role } from "../../src/core/model";
import { exampleEnquiry } from "../../demo/fixtures";

export const phases = [
  "Create enquiry", "Fix missing data", "Draft quote", "Approve quote", "Run the job", "Close billing",
];

type Action = {
  phase: number;
  role: Role;
  permission: Permission;
  title: string;
  description: string;
  command: string;
  label: string;
  fields?: Record<string, string>;
};

export function nextTourAction(enquiry?: Enquiry, quote?: Quote, job?: Job, actorId?: string): Action | undefined {
  if (!enquiry) return {
    phase: 0, role: "operations", permission: "intake.write", title: "Create an incomplete enquiry",
    description: "We’ll create a synthetic enquiry with the arrival port missing so you can see how Needs Review works.",
    command: "create", label: "Create sample enquiry",
    fields: { ...exampleEnquiry, arrivalPort: "" },
  };

  if (!quote && enquiry.issues.length) return {
    phase: 1, role: "operations", permission: "intake.write", title: "Correct the enquiry",
    description: "Fill in the synthetic arrival port and validate the enquiry again.",
    command: "edit", label: "Add arrival port and save", fields: { ...exampleEnquiry, enquiryId: enquiry.id },
  };

  if (!quote) return {
    phase: 2, role: "operations", permission: "quote.draft", title: "Draft an internal quote",
    description: "The draft uses the mock rate and the current gross margin. It will wait for Manager approval.",
    command: "draft", label: "Draft internal quote", fields: { enquiryId: enquiry.id },
  };

  if (!job) return {
    phase: 3, role: "manager", permission: "quote.approve", title: "Approve the draft",
    description: "The Manager approves the quote and creates the job. Operations does not have approval access.",
    command: "approve", label: "Approve quote and create job", fields: { quoteId: quote.id },
  };

  if (job.closedAt) return undefined;
  const stage = currentStage(job);
  const firstStageDone = job.milestones.some((step) => step.completedAt);

  if (stage && !job.exceptions.length && (firstStageDone || job.milestones.length === 1)) return {
    phase: 4, role: "operations", permission: "exception.manage", title: "Raise and assign an exception",
    description: "A synthetic customs document query comes in. Assign it to Operations with a recovery action.",
    command: "raise", label: "Raise sample exception",
    fields: {
      jobId: job.id, ownerId: actorId ?? "", description: "Synthetic customs document query",
      recovery: "Check the replacement invoice placeholder.",
    },
  };

  if (stage) return {
    phase: 4, role: "operations", permission: "job.advance", title: `Complete: ${stage.label}`,
    description: openExceptions(job).length
      ? "Record the milestone. The open exception keeps billing blocked even after the milestones are complete."
      : "Record this milestone and move the job to the next stage.",
    command: "advance", label: "Complete current milestone", fields: { jobId: job.id, stageId: stage.id },
  };

  const issue = openExceptions(job)[0];
  if (issue) return {
    phase: 4, role: "operations", permission: "exception.manage", title: "Resolve the exception",
    description: "All milestones are complete. Record the recovery so the job can become billing-ready.",
    command: "resolve", label: "Resolve exception",
    fields: { jobId: job.id, exceptionId: issue.id, resolution: "Replacement invoice placeholder checked." },
  };

  return {
    phase: 5, role: "accounts", permission: "billing.close", title: "Close the billing-ready job",
    description: "Accounts can close the job now that its milestones are complete and its exceptions are resolved.",
    command: "close", label: "Close job", fields: { jobId: job.id },
  };
}
