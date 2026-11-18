import { randomUUID } from "node:crypto";
import { Pool } from "pg";
import { afterAll, describe, expect, it } from "vitest";
import { defaultWorkflow, demoUsers, exampleEnquiry, exampleRate } from "../demo/fixtures";
import { importDemoInbox } from "../demo/inbox";
import { mockRate } from "../src/adapters/mock-rate";
import { postgresDemoIdentity, postgresStore } from "../src/adapters/postgres";
import { billingState, currentStage } from "../src/core/model";
import { createWorkflow } from "../src/core/workflow";

if (!process.env.TEST_DATABASE_URL) throw new Error("Set TEST_DATABASE_URL or run npm run test:local.");
const pool = new Pool({ connectionString: process.env.TEST_DATABASE_URL });
const store = postgresStore(pool);
const dependencies = { store, rates: mockRate(exampleRate), now: () => new Date(), id: randomUUID };
const workflow = createWorkflow(dependencies);
const [operations, manager, accounts, admin] = demoUsers;
const ref = () => `TEST-${randomUUID()}`;

async function draft() {
  const enquiry = await workflow.createEnquiry(operations, ref(), exampleEnquiry);
  const quote = await workflow.draftQuote(operations, enquiry.id);
  if (!quote) throw new Error("Fixture must produce a quote");
  return { enquiry, quote };
}

async function finish(jobId: string) {
  for (const step of (await store.read.get("jobs", jobId))!.milestones) {
    await workflow.advanceJob(operations, jobId, step.id);
  }
}

afterAll(() => pool.end());

