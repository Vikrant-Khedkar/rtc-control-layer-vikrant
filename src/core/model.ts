import { z } from "zod";

export const roles = ["operations", "manager", "accounts", "admin"] as const;
export type Role = (typeof roles)[number];
export type Actor = { id: string; name: string; role: Role };

export const permissions = [
  "read", "intake.write", "quote.draft", "quote.approve", "job.advance",
  "exception.manage", "billing.close", "config.manage",
] as const;
export type Permission = (typeof permissions)[number];

export const intakeFields = ["customer", "billOfLading", "arrivalPort", "eta", "consignee"] as const;
export const intakeLabels = {
  customer: "Customer",
  billOfLading: "Bill of lading",
  arrivalPort: "Arrival port",
  eta: "Estimated arrival",
  consignee: "Consignee",
};
export const intakeSchema = z.object({
  customer: z.string().trim().max(150),
  billOfLading: z.string().trim().max(100),
  arrivalPort: z.string().trim().max(120),
  eta: z.string().trim().max(35),
  consignee: z.string().trim().max(150),
});
export type Intake = z.infer<typeof intakeSchema>;
export const referenceSchema = z.string().trim().min(1).max(80).regex(/^[a-z0-9][a-z0-9._-]*$/i);
export const statusKeys = ["needs_review", "ready", "draft", "approved", "active", "billing_ready", "closed", "open", "resolved"] as const;
export type Status = (typeof statusKeys)[number];

export const workflowSchema = z.object({
  required: z.array(z.enum(intakeFields)).max(intakeFields.length),
  marginBps: z.number().int().min(0).max(9500),
  milestones: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(80),
    hours: z.number().int().min(1).max(720),
  })).min(1).max(8).refine((steps) => new Set(steps.map((step) => step.id)).size === steps.length, "Milestone IDs must be unique"),
  labels: z.record(z.enum(statusKeys), z.string().trim().min(1).max(40)),
  jobStatuses: z.array(z.object({
    id: z.string().uuid(),
    label: z.string().trim().min(1).max(40),
  })).max(20).refine((items) => new Set(items.map(({ id }) => id)).size === items.length &&
    new Set(items.map(({ label }) => label.toLowerCase())).size === items.length, "Job status IDs and names must be unique"),
  grants: z.record(z.enum(roles), z.array(z.enum(permissions)).max(permissions.length)),
});
export type Workflow = z.infer<typeof workflowSchema>;
export type Settings = Workflow & { version: number };

export type Enquiry = {
  id: string; sourceRef: string; ownerId: string; createdAt: string;
  importData: Intake; data: Intake; issues: string[];
};
export type Quote = {
  id: string; enquiryId: string; createdAt: string;
  baseCents: number; priceCents: number; currency: string; marginBps: number;
  approvedAt?: string;
};
export type Exception = {
  id: string; description: string; ownerId: string; recovery: string;
  status: "open" | "resolved"; openedAt: string; resolvedAt?: string; resolution?: string;
};
export type Job = {
  id: string; enquiryId: string; quoteId: string; ownerId: string;
  data: Intake; createdAt: string; stageStartedAt: string; configVersion: number;
  milestones: Array<Workflow["milestones"][number] & { completedAt?: string }>;
  exceptions: Exception[];
  operationalStatus?: Workflow["jobStatuses"][number];
  closedAt?: string;
};
export type Audit = {
  id?: string; entityId: string; action: string; actor: Actor;
  at: string; summary: string; changes?: Record<string, unknown>;
};
export type Records = { enquiries: Enquiry; quotes: Quote; jobs: Job };
export type RecordType = keyof Records;

export class WorkflowError extends Error {
  constructor(public readonly code: "forbidden" | "missing" | "conflict" | "invalid", message: string) {
    super(message);
  }
}

export function can(settings: Settings, actor: Actor, permission: Permission): boolean {
  const restricted: Partial<Record<Permission, Role>> = {
    "quote.approve": "manager", "billing.close": "accounts", "config.manage": "admin",
  };
  return (!restricted[permission] || actor.role === restricted[permission]) &&
    settings.grants[actor.role].includes(permission);
}

export function currentStage(job: Job) {
  return job.milestones.find((step) => !step.completedAt);
}

export function openExceptions(job: Job) {
  return job.exceptions.filter((issue) => issue.status === "open");
}

export function billingState(job: Job): "active" | "billing_ready" | "closed" {
  if (job.closedAt) return "closed";
  return !currentStage(job) && !openExceptions(job).length ? "billing_ready" : "active";
}

export function stageDeadline(job: Job): Date | undefined {
  const stage = currentStage(job);
  if (!stage) return undefined;
  return new Date(new Date(job.stageStartedAt).getTime() + stage.hours * 3_600_000);
}

export function reviewIssues(input: Intake, settings: Settings): string[] {
  const issues = settings.required.filter((key) => !input[key]).map((key) => `${intakeLabels[key]} is required.`);
  if (input.eta && !z.iso.date().safeParse(input.eta).success) {
    issues.push("Estimated arrival must be a valid date in YYYY-MM-DD format.");
  }
  return issues;
}
