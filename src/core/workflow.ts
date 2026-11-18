import { z } from "zod";
import {
  billingState, can, currentStage, intakeSchema, referenceSchema, reviewIssues, workflowSchema, WorkflowError,
  type Actor, type Enquiry, type Intake, type Job, type Permission, type Quote, type RecordType, type Records, type Settings,
} from "./model";
import type { WorkflowDependencies, WorkTransaction } from "./ports";

function requirePermission(settings: Settings, actor: Actor, permission: Permission) {
  if (!can(settings, actor, permission)) {
    throw new WorkflowError("forbidden", "Your current role cannot perform this action.");
  }
}

function validate<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new WorkflowError("invalid", message);
  return result.data;
}

async function locked<K extends RecordType>(tx: WorkTransaction, kind: K, id: string): Promise<Records[K]> {
  const record = await tx.get(kind, id, true);
  if (!record) throw new WorkflowError("missing", "This record could not be found.");
  return record;
}

function requireOpen(job: Job) {
  if (job.closedAt) throw new WorkflowError("conflict", "This job is already closed.");
}

export function createWorkflow({ store, rates, now, id }: WorkflowDependencies) {
  function execute<T>(
    actor: Actor,
    permission: Permission,
    operation: (tx: WorkTransaction, settings: Settings, at: string) => Promise<T>,
  ): Promise<T> {
    return store.transaction(async (tx) => {
      const settings = await tx.settings(permission === "config.manage");
      requirePermission(settings, actor, permission);
      return operation(tx, settings, now().toISOString());
    });
  }

  return {
    async view(actor: Actor) {
      const settings = await store.read.settings();
      requirePermission(settings, actor, "read");
      return { settings, records: store.read };
    },

    async configuration(actor: Actor) {
      const settings = await store.read.settings();
      requirePermission(settings, actor, "config.manage");
      return settings;
    },

    createEnquiry(actor: Actor, source: unknown, input: unknown, origin: "manual" | "import" = "manual") {
      return execute(actor, "intake.write", async (tx, settings, at) => {
        const sourceRef = validate(referenceSchema, source, "Use a reference containing letters, digits, dots, dashes or underscores.").toUpperCase();
        const data = validate(intakeSchema, input, "One or more fields exceed the supported length.");
        const enquiry: Enquiry = {
          id: id(), sourceRef, data, importData: data, ownerId: actor.id, createdAt: at,
          issues: reviewIssues(data, settings),
        };
        if (!await tx.insert("enquiries", enquiry)) {
          const existing = await tx.enquiryByRef(sourceRef);
          if (existing && JSON.stringify(intakeSchema.parse(existing.importData)) === JSON.stringify(data)) {
            return existing;
          }
          throw new WorkflowError("conflict", "That reference already exists with different details. Open the existing enquiry to edit it.");
        }
        await tx.append({ entityId: enquiry.id, action: origin === "import" ? "Enquiry imported" : "Enquiry created", actor, at,
          summary: enquiry.issues.length ? "Sent to Needs Review." : "Ready to quote.", changes: { data, issues: enquiry.issues } });
        return enquiry;
      });
    },

    editEnquiry(actor: Actor, enquiryId: string, input: Intake) {
      return execute(actor, "intake.write", async (tx, settings, at) => {
        const enquiry = await locked(tx, "enquiries", enquiryId);
        if (await tx.quoteByEnquiry(enquiryId)) throw new WorkflowError("conflict", "The enquiry is locked after a draft quote is created.");
        const data = validate(intakeSchema, input, "One or more fields exceed the supported length.");
        const issues = reviewIssues(data, settings);
        await tx.update("enquiries", { ...enquiry, data, issues });
        await tx.append({ entityId: enquiryId, action: "Enquiry updated", actor, at,
          summary: issues.length ? "Details saved for review." : "Details checked and ready to quote.",
          changes: { before: enquiry.data, after: data, issues } });
      });
    },

    draftQuote(actor: Actor, enquiryId: string) {
      return execute(actor, "quote.draft", async (tx, settings, at) => {
        const enquiry = await locked(tx, "enquiries", enquiryId);
        const existing = await tx.quoteByEnquiry(enquiryId);
        if (existing) return existing;
        const issues = reviewIssues(enquiry.data, settings);
        if (issues.length) {
          await tx.update("enquiries", { ...enquiry, issues });
          await tx.append({ entityId: enquiryId, action: "Enquiry needs review", actor, at,
            summary: issues.join(" "), changes: { issues } });
          return undefined;
        }
        if (enquiry.issues.length) await tx.update("enquiries", { ...enquiry, issues: [] });
        const rate = await rates.rate();
        const quote: Quote = { id: id(), enquiryId, createdAt: at, baseCents: rate.cents,
          currency: rate.currency, marginBps: settings.marginBps,
          priceCents: Math.round(rate.cents * 10_000 / (10_000 - settings.marginBps)) };
        if (!await tx.insert("quotes", quote)) throw new WorkflowError("conflict", "A quote already exists for this enquiry.");
        await tx.append({ entityId: quote.id, action: "Quote drafted", actor, at,
          summary: "Internal draft created with the mock rate and configured margin.", changes: { ...quote } });
        return quote;
      });
    },

    approveQuote(actor: Actor, quoteId: string) {
      return execute(actor, "quote.approve", async (tx, settings, at) => {
        const quote = await locked(tx, "quotes", quoteId);
        const existing = await tx.jobByQuote(quoteId);
        if (existing) return existing;
        if (quote.approvedAt) throw new WorkflowError("conflict", "This quote has already been approved.");
        const enquiry = await tx.get("enquiries", quote.enquiryId);
        if (!enquiry) throw new WorkflowError("missing", "The quote no longer has an enquiry.");
        const job: Job = { id: id(), enquiryId: enquiry.id, quoteId, ownerId: enquiry.ownerId,
          createdAt: at, stageStartedAt: at, data: enquiry.data, milestones: settings.milestones,
          configVersion: settings.version, exceptions: [] };
        if (!await tx.insert("jobs", job)) throw new WorkflowError("conflict", "A job already exists for this quote.");
        await tx.update("quotes", { ...quote, approvedAt: at });
        await tx.append({ entityId: quote.id, action: "Quote approved", actor, at,
          summary: "Manager approved the draft.", changes: { jobId: job.id } });
        await tx.append({ entityId: job.id, action: "Job created", actor, at,
          summary: "Job opened from the approved quote.", changes: { quoteId, configVersion: settings.version } });
        return job;
      });
    },

    advanceJob(actor: Actor, jobId: string, expectedStage: string) {
      return execute(actor, "job.advance", async (tx, settings, at) => {
        const job = await locked(tx, "jobs", jobId);
        requireOpen(job);
        const stage = currentStage(job);
        if (!stage || stage.id !== expectedStage) throw new WorkflowError("conflict", "The current milestone has changed. Reload before trying again.");
        const updated = { ...job, stageStartedAt: at, milestones: job.milestones.map((step) =>
          step.id === stage.id ? { ...step, completedAt: at } : step) };
        await tx.update("jobs", updated);
        await tx.append({ entityId: jobId, action: "Milestone completed", actor, at,
          summary: stage.label, changes: { milestoneId: stage.id, billingState: billingState(updated) } });
      });
    },

    raiseException(actor: Actor, jobId: string, input: unknown) {
      return execute(actor, "exception.manage", async (tx, settings, at) => {
        const data = validate(z.object({
          description: z.string().trim().min(1).max(160),
          ownerId: z.string().uuid(),
          recovery: z.string().trim().min(1).max(500),
        }), input, "Enter a description, a valid owner and a recovery action.");
        const job = await locked(tx, "jobs", jobId);
        requireOpen(job);
        if (!currentStage(job)) throw new WorkflowError("conflict", "An exception can be raised while a milestone is active.");
        const owner = (await tx.actors()).find((person) => person.id === data.ownerId && can(settings, person, "exception.manage"));
        if (!owner) throw new WorkflowError("invalid", "Select an owner who can manage exceptions.");
        const issue = { ...data, id: id(), openedAt: at, status: "open" as const };
        await tx.update("jobs", { ...job, exceptions: [...job.exceptions, issue] });
        await tx.append({ entityId: jobId, action: "Exception raised", actor, at,
          summary: issue.description, changes: { exceptionId: issue.id, recovery: issue.recovery } });
        await tx.append({ entityId: jobId, action: "Exception assigned", actor, at,
          summary: `Assigned to ${owner.name}.`, changes: { exceptionId: issue.id, ownerId: owner.id } });
      });
    },

    resolveException(actor: Actor, jobId: string, exceptionId: string, note: unknown) {
      return execute(actor, "exception.manage", async (tx, settings, at) => {
        const resolution = validate(z.string().trim().min(1).max(500), note, "Enter how the issue was resolved.");
        const job = await locked(tx, "jobs", jobId);
        requireOpen(job);
        const issue = job.exceptions.find((item) => item.id === exceptionId);
        if (!issue || issue.status !== "open") throw new WorkflowError("conflict", "This exception is no longer open.");
        const updated = { ...job, exceptions: job.exceptions.map((item) => item.id === exceptionId
          ? { ...item, status: "resolved" as const, resolution, resolvedAt: at }
          : item) };
        await tx.update("jobs", updated);
        await tx.append({ entityId: jobId, action: "Exception resolved", actor, at,
          summary: resolution, changes: { exceptionId, billingState: billingState(updated) } });
      });
    },

    closeJob(actor: Actor, jobId: string) {
      return execute(actor, "billing.close", async (tx, settings, at) => {
        const job = await locked(tx, "jobs", jobId);
        if (job.closedAt) return;
        if (billingState(job) !== "billing_ready") throw new WorkflowError("conflict", "Complete the milestones and resolve open exceptions before closing.");
        await tx.update("jobs", { ...job, closedAt: at });
        await tx.append({ entityId: jobId, action: "Job closed", actor, at,
          summary: "Accounts closed the billing-ready job.", changes: { billingState: "closed" } });
      });
    },

    saveConfiguration(actor: Actor, expectedVersion: number, input: unknown) {
      return execute(actor, "config.manage", async (tx, previous, at) => {
        if (previous.version !== expectedVersion) throw new WorkflowError("conflict", "Configuration changed since you opened this page. Reload and try again.");
        const updates = validate(workflowSchema, input, "Check milestone labels and target hours, margin and status labels.");
        const next = { ...updates, version: previous.version + 1 };
        if (!can(next, actor, "config.manage") || !can(next, actor, "read")) {
          throw new WorkflowError("invalid", "Admin must retain access to the workspace and configuration.");
        }
        await tx.replaceSettings(next);
        await tx.append({ entityId: "workflow", action: "Configuration updated", actor, at,
          summary: `Workflow configuration v${next.version} saved.`, changes: { before: previous, after: next } });
        return next;
      });
    },
  };
}