describe("Sea Import Customs on Postgres", () => {
  it("imports complete and incomplete enquiries and safely replays the same inbox batch", async () => {
    const batch = randomUUID().toUpperCase();
    await importDemoInbox(workflow, operations, batch);
    await importDemoInbox(workflow, operations, batch);
    const enquiries = (await store.read.list("enquiries")).filter((enquiry) => enquiry.sourceRef.startsWith(`INBOX-${batch}-`));
    expect(enquiries).toHaveLength(4);
    expect(enquiries.filter((enquiry) => enquiry.issues.length === 0)).toHaveLength(2);
    const missing = enquiries.find((enquiry) => enquiry.sourceRef.endsWith("-03"));
    expect(missing?.issues).toEqual(["Arrival port is required."]);
    expect((await store.read.auditFor(enquiries.map((enquiry) => enquiry.id))).map((event) => event.action))
      .toEqual(Array(4).fill("Enquiry imported"));
  });

  it("takes an enquiry through approval, milestones and Accounts closure", async () => {
    const { enquiry, quote } = await draft();
    expect(quote.priceCents).toBe(147059);
    const job = await workflow.approveQuote(manager, quote.id);
    expect(job.enquiryId).toBe(enquiry.id);
    expect((await store.read.get("quotes", quote.id))?.approvedAt).toBeTruthy();
    await expect(workflow.closeJob(accounts, job.id)).rejects.toMatchObject({ code: "conflict" });
    await finish(job.id);
    expect(billingState((await store.read.get("jobs", job.id))!)).toBe("billing_ready");
    await workflow.closeJob(accounts, job.id);
    expect(billingState((await store.read.get("jobs", job.id))!)).toBe("closed");
    const audit = await store.read.auditFor([enquiry.id, quote.id, job.id]);
    expect(audit.map((event) => [event.action, event.actor.role])).toEqual([
      ["Job closed", "accounts"], ["Milestone completed", "operations"], ["Milestone completed", "operations"],
      ["Milestone completed", "operations"], ["Job created", "manager"], ["Quote approved", "manager"],
      ["Quote drafted", "operations"], ["Enquiry created", "operations"],
    ]);
  });

  it("records missing and invalid fields and accepts a correction", async () => {
    const enquiry = await workflow.createEnquiry(operations, ref(), { ...exampleEnquiry, arrivalPort: "", eta: "2026-02-30" });
    expect(enquiry.issues).toEqual(["Arrival port is required.", "Estimated arrival must be a valid date in YYYY-MM-DD format."]);
    expect(await workflow.draftQuote(operations, enquiry.id)).toBeUndefined();
    await workflow.editEnquiry(operations, enquiry.id, exampleEnquiry);
    expect((await store.read.get("enquiries", enquiry.id))?.issues).toEqual([]);
    expect(await workflow.draftQuote(operations, enquiry.id)).toBeDefined();
  });

  it("links concurrent duplicates and rejects a conflicting payload", async () => {
    const reference = ref();
    const [first, replay] = await Promise.all([
      workflow.createEnquiry(operations, reference, exampleEnquiry),
      workflow.createEnquiry(operations, reference.toLowerCase(), exampleEnquiry),
    ]);
    expect(replay.id).toBe(first.id);
    await expect(workflow.createEnquiry(operations, reference, { ...exampleEnquiry, customer: "Different" }))
      .rejects.toMatchObject({ code: "conflict" });
    const quote = (await workflow.draftQuote(operations, first.id))!;
    const jobs = await Promise.all([workflow.approveQuote(manager, quote.id), workflow.approveQuote(manager, quote.id)]);
    expect(jobs[0].id).toBe(jobs[1].id);
    expect((await store.read.auditFor([first.id, quote.id, jobs[0].id])).map((event) => event.action)).toEqual([
      "Job created", "Quote approved", "Quote drafted", "Enquiry created",
    ]);
  });

  it("denies a direct approval command and configuration read to Operations", async () => {
    const { quote } = await draft();
    await expect(workflow.approveQuote(operations, quote.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(workflow.approveQuote(admin, quote.id)).rejects.toMatchObject({ code: "forbidden" });
    await expect(workflow.configuration(operations)).rejects.toMatchObject({ code: "forbidden" });
    expect((await store.read.get("quotes", quote.id))?.approvedAt).toBeUndefined();
    expect(await store.read.jobByQuote(quote.id)).toBeUndefined();
  });

  it("tracks an assigned exception and blocks closure until it is resolved", async () => {
    const { quote } = await draft();
    const job = await workflow.approveQuote(manager, quote.id);
    await workflow.raiseException(operations, job.id, {
      description: "Synthetic customs query", ownerId: operations.id, recovery: "Verify replacement invoice placeholder.",
    });
    await finish(job.id);
    await expect(workflow.closeJob(accounts, job.id)).rejects.toMatchObject({ code: "conflict" });
    const issue = (await store.read.get("jobs", job.id))!.exceptions[0];
    expect(issue).toMatchObject({ ownerId: operations.id, status: "open" });
    await workflow.resolveException(operations, job.id, issue.id, "Placeholder checked.");
    expect(billingState((await store.read.get("jobs", job.id))!)).toBe("billing_ready");
    await workflow.closeJob(accounts, job.id);
    expect((await store.read.auditFor([job.id])).map((event) => event.action)).toEqual(expect.arrayContaining([
      "Exception raised", "Exception assigned", "Exception resolved",
    ]));
  });

  it("rolls back a job and approval if audit writing fails", async () => {
    const { quote } = await draft();
    const faulty = createWorkflow({ ...dependencies, store: {
      read: store.read,
      transaction: (operation) => store.transaction((tx) => operation({ ...tx, append: async () => {
        throw new Error("Audit write unavailable");
      } })),
    } });
    await expect(faulty.approveQuote(manager, quote.id)).rejects.toThrow("Audit write unavailable");
    expect(await store.read.jobByQuote(quote.id)).toBeUndefined();
    expect((await store.read.get("quotes", quote.id))?.approvedAt).toBeUndefined();
  });

  it("lets the runtime read and append audit events while blocking rewrites", async () => {
    const { enquiry } = await draft();
    expect((await store.read.auditFor([enquiry.id])).length).toBeGreaterThan(0);
    await expect(pool.query("UPDATE audit_events SET body = body WHERE entity_id = $1", [enquiry.id]))
      .rejects.toMatchObject({ code: "42501" });
    await expect(pool.query("DELETE FROM audit_events WHERE entity_id = $1", [enquiry.id]))
      .rejects.toMatchObject({ code: "42501" });
  });

  it("rotates demo sessions when switching role and revokes on exit", async () => {
    const identity = postgresDemoIdentity(pool);
    const session = await identity.switchTo("operations");
    expect(await identity.resolve(session.token)).toEqual(operations);
    const next = await identity.switchTo("manager", session.token);
    expect(await identity.resolve(session.token)).toBeUndefined();
    expect(await identity.resolve(next.token)).toEqual(manager);
    await identity.revoke(next.token);
    expect(await identity.resolve(next.token)).toBeUndefined();
  });

  it("applies settings to new work, preserves prior milestones and enforces grants immediately", async () => {
    const existing = await draft();
    const first = await workflow.approveQuote(manager, existing.quote.id);
    const initial = await workflow.configuration(admin);
    const updated = await workflow.saveConfiguration(admin, initial.version, {
      ...initial, required: [...defaultWorkflow.required, "consignee"], marginBps: 2000,
      milestones: [...initial.milestones].reverse(),
      grants: { ...initial.grants, accounts: ["read"], operations: [...initial.grants.operations, "quote.approve"] },
    });
    try {
      const incomplete = await workflow.createEnquiry(operations, ref(), { ...exampleEnquiry, consignee: "" });
      expect(incomplete.issues).toEqual(["Consignee is required."]);
      const { quote } = await draft();
      expect(quote.priceCents).toBe(156250);
      await expect(workflow.approveQuote(operations, quote.id)).rejects.toMatchObject({ code: "forbidden" });
      const second = await workflow.approveQuote(manager, quote.id);
      expect(currentStage(second)?.id).toBe(updated.milestones[0].id);
      expect(currentStage((await store.read.get("jobs", first.id))!)?.id).toBe(initial.milestones[0].id);
      await finish(first.id);
      await expect(workflow.closeJob(accounts, first.id)).rejects.toMatchObject({ code: "forbidden" });
      const activity = await store.read.auditFor(["workflow"]);
      expect(activity[0]).toMatchObject({ action: "Configuration updated", actor: admin });
    } finally {
      await workflow.saveConfiguration(admin, updated.version, initial);
    }
  });
});
